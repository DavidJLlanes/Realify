from __future__ import annotations

import json
import os
import tempfile
import urllib.request
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "models" / "registry.json"
MODELS_ROOT = ROOT / "models"

Progress = Callable[[float, str], None]


class ModelManager:
    def __init__(self) -> None:
        with REGISTRY_PATH.open("r", encoding="utf-8") as fh:
            self.registry = json.load(fh)["models"]

    def spec(self, model_id: str) -> dict[str, Any]:
        try:
            return self.registry[model_id]
        except KeyError as exc:
            raise ValueError(f"Modelo desconocido: {model_id}") from exc

    def path(self, model_id: str) -> Path:
        spec = self.spec(model_id)
        return MODELS_ROOT / spec["directory"] / spec["filename"]

    def ensure(self, model_id: str, progress: Progress | None = None) -> Path:
        spec = self.spec(model_id)
        dest = self.path(model_id)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if self._valid_file(dest, spec):
            if progress:
                progress(1.0, "Modelo disponible")
            return dest

        if progress:
            progress(0.0, "Descargando modelo")
        fd, tmp_name = tempfile.mkstemp(prefix=dest.name + ".", suffix=".part", dir=dest.parent)
        os.close(fd)
        tmp = Path(tmp_name)
        try:
            req = urllib.request.Request(spec["url"], headers={"User-Agent": "Realify-AI-Local/0.2"})
            with urllib.request.urlopen(req, timeout=60) as src, tmp.open("wb") as out:
                total = int(src.headers.get("Content-Length") or 0)
                done = 0
                while True:
                    block = src.read(1024 * 1024)
                    if not block:
                        break
                    out.write(block)
                    done += len(block)
                    if progress and total:
                        progress(min(0.99, done / total), "Descargando modelo")
            if not self._valid_file(tmp, spec):
                raise RuntimeError("La descarga del modelo está incompleta o no es válida.")
            tmp.replace(dest)
        finally:
            tmp.unlink(missing_ok=True)

        if progress:
            progress(1.0, "Modelo verificado")
        return dest

    @staticmethod
    def _valid_file(path: Path, spec: dict[str, Any]) -> bool:
        try:
            return path.is_file() and path.stat().st_size >= int(spec.get("minBytes", 1))
        except OSError:
            return False
