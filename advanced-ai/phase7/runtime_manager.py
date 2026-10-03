from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHASE7 = ROOT / "phase7"
RUNTIME = ROOT / "phase7-runtime"
VENDOR = ROOT / "vendor" / "PuLID"
MODELS = ROOT / "models"
REQ = PHASE7 / "requirements.txt"

PULID_REPO = "https://github.com/ToTheBeginning/PuLID.git"
PULID_COMMIT = "1aa2fc7df4bf51080df39f355f9abdc1cbfefbaa"


def _python() -> Path:
    return RUNTIME / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _stamp() -> str:
    h = hashlib.sha256()
    h.update(REQ.read_bytes())
    h.update(PULID_COMMIT.encode())
    return h.hexdigest()


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=False)
    if proc.returncode:
        raise RuntimeError("Falló la preparación del runtime de Fase 7.")


def ensure_runtime(job=None) -> Path:
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (ROOT / "vendor").mkdir(parents=True, exist_ok=True)
    MODELS.mkdir(parents=True, exist_ok=True)

    py = _python()
    stamp_file = RUNTIME / ".ready"
    wanted = _stamp()

    if not py.exists():
        if job: job.set_progress(0.01, "Creando entorno aislado de Fase 7")
        venv.EnvBuilder(with_pip=True, clear=False).create(RUNTIME / "venv")

    if not VENDOR.exists():
        if job: job.set_progress(0.02, "Descargando PuLID oficial")
        _run(["git", "clone", "--filter=blob:none", PULID_REPO, str(VENDOR)])
        _run(["git", "checkout", PULID_COMMIT], cwd=VENDOR)
    else:
        try:
            current = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(VENDOR), text=True).strip()
        except Exception:
            current = ""
        if current != PULID_COMMIT:
            if job: job.set_progress(0.02, "Actualizando PuLID fijado")
            _run(["git", "fetch", "--depth=1", "origin", PULID_COMMIT], cwd=VENDOR)
            _run(["git", "checkout", PULID_COMMIT], cwd=VENDOR)

    if not stamp_file.exists() or stamp_file.read_text(encoding="utf-8").strip() != wanted:
        if job: job.set_progress(0.03, "Instalando dependencias de identidad y control")
        _run([str(py), "-m", "pip", "install", "--upgrade", "pip"])
        _run([str(py), "-m", "pip", "install", "-r", str(REQ)])
        stamp_file.write_text(wanted, encoding="utf-8")

    return py


def phase7_env() -> dict[str, str]:
    env = dict(os.environ)
    cache = MODELS / "hf-cache"
    cache.mkdir(parents=True, exist_ok=True)
    env["HF_HOME"] = str(cache)
    env["HUGGINGFACE_HUB_CACHE"] = str(cache / "hub")
    env["TRANSFORMERS_CACHE"] = str(cache / "transformers")
    env["REALIFY_PHASE7_ROOT"] = str(ROOT)
    env["REALIFY_PULID_VENDOR"] = str(VENDOR)
    return env
