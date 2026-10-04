from __future__ import annotations

import math
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
LOCAL_SERVICE = ROOT / "local-service"
if str(LOCAL_SERVICE) not in sys.path:
    sys.path.insert(0, str(LOCAL_SERVICE))

from model_manager import ModelManager  # noqa: E402
from .nafnet_arch import NAFNet  # noqa: E402

_MANAGER = ModelManager()


class RestorationEngine:
    """NAFNet width64 para restauración fotográfica con CUDA y tiles."""

    def __init__(self, model_id: str, tile: int = 512, overlap: int = 64):
        self.model_id = model_id
        self.spec = _MANAGER.spec(model_id)
        self.tile = max(192, int(tile))
        self.overlap = max(32, int(overlap))
        self._model = None
        self._device = torch.device("cuda:0")

    def release(self) -> None:
        self._model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @staticmethod
    def _state_dict(checkpoint):
        if isinstance(checkpoint, dict):
            for key in ("params_ema", "params", "state_dict"):
                value = checkpoint.get(key)
                if isinstance(value, dict):
                    checkpoint = value
                    break
        if not isinstance(checkpoint, dict):
            raise RuntimeError("El checkpoint NAFNet no contiene un state_dict válido.")
        if checkpoint and all(str(k).startswith("module.") for k in checkpoint):
            checkpoint = {str(k)[7:]: v for k, v in checkpoint.items()}
        return checkpoint

    def _load(self, job):
        if self._model is not None:
            return self._model

        job.set_progress(0.01, "Preparando modelo NAFNet")
        path = _MANAGER.ensure(
            self.model_id,
            lambda p, stage: job.set_progress(0.01 + p * 0.14, stage),
        )
        if job.cancelled:
            raise RuntimeError("Cancelado")

        arch = self.spec["architecture"]
        model = NAFNet(
            img_channel=3,
            width=int(arch["width"]),
            enc_blk_nums=list(arch["enc_blk_nums"]),
            middle_blk_num=int(arch["middle_blk_num"]),
            dec_blk_nums=list(arch["dec_blk_nums"]),
        )
        checkpoint = torch.load(str(path), map_location="cpu", weights_only=False)
        state = self._state_dict(checkpoint)
        model.load_state_dict(state, strict=True)
        model.eval().to(self._device)
        self._model = model
        job.set_progress(0.17, "NAFNet cargado en GPU")
        return model

    @staticmethod
    def _read_input(path: Path, input_format: str, width: int, height: int, channels: int):
        if input_format == "raw16":
            if channels != 3 or width < 1 or height < 1:
                raise RuntimeError("Metadatos raw16 no válidos.")
            expected = width * height * channels
            rgb = np.fromfile(path, dtype="<u2")
            if rgb.size != expected:
                raise RuntimeError("El tamaño del RGB16 recibido no coincide con sus dimensiones.")
            return rgb.reshape((height, width, 3)), 16

        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            raise RuntimeError("No se pudo leer la imagen enviada.")
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
        elif img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
        else:
            img = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2RGB)
        return img, 16 if img.dtype == np.uint16 else 8

    def _infer_tile(self, model, tile_rgb: np.ndarray) -> np.ndarray:
        denom = 65535.0 if tile_rgb.dtype == np.uint16 else 255.0
        arr = np.ascontiguousarray(tile_rgb.astype(np.float32) / denom)
        tensor = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0).to(self._device, non_blocking=True)
        with torch.inference_mode(), torch.autocast(device_type="cuda", dtype=torch.float16):
            pred = model(tensor).clamp_(0, 1)
        out = pred.squeeze(0).permute(1, 2, 0).float().cpu().numpy()
        del tensor, pred
        return np.clip(np.rint(out * 65535.0), 0, 65535).astype(np.uint16)

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
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA no está disponible.")

        model = self._load(job)
        if job.cancelled:
            raise RuntimeError("Cancelado")

        src, input_precision = self._read_input(input_path, input_format, width, height, channels)
        h, w = src.shape[:2]
        out = np.empty((h, w, 3), dtype=np.uint16)

        nx = math.ceil(w / self.tile)
        ny = math.ceil(h / self.tile)
        total = nx * ny
        done = 0

        for ty in range(ny):
            for tx in range(nx):
                if job.cancelled:
                    raise RuntimeError("Cancelado")

                x0, y0 = tx * self.tile, ty * self.tile
                x1, y1 = min(w, x0 + self.tile), min(h, y0 + self.tile)
                ex0, ey0 = max(0, x0 - self.overlap), max(0, y0 - self.overlap)
                ex1, ey1 = min(w, x1 + self.overlap), min(h, y1 + self.overlap)

                restored = self._infer_tile(model, src[ey0:ey1, ex0:ex1])

                crop_l, crop_t = x0 - ex0, y0 - ey0
                crop_r = crop_l + (x1 - x0)
                crop_b = crop_t + (y1 - y0)
                out[y0:y1, x0:x1] = restored[crop_t:crop_b, crop_l:crop_r]

                done += 1
                job.set_progress(
                    0.18 + 0.78 * done / total,
                    f"Restaurando · bloque {done}/{total}",
                )

        if job.cancelled:
            raise RuntimeError("Cancelado")

        job.set_progress(0.97, "Preparando resultado de 16 bits")
        out = np.ascontiguousarray(out.astype("<u2", copy=False))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        out.tofile(output_path)

        job.meta.update({
            "width": int(w),
            "height": int(h),
            "channels": 3,
            "dtype": "uint16le",
            "colorSpace": "srgb",
            "model": self.model_id,
            "task": self.spec["task"],
            "inputPrecision": input_precision,
        })
        job.set_progress(0.99, "Resultado listo")
        return output_path
