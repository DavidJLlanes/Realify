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
    """Real-ESRGAN CUDA con tiling exterior para progreso y cancelación."""

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

    @staticmethod
    def _read_input(path: Path, input_format: str, width: int, height: int, channels: int):
        if input_format == "raw16":
            if channels != 3 or width < 1 or height < 1:
                raise RuntimeError("Metadatos raw16 no válidos.")
            expected = width * height * channels
            rgb = np.fromfile(path, dtype="<u2")
            if rgb.size != expected:
                raise RuntimeError("El tamaño del RGB16 recibido no coincide con sus dimensiones.")
            rgb = rgb.reshape((height, width, 3))
            return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError("No se pudo leer la imagen enviada.")
        if img.ndim == 2:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if img.shape[2] == 4:
            return img[:, :, :3]
        return img[:, :, :3]

    def run(
        self,
        job,
        input_path: Path,
        output_path: Path,
        *,
        input_format: str = "png",
        width: int = 0,
        height: int = 0,
        channels: int = 3,
    ) -> Path:
        upsampler = self._load(job)
        if job.cancelled:
            raise RuntimeError("Cancelado")

        src = self._read_input(input_path, input_format, width, height, channels)
        h, w = src.shape[:2]
        scale = self.scale

        # El resultado se mantiene en 16 bits por canal incluso si la entrada
        # sólo pudo llegar en 8 bits. Si Realify dispone de hiSrc, la entrada
        # raw16 conserva esos 16 bits hasta el tensor de Real-ESRGAN.
        out = np.empty((h * scale, w * scale, 3), dtype=np.uint16)

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

                if enhanced.dtype != np.uint16:
                    enhanced = enhanced.astype(np.uint16) * 257

                crop_l = (x0 - ex0) * scale
                crop_t = (y0 - ey0) * scale
                crop_r = crop_l + (x1 - x0) * scale
                crop_b = crop_t + (y1 - y0) * scale

                out[y0 * scale:y1 * scale, x0 * scale:x1 * scale] = (
                    enhanced[crop_t:crop_b, crop_l:crop_r, :3]
                )

                done += 1
                job.set_progress(
                    0.18 + 0.78 * done / total,
                    f"Ampliando · bloque {done}/{total}",
                )

        if job.cancelled:
            raise RuntimeError("Cancelado")

        job.set_progress(0.97, "Preparando resultado de 16 bits")
        rgb = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
        rgb = np.ascontiguousarray(rgb.astype("<u2", copy=False))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        rgb.tofile(output_path)

        job.meta.update({
            "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]),
            "channels": 3,
            "dtype": "uint16le",
            "colorSpace": "srgb",
            "scale": scale,
            "model": self.model_id,
            "inputPrecision": 16 if src.dtype == np.uint16 else 8,
        })
        job.set_progress(0.99, "Resultado listo")
        return output_path
