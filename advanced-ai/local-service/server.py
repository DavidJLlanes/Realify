"""Realify AI Local · Fase 5.

Servicio loopback CUDA/PyTorch para upscale, restauración e interpretación de prompts.
"""

from __future__ import annotations

import gc
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable

from fastapi import Body, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engines.upscale import UpscaleEngine
from engines.restoration import RestorationEngine
from engines.prompt_engine import PromptEngine
from engines.segmentation import SegmentationEngine
from jobs import JobManager

HOST = "127.0.0.1"
PORT = 17834
SERVICE_VERSION = "0.5.0"
MAX_UPLOAD = 256 * 1024 * 1024
RUNTIME = ROOT / "local-service" / "runtime"
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
_current_engine: Any = None
_current_key: str | None = None


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


def switch_engine(key: str, factory: Callable[[], Any], tile: int):
    global _current_engine, _current_key
    if _current_engine is not None and _current_key == key:
        if hasattr(_current_engine, "tile"):
            _current_engine.tile = tile
        return _current_engine

    old = _current_engine
    _current_engine = None
    _current_key = None
    try:
        old.release()
    except Exception:
        pass
    del old
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    _current_engine = factory()
    _current_key = key
    return _current_engine


def validate_input(input_format: str, width: int, height: int, channels: int) -> None:
    if input_format not in ("png", "raw16"):
        raise HTTPException(status_code=400, detail="Formato de entrada no válido.")
    if input_format == "raw16" and (width < 1 or height < 1 or channels != 3):
        raise HTTPException(status_code=400, detail="Metadatos raw16 no válidos.")


async def save_upload(
    image: UploadFile,
    *,
    work: Path,
    input_format: str,
    width: int,
    height: int,
    channels: int,
) -> Path:
    src = work / ("input.rgb16" if input_format == "raw16" else "input.png")
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

    if input_format == "raw16":
        expected = int(width) * int(height) * 3 * 2
        if total != expected:
            shutil.rmtree(work, ignore_errors=True)
            raise HTTPException(status_code=400, detail="El tamaño del RGB16 no coincide con sus dimensiones.")
    return src


@app.get("/status")
def status():
    return {
        "service": "realify-ai-local",
        "serviceVersion": SERVICE_VERSION,
        "phase": 5,
        "features": [
            "upscale-x2", "upscale-x4", "rgb16-transport",
            "denoise-nafnet", "deblur-nafnet", "prompt-adjustments", "segment-sam2",
        ],
        **hardware_status(),
    }


@app.post("/jobs/upscale")
async def create_upscale_job(
    image: UploadFile = File(...),
    scale: int = Form(2),
    tile: int = Form(512),
    input_format: str = Form("png"),
    width: int = Form(0),
    height: int = Form(0),
    channels: int = Form(3),
    x_realify_client: str | None = Header(default=None),
):
    require_client(x_realify_client)
    hw = hardware_status()
    if not hw.get("ready"):
        raise HTTPException(status_code=409, detail=hw.get("reason") or "GPU no preparada.")
    if scale not in (2, 4):
        raise HTTPException(status_code=400, detail="Escala no válida.")
    validate_input(input_format, width, height, channels)

    tile = max(128, min(int(tile), 1024))
    work = RUNTIME / next(tempfile._get_candidate_names())
    work.mkdir(parents=True, exist_ok=False)
    src = await save_upload(
        image, work=work, input_format=input_format,
        width=width, height=height, channels=channels,
    )

    model_id = "realesrgan-x2plus" if scale == 2 else "realesrgan-x4plus"
    out = work / "result.rgb16"

    def worker(job):
        try:
            eng = switch_engine(
                "upscale:" + model_id,
                lambda: UpscaleEngine(model_id=model_id, tile=tile),
                tile,
            )
            return eng.run(
                job, src, out,
                input_format=input_format,
                width=int(width), height=int(height), channels=int(channels),
            )
        finally:
            src.unlink(missing_ok=True)

    job = jobs.create("upscale", worker)
    return {"job": job.public(), "scale": scale, "model": model_id}


@app.post("/jobs/restore")
async def create_restore_job(
    image: UploadFile = File(...),
    mode: str = Form(...),
    tile: int = Form(512),
    input_format: str = Form("png"),
    width: int = Form(0),
    height: int = Form(0),
    channels: int = Form(3),
    x_realify_client: str | None = Header(default=None),
):
    require_client(x_realify_client)
    hw = hardware_status()
    if not hw.get("ready"):
        raise HTTPException(status_code=409, detail=hw.get("reason") or "GPU no preparada.")
    if mode not in ("denoise", "deblur"):
        raise HTTPException(status_code=400, detail="Modo de restauración no válido.")
    validate_input(input_format, width, height, channels)

    tile = max(192, min(int(tile), 768))
    work = RUNTIME / next(tempfile._get_candidate_names())
    work.mkdir(parents=True, exist_ok=False)
    src = await save_upload(
        image, work=work, input_format=input_format,
        width=width, height=height, channels=channels,
    )

    model_id = "nafnet-sidd-width64" if mode == "denoise" else "nafnet-gopro-width64"
    out = work / "result.rgb16"

    def worker(job):
        try:
            eng = switch_engine(
                "restore:" + model_id,
                lambda: RestorationEngine(model_id=model_id, tile=tile, overlap=64),
                tile,
            )
            return eng.run(
                job, src, out,
                input_format=input_format,
                width=int(width), height=int(height), channels=int(channels),
            )
        finally:
            src.unlink(missing_ok=True)

    job = jobs.create(mode, worker)
    return {"job": job.public(), "mode": mode, "model": model_id}



