"""
Unmark · servidor de apoyo para Realify
=======================================

Lo que no cabe en un navegador: relleno con LaMa y regeneración por
difusión. Expone tres rutas, todas multipart → PNG:

  GET  /health                          estado, GPU y motores disponibles
  POST /inpaint     image, mask, backend     relleno de la máscara blanca
  POST /regenerate  image, strength, pipeline, seed, humanize
                                        re-síntesis por difusión

Motores, de mejor a peor, según lo que haya instalado:
  · regeneración: remove-ai-watermarks[qwen-zimage] (InvisibleEngine)
                  → diffusers SDXL img2img (fallback)
  · relleno:      remove-ai-watermarks (backend lama/migan) si expone
                  inpaint por máscara → simple-lama-inpainting → OpenCV
                  Telea (siempre disponible)

Config por variables de entorno:
  UNMARK_TOKEN     token Bearer obligatorio si se define
  UNMARK_ORIGINS   orígenes CORS separados por coma (por defecto
                   https://realify.es y localhost)
  UNMARK_MAX_MP    megapíxeles máximos que se procesan (por defecto 6)
  UNMARK_DEVICE    cuda | cpu (por defecto auto)
"""
from __future__ import annotations

import io
import os
import tempfile
import time
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image

VERSION = "unmark-server 1.0"
TOKEN = os.environ.get("UNMARK_TOKEN", "").strip()
ORIGINS = [o.strip() for o in os.environ.get(
    "UNMARK_ORIGINS", "https://realify.es,https://www.realify.es,http://localhost:8080,http://127.0.0.1:8080"
).split(",") if o.strip()]
MAX_MP = float(os.environ.get("UNMARK_MAX_MP", "6"))
DEVICE = os.environ.get("UNMARK_DEVICE", "").strip() or None

