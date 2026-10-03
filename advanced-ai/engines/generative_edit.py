from __future__ import annotations

import gc
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from .local_service_compat import cancelled_guard
from .local_service_model_manager import ModelManager


def _read_rgb(path: Path, input_format: str, width: int, height: int) -> Image.Image:
    if input_format == "raw16":
        raw = np.fromfile(path, dtype="<u2")
        expected = width * height * 3
        if raw.size != expected:
            raise RuntimeError("RGB16 generativo incompleto.")
        arr16 = raw.reshape(height, width, 3)
        arr8 = np.clip((arr16.astype(np.uint32) + 128) // 257, 0, 255).astype(np.uint8)
        return Image.fromarray(arr8, "RGB")
    return Image.open(path).convert("RGB")


def _multiple16(v: int) -> int:
    return max(64, int(round(v / 16)) * 16)


def _bbox(mask: np.ndarray, padding: int) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask > 4)
    if xs.size == 0:
        raise RuntimeError("La máscara de edición está vacía.")
    h, w = mask.shape
    x0 = max(0, int(xs.min()) - padding)
    y0 = max(0, int(ys.min()) - padding)
    x1 = min(w, int(xs.max()) + 1 + padding)
    y1 = min(h, int(ys.max()) + 1 + padding)
    return x0, y0, x1, y1


class GenerativeEditEngine:
    """FLUX.1 Fill [dev] NF4, optimizado para 12 GB mediante cuantización y offload."""

    model_id = "flux1-fill-dev-nf4"
    base_id = "flux1-fill-dev-components"

    def __init__(self) -> None:
        import torch
        from diffusers import FluxFillPipeline, FluxTransformer2DModel
        from transformers import T5EncoderModel

        self.torch = torch
        manager = ModelManager()
        base_path = manager.ensure(self.base_id)
        nf4_path = manager.ensure(self.model_id)

        # NF4 conserva calidad de la arquitectura Fill reduciendo drásticamente
        # la VRAM del transformer y de T5 XXL.
        transformer = FluxTransformer2DModel.from_pretrained(
            str(nf4_path), subfolder="transformer",
            torch_dtype=torch.bfloat16, local_files_only=True,
        )
        text_encoder_2 = T5EncoderModel.from_pretrained(
            str(nf4_path), subfolder="text_encoder_2",
            torch_dtype=torch.bfloat16, local_files_only=True,
        )

        self.pipe = FluxFillPipeline.from_pretrained(
            str(base_path),
            transformer=transformer,
            text_encoder_2=text_encoder_2,
            torch_dtype=torch.bfloat16,
            local_files_only=True,
        )
        # 4070 SUPER 12 GB: secuencial es más conservador; model_cpu_offload
        # suele ser más rápido y sigue entrando gracias a NF4.
        self.pipe.enable_model_cpu_offload()
        self.pipe.enable_vae_slicing()
        self.pipe.enable_vae_tiling()
        try:
            self.pipe.set_progress_bar_config(disable=True)
        except Exception:
            pass

    def release(self) -> None:
        try:
            del self.pipe
        except Exception:
            pass
        gc.collect()
        if self.torch.cuda.is_available():
            self.torch.cuda.empty_cache()

    def run(
        self, job, src: Path, mask_path: Path, out: Path, *,
        input_format: str, width: int, height: int,
        prompt: str, guidance: float, steps: int, seed: int,
        padding: int = 128, feather: int = 8, max_side: int = 1024,
    ) -> Path:
        cancelled_guard(job)
        job.set_progress(0.04, "Preparando edición localizada")
        image = _read_rgb(src, input_format, width, height)
        w, h = image.size

        mask = np.fromfile(mask_path, dtype=np.uint8)
        if mask.size != w * h:
            raise RuntimeError("La máscara no coincide con la fotografía.")
        mask = mask.reshape(h, w)

        x0, y0, x1, y1 = _bbox(mask, padding)
        crop = image.crop((x0, y0, x1, y1))
        mask_crop = Image.fromarray(mask[y0:y1, x0:x1], "L")

        cw, ch = crop.size
        scale = min(1.0, float(max_side) / max(cw, ch))
        tw = _multiple16(max(64, round(cw * scale)))
        th = _multiple16(max(64, round(ch * scale)))
        work_image = crop.resize((tw, th), Image.Resampling.LANCZOS)
        work_mask = mask_crop.resize((tw, th), Image.Resampling.LANCZOS)

        cancelled_guard(job)
        job.set_progress(0.14, "Preparando FLUX Fill NF4")
        generator = self.torch.Generator(device="cpu").manual_seed(int(seed) & 0x7FFFFFFF)

        def callback(pipe, step, timestep, callback_kwargs):
            cancelled_guard(job)
            frac = (step + 1) / max(1, int(steps))
            job.set_progress(0.16 + 0.72 * frac, f"FLUX Fill · paso {step + 1}/{steps}")
            return callback_kwargs

        with self.torch.inference_mode():
            generated = self.pipe(
                prompt=prompt,
                image=work_image,
                mask_image=work_mask,
                height=th,
                width=tw,
                guidance_scale=float(guidance),
                num_inference_steps=int(steps),
                max_sequence_length=512,
                generator=generator,
                callback_on_step_end=callback,
            ).images[0]

        cancelled_guard(job)
        job.set_progress(0.91, "Recomponiendo a resolución completa")
        generated = generated.resize((cw, ch), Image.Resampling.LANCZOS)

        alpha = mask_crop
        if feather > 0:
            alpha = alpha.filter(ImageFilter.GaussianBlur(radius=min(32, int(feather))))
        patch = Image.composite(generated, crop, alpha)

        final = image.copy()
        final.paste(patch, (x0, y0))

        arr16 = np.asarray(final, dtype=np.uint16) * 257
        out.parent.mkdir(parents=True, exist_ok=True)
        arr16.astype("<u2", copy=False).tofile(out)

        job.meta.update({
            "width": w, "height": h, "channels": 3, "dtype": "uint16le",
            "inputPrecision": 16 if input_format == "raw16" else 8,
            "model": self.model_id, "task": "generative-edit",
            "seed": int(seed), "steps": int(steps),
            "roi": [x0, y0, x1, y1],
        })
        job.set_progress(0.98, "Edición FLUX preparada")
        return out