@app.post("/jobs/segment")
async def create_segment_job(
    image: UploadFile = File(...),
    points_json: str = Form(...),
    labels_json: str = Form(...),
    invert: bool = Form(False),
    input_format: str = Form("png"),
    width: int = Form(0),
    height: int = Form(0),
    channels: int = Form(3),
    x_realify_client: str | None = Header(default=None),
):
    import json
    require_client(x_realify_client)
    hw = hardware_status()
    if not hw.get("ready"):
        raise HTTPException(status_code=409, detail=hw.get("reason") or "GPU no preparada.")
    validate_input(input_format, width, height, channels)
    try:
        points = json.loads(points_json)
        labels = json.loads(labels_json)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Puntos de segmentación no válidos.") from exc
    if not isinstance(points, list) or not isinstance(labels, list) or len(points) != len(labels):
        raise HTTPException(status_code=400, detail="Puntos y etiquetas no coinciden.")
    if len(points) < 1 or len(points) > 64:
        raise HTTPException(status_code=400, detail="Usa entre 1 y 64 puntos de refinado.")

    work = RUNTIME / next(tempfile._get_candidate_names())
    work.mkdir(parents=True, exist_ok=False)
    src = await save_upload(
        image, work=work, input_format=input_format,
        width=width, height=height, channels=channels,
    )
    out = work / "result.mask8"

    def worker(job):
        try:
            eng = switch_engine(
                "segment:sam2.1-hiera-large",
                lambda: SegmentationEngine(),
                0,
            )
            return eng.run(
                job, src, out,
                input_format=input_format,
                width=int(width), height=int(height),
                points=points, labels=labels, invert=bool(invert),
            )
        finally:
            src.unlink(missing_ok=True)

    job = jobs.create("segment", worker)
    return {"job": job.public(), "model": "sam2.1-hiera-large"}


@app.get("/jobs/{job_id}/mask")
def get_mask_result(job_id: str, x_realify_client: str | None = Header(default=None)):
    require_client(x_realify_client)
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    if job.status != "completed" or not job.result or not job.result.exists():
        raise HTTPException(status_code=409, detail="La máscara todavía no está disponible.")
    meta = job.meta
    if meta.get("task") != "segment":
        raise HTTPException(status_code=400, detail="El trabajo no contiene una máscara.")
    return FileResponse(
        path=str(job.result),
        media_type="application/octet-stream",
        filename="realify-sam2-mask.raw",
        headers={
            "Cache-Control": "no-store",
            "X-Realify-Width": str(meta.get("width", 0)),
            "X-Realify-Height": str(meta.get("height", 0)),
            "X-Realify-Dtype": "uint8",
            "X-Realify-Model": str(meta.get("model", "")),
            "Access-Control-Expose-Headers": "X-Realify-Width, X-Realify-Height, X-Realify-Dtype, X-Realify-Model",
        },
    )


@app.post("/prompt/adjust")
def interpret_adjustment_prompt(
    payload: dict[str, Any] = Body(...),
    x_realify_client: str | None = Header(default=None),
):
    require_client(x_realify_client)
    hw = hardware_status()
    if not hw.get("ready"):
        raise HTTPException(status_code=409, detail=hw.get("reason") or "GPU no preparada.")

    prompt = str(payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="El prompt está vacío.")
    if len(prompt) > 2000:
        raise HTTPException(status_code=400, detail="El prompt es demasiado largo.")

    try:
        engine = switch_engine(
            "prompt:qwen3-1.7b",
            lambda: PromptEngine(),
            0,
        )
        return engine.parse(prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo interpretar el prompt: {exc}") from exc


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

    meta = job.meta
    return FileResponse(
        path=str(job.result),
        media_type="application/octet-stream",
        filename="realify-ai-result.rgb16",
        headers={
            "Cache-Control": "no-store",
            "X-Realify-Width": str(meta.get("width", 0)),
            "X-Realify-Height": str(meta.get("height", 0)),
            "X-Realify-Channels": str(meta.get("channels", 3)),
            "X-Realify-Dtype": str(meta.get("dtype", "uint16le")),
            "X-Realify-Input-Precision": str(meta.get("inputPrecision", 8)),
            "X-Realify-Model": str(meta.get("model", "")),
            "X-Realify-Task": str(meta.get("task", job.kind)),
            "Access-Control-Expose-Headers": "X-Realify-Width, X-Realify-Height, X-Realify-Channels, X-Realify-Dtype, X-Realify-Input-Precision, X-Realify-Model, X-Realify-Task",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