app = FastAPI(title="Unmark", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── autenticación ────────────────────────────────────────────────
def auth(request: Request):
    if not TOKEN:
        return
    h = request.headers.get("authorization", "")
    if h != f"Bearer {TOKEN}":
        raise HTTPException(401, "token incorrecto")


# ── capacidades ──────────────────────────────────────────────────
def has_module(name: str) -> bool:
    try:
        __import__(name)
        return True
    except Exception:
        return False


def gpu_info():
    try:
        import torch
        if torch.cuda.is_available():
            return True, torch.cuda.get_device_name(0)
    except Exception:
        pass
    return False, None


def available_pipelines() -> list[str]:
    out = []
    if has_module("remove_ai_watermarks.invisible_engine"):
        out += ["auto", "qwen-zimage", "sdxl-zimage", "chroma-zimage"]
    if has_module("diffusers"):
        out.append("sdxl-img2img")
    return out


def available_inpaint() -> list[str]:
    out = []
    if has_module("remove_ai_watermarks"):
        out.append("raiw")
    if has_module("simple_lama_inpainting"):
        out.append("lama")
    if has_module("cv2"):
        out.append("cv2")
    return out


@app.get("/health")
def health(_: None = Depends(auth)):
    gpu, name = gpu_info()
    return {
        "ok": True, "version": VERSION, "gpu": gpu, "gpu_name": name,
        "pipelines": available_pipelines(), "inpaint_backends": available_inpaint(),
        "max_mp": MAX_MP,
    }


# ── utilidades de imagen ─────────────────────────────────────────
async def read_image(up: UploadFile) -> Image.Image:
    data = await up.read()
    if len(data) > 60 * 1024 * 1024:
        raise HTTPException(413, "imagen demasiado grande")
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as e:
        raise HTTPException(400, f"imagen ilegible: {e}")
    return im


def fit_mp(im: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    """Reduce a MAX_MP para procesar; devuelve (imagen, tamaño original)."""
    w, h = im.size
    mp = w * h / 1e6
    if mp <= MAX_MP:
        return im, (w, h)
    k = (MAX_MP / mp) ** 0.5
    return im.resize((max(8, int(w * k)), max(8, int(h * k))), Image.LANCZOS), (w, h)


def to_png(im: Image.Image) -> Response:
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=False, compress_level=3)
    return Response(content=buf.getvalue(), media_type="image/png")


# ── relleno ──────────────────────────────────────────────────────
def inpaint_cv2(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    import cv2
    radius = max(3, int(0.01 * min(rgb.shape[:2])))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, mask, radius, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB)


_lama = None


def inpaint_lama(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    global _lama
    from simple_lama_inpainting import SimpleLama
    if _lama is None:
        _lama = SimpleLama()
    out = _lama(Image.fromarray(rgb), Image.fromarray(mask))
    return np.asarray(out.convert("RGB"))


def inpaint_raiw(rgb: np.ndarray, mask: np.ndarray, backend: str) -> Optional[np.ndarray]:
    """Relleno por regiones con el proyecto de referencia, si su API
    acepta regiones explícitas. Se convierten las componentes de la
    máscara en cajas y se llama a remove_visible con ellas."""
    try:
        import cv2
        import remove_ai_watermarks as raiw
    except Exception:
        return None
    n, _, stats, _ = cv2.connectedComponentsWithStats((mask > 127).astype(np.uint8), 8)
    regions = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area >= 4:
            regions.append((int(x), int(y), int(w), int(h)))
    if not regions:
        return rgb
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.png"
        dst = Path(td) / "out.png"
        Image.fromarray(rgb).save(src)
        kwargs = {"backend": backend if backend in ("cv2", "migan", "lama") else "auto",
                  "strip_metadata": False}
        try:
            raiw.remove_visible(str(src), str(dst), regions=regions, **kwargs)
        except TypeError:
            try:
                raiw.remove_visible(str(src), str(dst), region=regions, **kwargs)
            except Exception:
                return None
        except Exception:
            return None
        if not dst.exists():
            return None
        return np.asarray(Image.open(dst).convert("RGB"))


@app.post("/inpaint")
async def inpaint(image: UploadFile = File(...), mask: UploadFile = File(...),
                  backend: str = Form("auto"), _: None = Depends(auth)):
    t0 = time.time()
    im = (await read_image(image)).convert("RGB")
    mk = (await read_image(mask)).convert("L")
    if mk.size != im.size:
        mk = mk.resize(im.size, Image.NEAREST)
    rgb = np.asarray(im)
    m = (np.asarray(mk) > 127).astype(np.uint8) * 255
    if not m.any():
        return to_png(im)

    out = None
    order = {"auto": ["raiw", "lama", "cv2"], "lama": ["raiw", "lama", "cv2"],
             "migan": ["raiw", "lama", "cv2"], "cv2": ["cv2"]}.get(backend, ["raiw", "lama", "cv2"])
    for eng in order:
        try:
            if eng == "raiw" and has_module("remove_ai_watermarks"):
                out = inpaint_raiw(rgb, m, backend)
            elif eng == "lama" and has_module("simple_lama_inpainting"):
                out = inpaint_lama(rgb, m)
            elif eng == "cv2" and has_module("cv2"):
                out = inpaint_cv2(rgb, m)
        except Exception as e:  # el siguiente motor lo intenta
            print(f"[inpaint] {eng}: {e}")
            out = None
        if out is not None:
            break
    if out is None:
        raise HTTPException(500, "ningún motor de relleno disponible (instala opencv-python o simple-lama-inpainting)")
    # Sólo se sustituye dentro de la máscara: fuera, píxel original
    mm = (m > 127)[..., None]
    res = np.where(mm, out, rgb).astype(np.uint8)
    print(f"[inpaint] {im.size} · {int((m > 127).sum())} px · {time.time() - t0:.1f}s")
    return to_png(Image.fromarray(res))


# ── regeneración ─────────────────────────────────────────────────
_engines: dict[str, object] = {}


def regen_raiw(im: Image.Image, strength: float, pipeline: str, seed: int, humanize: bool) -> Image.Image:
    from remove_ai_watermarks.invisible_engine import InvisibleEngine
    key = pipeline
    if key not in _engines:
        _engines[key] = InvisibleEngine(pipeline=pipeline, device=DEVICE)
    engine = _engines[key]
    opts = None
    try:
        from remove_ai_watermarks.invisible_engine import InvisibleOptions
        try:
            opts = InvisibleOptions(strength=strength, seed=seed, humanize=humanize, pipeline=pipeline)
        except TypeError:
            opts = InvisibleOptions()
            for k, v in (("strength", strength), ("seed", seed), ("humanize", humanize), ("pipeline", pipeline)):
                if hasattr(opts, k):
                    setattr(opts, k, v)
    except Exception:
        opts = None
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.png"
        dst = Path(td) / "out.png"
        im.save(src)
        # La firma exacta varía entre versiones del proyecto: se prueban
        # las formas conocidas antes de rendirse.
        calls = []
        if opts is not None:
            calls.append(lambda: engine.remove_watermark(src, dst, options=opts))
            calls.append(lambda: engine.remove_watermark(src, dst, opts))
        calls.append(lambda: engine.remove_watermark(src, dst, strength=strength, seed=seed))
        calls.append(lambda: engine.remove_watermark(src, dst))
        tried = []
        for call in calls:
            try:
                call()
                if dst.exists():
                    return Image.open(dst).convert("RGB")
            except TypeError as e:
                tried.append(str(e))
                continue
        raise RuntimeError("InvisibleEngine.remove_watermark: firma no reconocida · " + " | ".join(tried[-2:]))


_sdxl = None


def regen_sdxl(im: Image.Image, strength: float, seed: int) -> Image.Image:
    """Alternativa sin el proyecto de referencia: SDXL img2img guiado por
    la propia imagen. Menos fiel que un ControlNet, pero regenera."""
    global _sdxl
    import torch
    from diffusers import StableDiffusionXLImg2ImgPipeline
    dev = DEVICE or ("cuda" if torch.cuda.is_available() else "cpu")
    if _sdxl is None:
        _sdxl = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            os.environ.get("UNMARK_SDXL", "stabilityai/stable-diffusion-xl-base-1.0"),
            torch_dtype=torch.float16 if dev == "cuda" else torch.float32,
            variant="fp16" if dev == "cuda" else None,
        ).to(dev)
        if dev == "cuda":
            try:
                _sdxl.enable_model_cpu_offload()
            except Exception:
                pass
    w, h = im.size
    # SDXL trabaja en múltiplos de 8; se ajusta y se devuelve al tamaño real
    w8, h8 = max(64, w // 8 * 8), max(64, h // 8 * 8)
    g = torch.Generator(device="cpu").manual_seed(int(seed))
    out = _sdxl(
        prompt="photograph, natural light, realistic, detailed",
        negative_prompt="cartoon, painting, text, watermark, logo, blurry",
        image=im.resize((w8, h8), Image.LANCZOS),
        strength=float(max(0.05, min(0.6, strength))),
        guidance_scale=4.5, num_inference_steps=28, generator=g,
    ).images[0]
    return out.resize((w, h), Image.LANCZOS)


@app.post("/regenerate")
async def regenerate(image: UploadFile = File(...), strength: float = Form(0.35),
                     pipeline: str = Form("auto"), seed: int = Form(0), humanize: str = Form("1"),
                     _: None = Depends(auth)):
    t0 = time.time()
    im = (await read_image(image)).convert("RGB")
    work, size = fit_mp(im)
    strength = float(max(0.0, min(1.0, strength)))
    pipes = available_pipelines()
    if not pipes:
        raise HTTPException(501, "sin motor de difusión: instala remove-ai-watermarks[qwen-zimage] o diffusers")
    chosen = pipeline if pipeline in pipes else ("auto" if "auto" in pipes else pipes[0])
    try:
        if chosen == "sdxl-img2img":
            out = regen_sdxl(work, strength, seed)
        else:
            out = regen_raiw(work, strength, chosen, seed, humanize == "1")
    except Exception as e:
        raise HTTPException(500, f"regeneración fallida ({chosen}): {e}")
    if out.size != size:
        out = out.resize(size, Image.LANCZOS)
    print(f"[regenerate] {size} · {chosen} · fuerza {strength:.2f} · {time.time() - t0:.1f}s")
    return to_png(out)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("UNMARK_PORT", "8765")))
