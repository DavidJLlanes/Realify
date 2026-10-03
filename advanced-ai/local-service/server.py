"""Realify AI Local · Fase 2.

Servicio loopback para CUDA/PyTorch. Expone estado, trabajos de upscale,
progreso, cancelación y descarga del resultado.
"""

from __future__ import annotations

import gc
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engines.upscale import UpscaleEngine
from jobs import JobManager

HOST = "127.0.0.1"
PORT = 17834
SERVICE_VERSION = "0.2.0"
MAX_UPLOAD = 160 * 1024 * 1024
RUNTIME = Path(tempfile.gettempdir()) / "realify-ai-local"
RUNTIME.mkdir(parents=True, exist_ok=True)

ALLOWED_ORIGINS = [
    "https://realify.es",
    "https://www.realify.es",
    "http://localhost",
    "http://127.0.0.1",
]

app = FastAPI(title="Realify AI Local", version=SERVICE_VERSION, docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["X-Realify-Client", "Content-Type"],
)

jobs = JobManager(max_workers=1)
_current_engine: UpscaleEngine | None = None
_current_model: str | None = None


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def require_client(value: str | None) -> None:
    if value != "web":
        raise HTTPException(status_code=403, detail="Cliente no autorizado.")


def hardware_status() -> dict[str, Any]:
    try:
        import torch
    except Exception as exc:
        return {
            "ready": False,
            "torchAvailable": False,
            "cuda": False,
            "reason": f"PyTorch no disponible: {type(exc).__name__}",
        }

    cuda = bool(torch.cuda.is_available())
    base: dict[str, Any] = {
        "torchAvailable": True,
        "torch": getattr(torch, "__version__", None),
        "cuda": cuda,
        "cudaVersion": getattr(getattr(torch, "version", None), "cuda", None),
    }
    if not cuda:
        base.update(ready=False, reason="CUDA no está disponible.")
        return base
    try:
        props = torch.cuda.get_device_properties(0)
        major, minor = torch.cuda.get_device_capability(0)
        base.update(
            ready=True,
            gpu=torch.cuda.get_device_name(0),
            vramGB=round(props.total_memory / (1024 ** 3), 2),
            computeCapability=f"{major}.{minor}",
        )
    except Exception as exc:
        base.update(ready=False, reason=f"No se pudo consultar la GPU: {type(exc).__name__}")
    return base


def engine_for(model_id: str, tile: int) -> UpscaleEngine:
    global _current_engine, _current_model
    if _current_engine is not None and _current_model == model_id:
        _current_engine.tile = tile
        return _current_engine

    _current_engine = None
    _current_model = None
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    _current_engine = UpscaleEngine(model_id=model_id, tile=tile)
    _current_model = model_id
    return _current_engine


@app.get("/status")
def status():
    return {
        "service": "realify-ai-local",
        "serviceVersion": SERVICE_VERSION,
        "phase": 2,
        "features": ["upscale-x2", "upscale-x4"],
        **hardware_status(),
    }


@app.post("/jobs/upscale")
async def create_upscale_job(
    image: UploadFile = File(...),
    scale: int = Form(2),
    tile: int = Form(512),
    x_realify_client: str | None = Header(default=None),
):
    require_client(x_realify_client)
    hw = hardware_status()
    if not hw.get("ready"):
        raise HTTPException(status_code=409, detail=hw.get("reason") or "GPU no preparada.")
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Escala no válida.")
    tile = max(128, min(int(tile), 1024))

    suffix = ".png"
    work = RUNTIME / next(tempfile._get_candidate_names())
    work.mkdir(parents=True, exist_ok=False)
    src = work / ("input" + suffix)
    total = 0
    try:
        with src.open("wb") as fh:
            while True:
                chunk = await image.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD:
                    raise HTTPException(status_code=413, detail="La imagen supera el límite local.")
                fh.write(chunk)
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        raise
    finally:
        await image.close()

    model_id = "realesrgan-x2plus" if scale == 2 else "realesrgan-x4plus"
    out = work / "result.png"

    def worker(job):
        try:
            eng = engine_for(model_id, tile)
            return eng.run(job, src, out)
        finally:
            src.unlink(missing_ok=True)

    job = jobs.create("upscale", worker)
    return {"job": job.public(), "scale": scale, "model": model_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str, x_realify_client: str | None = Header(default=None)):
    require_client(x_realify_client)
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    return job.public()


@app.delete("/jobs/{job_id}")
def cancel_job(job_id: str, x_realify_client: str | None = Header(default=None)):
    require_client(x_realify_client)
    job = jobs.cancel(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    return job.public()


@app.get("/jobs/{job_id}/result")
def get_result(job_id: str, x_realify_client: str | None = Header(default=None)):
    require_client(x_realify_client)
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    if job.status != "completed" or not job.result or not job.result.exists():
        raise HTTPException(status_code=409, detail="El resultado todavía no está disponible.")
    return FileResponse(
        path=str(job.result),
        media_type="image/png",
        filename="realify-upscale.png",
        headers={"Cache-Control": "no-store"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
