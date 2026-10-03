from __future__ import annotations

import math
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
LOCAL_SERVICE = ROOT / "local-service"
if str(LOCAL_SERVICE) not in sys.path:
    sys.path.insert(0, str(LOCAL_SERVICE))

from model_manager import ModelManager  # noqa: E402

_MANAGER = ModelManager()


class UpscaleEngine:
    """Real-ESRGAN CUDA con tiling exterior para progreso/cancelación."""

    def __init__(self, model_id: str, tile: int = 512, overlap: int = 32):
        self.model_id = model_id
        self.spec = _MANAGER.spec(model_id)
        self.scale = int(self.spec["scale"])
        self.tile = max(128, int(tile))
        self.overlap = max(8, int(overlap))
        self._upsampler = None

    def _load(self, job):
        if self._upsampler is not None:
            return self._upsampler

        job.set_progress(0.01, "Preparando modelo")
        model_path = _MANAGER.ensure(
            self.model_id,
            lambda p, stage: job.set_progress(0.01 + p * 0.14, stage),
        )
        if job.cancelled:
            raise RuntimeError("Cancelado")

        import torch
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA no está disponible.")

        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer

        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=self.scale,
        )
        self._upsampler = RealESRGANer(
            scale=self.scale,
            model_path=str(model_path),
            model=model,
            tile=0,
            tile_pad=0,
            pre_pad=0,
            half=True,
            gpu_id=0,
        )
        job.set_progress(0.17, "Modelo cargado en GPU")
        return self._upsampler

    def run(self, job, input_path: Path, output_path: Path) -> Path:
        upsampler = self._load(job)
        if job.cancelled:
            raise RuntimeError("Cancelado")

        img = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError("No se pudo leer la imagen enviada.")

        alpha = None
        gray = False
        if img.ndim == 2:
            gray = True
            src = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif img.shape[2] == 4:
            src = img[:, :, :3]
            alpha = img[:, :, 3]
        else:
            src = img[:, :, :3]

        h, w = src.shape[:2]
        scale = self.scale
        out = np.empty((h * scale, w * scale, 3), dtype=src.dtype)

        nx = math.ceil(w / self.tile)
        ny = math.ceil(h / self.tile)
        total = nx * ny
        done = 0

        for ty in range(ny):
            for tx in range(nx):
                if job.cancelled:
                    raise RuntimeError("Cancelado")

                x0 = tx * self.tile
                y0 = ty * self.tile
                x1 = min(w, x0 + self.tile)
                y1 = min(h, y0 + self.tile)

                ex0 = max(0, x0 - self.overlap)
                ey0 = max(0, y0 - self.overlap)
                ex1 = min(w, x1 + self.overlap)
                ey1 = min(h, y1 + self.overlap)

                tile = src[ey0:ey1, ex0:ex1]
                enhanced, _ = upsampler.enhance(tile, outscale=scale)

                crop_l = (x0 - ex0) * scale
                crop_t = (y0 - ey0) * scale
                crop_r = crop_l + (x1 - x0) * scale
                crop_b = crop_t + (y1 - y0) * scale

                out[y0 * scale:y1 * scale, x0 * scale:x1 * scale] = (
                    enhanced[crop_t:crop_b, crop_l:crop_r]
                )

                done += 1
                job.set_progress(
                    0.18 + 0.78 * done / total,
                    f"Ampliando · bloque {done}/{total}",
                )

        if gray:
            out = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)

        if alpha is not None:
            alpha_up = cv2.resize(
                alpha,
                (w * scale, h * scale),
                interpolation=cv2.INTER_LANCZOS4,
            )
            if out.ndim == 2:
                out = cv2.cvtColor(out, cv2.COLOR_GRAY2BGRA)
                out[:, :, 3] = alpha_up
            else:
                out = np.dstack([out, alpha_up])

        job.set_progress(0.97, "Guardando resultado")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if not cv2.imwrite(str(output_path), out, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
            raise RuntimeError("No se pudo guardar el resultado.")
        job.set_progress(0.99, "Resultado listo")
        return output_path
