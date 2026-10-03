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
    """Descarga bajo demanda y no expone un modelo hasta validarlo."""

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
        base = MODELS_ROOT / spec["directory"]
        filename = spec.get("filename")
        return base / filename if filename else base

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
            download_type = spec.get("download", {}).get("type")
            if download_type == "huggingface-snapshot":
                return (
                    path.is_dir()
                    and (path / "config.json").is_file()
                    and (
                        (path / "model.safetensors").is_file()
                        or any(path.glob("model-*.safetensors"))
                    )
                    and (
                        (path / "tokenizer.json").is_file()
                        or (path / "tokenizer_config.json").is_file()
                    )
                )
            if download_type in ("huggingface-diffusers", "huggingface-patterns"):
                required = spec.get("download", {}).get("required") or []
                required_globs = spec.get("download", {}).get("requiredGlobs") or []
                if required and not (path.is_dir() and all((path / rel).is_file() for rel in required)):
                    return False
                if required_globs and not all(any(path.glob(pattern)) for pattern in required_globs):
                    return False
                if required or required_globs:
                    return path.is_dir()
                return path.is_dir() and (path / "model_index.json").is_file()
            if not path.is_file():
                return False
            size = path.stat().st_size
            if "bytes" in spec and size != int(spec["bytes"]):
                return False
            if "minBytes" in spec and size < int(spec["minBytes"]):
                return False
            if "sha256" in spec and cls._sha256(path).lower() != str(spec["sha256"]).lower():
                return False
            return size > 0
        except (OSError, KeyError, ValueError):
            return False

    @staticmethod
    def _download_http(spec: dict[str, Any], tmp: Path, progress: Progress | None) -> None:
        req = urllib.request.Request(
            spec["url"],
            headers={"User-Agent": "Realify-AI-Local/0.3"},
        )
        with urllib.request.urlopen(req, timeout=90) as src, tmp.open("wb") as out:
            total = int(src.headers.get("Content-Length") or spec.get("bytes") or 0)
            done = 0
            while True:
                block = src.read(1024 * 1024)
                if not block:
                    break
                out.write(block)
                done += len(block)
                if progress and total:
                    progress(min(0.96, done / max(total, 1)), "Descargando modelo oficial")

    @staticmethod
    def _download_gdrive(spec: dict[str, Any], tmp: Path, progress: Progress | None) -> None:
        try:
            import gdown
        except Exception as exc:
            raise RuntimeError("Falta gdown para descargar el modelo oficial de Google Drive.") from exc

        file_id = spec.get("download", {}).get("id")
        if not file_id:
            raise RuntimeError("El modelo no tiene ID de Google Drive.")

        if progress:
            progress(0.05, "Descargando modelo oficial")
        ok = gdown.download(id=file_id, output=str(tmp), quiet=True)
        if not ok or not tmp.is_file():
            raise RuntimeError("No se pudo descargar el modelo oficial desde Google Drive.")
        if progress:
            progress(0.96, "Descarga completada")

    def ensure(self, model_id: str, progress: Progress | None = None) -> Path:
        spec = self.spec(model_id)
        dest = self.path(model_id)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if self._valid_file(dest, spec):
            if progress:
                progress(1.0, "Modelo verificado")
            return dest

        if dest.exists():
            if dest.is_dir():
                import shutil
                shutil.rmtree(dest, ignore_errors=True)
            else:
                dest.unlink(missing_ok=True)

        if progress:
            progress(0.0, "Descargando modelo oficial")

        download = spec.get("download") or {}
        if download.get("type") in ("huggingface-snapshot", "huggingface-diffusers", "huggingface-patterns"):
            try:
                from huggingface_hub import snapshot_download
            except Exception as exc:
                raise RuntimeError("Falta huggingface_hub para descargar el modelo.") from exc
            is_diffusers = download.get("type") in ("huggingface-diffusers", "huggingface-patterns")
            if progress:
                progress(0.05, "Descargando modelo generativo" if is_diffusers else "Descargando modelo")
            dest.mkdir(parents=True, exist_ok=True)
            kwargs = {
                "repo_id": spec["repository"],
                "revision": spec.get("revision") or "main",
                "local_dir": str(dest),
                "local_dir_use_symlinks": False,
            }
            if download.get("allowPatterns"):
                kwargs["allow_patterns"] = list(download["allowPatterns"])
            elif is_diffusers and spec.get("variant") == "fp16":
                kwargs["allow_patterns"] = [
                    "*.json", "*.txt", "*.model",
                    "tokenizer/*", "tokenizer_2/*", "scheduler/*",
                    "text_encoder/config.json", "text_encoder/model.fp16.safetensors",
                    "text_encoder_2/config.json", "text_encoder_2/model.fp16.safetensors",
                    "unet/config.json", "unet/diffusion_pytorch_model.fp16.safetensors",
                    "vae/config.json", "vae/diffusion_pytorch_model.fp16.safetensors",
                ]
            try:
                snapshot_download(**kwargs)
            except Exception as exc:
                if spec.get("gated"):
                    raise RuntimeError(
                        "FLUX Fill requiere aceptar su licencia en Hugging Face y autenticar este PC "
                        "(hf auth login o variable HF_TOKEN)."
                    ) from exc
                raise
            if not self._valid_file(dest, spec):
                raise RuntimeError("La descarga del modelo está incompleta.")
            if progress:
                progress(1.0, "Modelo generativo disponible" if is_diffusers else "Modelo disponible")
            return dest

        fd, tmp_name = tempfile.mkstemp(prefix=dest.name + ".", suffix=".part", dir=dest.parent)
        os.close(fd)
        tmp = Path(tmp_name)
        try:
            if download.get("type") == "gdrive":
                self._download_gdrive(spec, tmp, progress)
            else:
                self._download_http(spec, tmp, progress)

            if not self._valid_file(tmp, spec):
                raise RuntimeError("La descarga del modelo está incompleta o no supera la validación.")

            if progress and "sha256" in spec:
                progress(0.98, "Verificando SHA-256")
            os.replace(tmp, dest)
        finally:
            tmp.unlink(missing_ok=True)

        if progress:
            progress(1.0, "Modelo descargado y validado")
        return dest
