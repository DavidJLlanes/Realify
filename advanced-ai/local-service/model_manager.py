from __future__ import annotations

import hashlib
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
    """Descarga bajo demanda y no expone un modelo hasta verificarlo."""

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

    @staticmethod
    def _sha256(path: Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as fh:
            for block in iter(lambda: fh.read(1024 * 1024), b""):
                h.update(block)
        return h.hexdigest()

    @classmethod
    def _valid_file(cls, path: Path, spec: dict[str, Any]) -> bool:
        try:
            if not path.is_file() or path.stat().st_size != int(spec["bytes"]):
                return False
            return cls._sha256(path).lower() == str(spec["sha256"]).lower()
        except (OSError, KeyError, ValueError):
            return False

    def ensure(self, model_id: str, progress: Progress | None = None) -> Path:
        spec = self.spec(model_id)
        dest = self.path(model_id)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if self._valid_file(dest, spec):
            if progress:
                progress(1.0, "Modelo verificado")
            return dest

        if dest.exists():
            dest.unlink(missing_ok=True)

        if progress:
            progress(0.0, "Descargando modelo oficial")

        fd, tmp_name = tempfile.mkstemp(prefix=dest.name + ".", suffix=".part", dir=dest.parent)
        os.close(fd)
        tmp = Path(tmp_name)
        try:
            req = urllib.request.Request(
                spec["url"],
                headers={"User-Agent": "Realify-AI-Local/0.2"},
            )
            with urllib.request.urlopen(req, timeout=90) as src, tmp.open("wb") as out:
                total = int(src.headers.get("Content-Length") or spec["bytes"])
                done = 0
                while True:
                    block = src.read(1024 * 1024)
                    if not block:
                        break
                    out.write(block)
                    done += len(block)
                    if progress:
                        progress(min(0.96, done / max(total, 1)), "Descargando modelo oficial")

            if tmp.stat().st_size != int(spec["bytes"]):
                raise RuntimeError("El tamaño del modelo descargado no coincide con el oficial.")

            if progress:
                progress(0.98, "Verificando SHA-256")
            digest = self._sha256(tmp)
            if digest.lower() != str(spec["sha256"]).lower():
                raise RuntimeError("La verificación SHA-256 del modelo ha fallado.")

            os.replace(tmp, dest)
        finally:
            tmp.unlink(missing_ok=True)

        if progress:
            progress(1.0, "Modelo descargado y verificado")
        return dest
