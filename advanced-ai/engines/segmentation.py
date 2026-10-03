from __future__ import annotations

import gc
from pathlib import Path

import numpy as np
from PIL import Image

from .local_service_compat import cancelled_guard


def _read_rgb(path: Path, input_format: str, width: int, height: int) -> Image.Image:
    if input_format == "raw16":
        raw = np.fromfile(path, dtype="<u2")
        expected = width * height * 3
        if raw.size != expected:
            raise RuntimeError("RGB16 de segmentación incompleto.")
        arr16 = raw.reshape(height, width, 3)
        arr8 = np.clip((arr16.astype(np.uint32) + 128) // 257, 0, 255).astype(np.uint8)
        return Image.fromarray(arr8, "RGB")
    return Image.open(path).convert("RGB")


class SegmentationEngine:
    """SAM2.1 Hiera Large para máscaras por puntos positivos/negativos."""

    model_id = "sam2.1-hiera-large"

    def __init__(self) -> None:
        import torch
        from transformers import Sam2Model, Sam2Processor
        from .local_service_model_manager import ModelManager

        self.torch = torch
        self.device = torch.device("cuda")
        manager = ModelManager()
        model_path = manager.ensure(self.model_id)
        self.processor = Sam2Processor.from_pretrained(str(model_path), local_files_only=True)
        self.model = Sam2Model.from_pretrained(
            str(model_path),
            local_files_only=True,
            torch_dtype=torch.float16,
        ).to(self.device).eval()

    def release(self) -> None:
        try:
            del self.model
            del self.processor
        except Exception:
            pass
        gc.collect()
        if self.torch.cuda.is_available():
            self.torch.cuda.empty_cache()

    def run(
        self,
        job,
        src: Path,
        out: Path,
        *,
        input_format: str,
        width: int,
        height: int,
        points: list[list[float]],
        labels: list[int],
        invert: bool = False,
    ) -> Path:
        if not points or len(points) != len(labels):
            raise RuntimeError("Añade al menos un punto de selección.")
        if len(points) > 64:
            raise RuntimeError("Demasiados puntos de refinado; máximo 64.")

        cancelled_guard(job)
        job.set_progress(0.08, "Preparando imagen para SAM2")
        image = _read_rgb(src, input_format, width, height)
        w, h = image.size

        clean_points: list[list[float]] = []
        clean_labels: list[int] = []
        for point, label in zip(points, labels):
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                continue
            x = max(0.0, min(float(point[0]), float(w - 1)))
            y = max(0.0, min(float(point[1]), float(h - 1)))
            clean_points.append([x, y])
            clean_labels.append(1 if int(label) == 1 else 0)
        if not clean_points or 1 not in clean_labels:
            raise RuntimeError("La selección necesita al menos un punto positivo.")

        cancelled_guard(job)
        job.set_progress(0.22, "Codificando imagen con SAM2")
        inputs = self.processor(
            images=image,
            input_points=[[[clean_points]]],
            input_labels=[[[clean_labels]]],
            return_tensors="pt",
        )
        inputs = {k: v.to(self.device) if hasattr(v, "to") else v for k, v in inputs.items()}

        cancelled_guard(job)
        job.set_progress(0.48, "Calculando máscara")
        with self.torch.inference_mode(), self.torch.autocast(device_type="cuda", dtype=self.torch.float16):
            outputs = self.model(**inputs)

        cancelled_guard(job)
        job.set_progress(0.76, "Refinando bordes")
        masks = self.processor.post_process_masks(
            outputs.pred_masks.detach().float().cpu(),
            inputs["original_sizes"].detach().cpu(),
        )[0]

        scores = getattr(outputs, "iou_scores", None)
        if scores is not None:
            score_vec = scores.detach().float().cpu().reshape(-1)
            index = int(score_vec.argmax().item())
        else:
            index = 0

        flat = masks.reshape(-1, h, w)
        index = min(index, flat.shape[0] - 1)
        mask = flat[index].numpy()
        if mask.dtype != np.bool_:
            mask = mask > 0.0
        alpha = np.where(mask, 255, 0).astype(np.uint8)
        if invert:
            alpha = 255 - alpha

        out.parent.mkdir(parents=True, exist_ok=True)
        alpha.tofile(out)
        job.meta.update({
            "width": w,
            "height": h,
            "channels": 1,
            "dtype": "uint8",
            "model": self.model_id,
            "task": "segment",
            "points": len(clean_points),
            "inverted": bool(invert),
        })
        job.set_progress(0.96, "Máscara preparada")
        return out
