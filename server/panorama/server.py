"""
Servicio de panorámicas de Realify · POST /stitch
=================================================
FastAPI + OpenCV Stitcher. nginx le pasa sólo /api/stitch; escucha en 127.0.0.1.

Límites (variables de entorno opcionales):
  PANO_MAX_FILES   fotos por petición (20)
  PANO_MAX_MB      MB por foto (40)
  PANO_MAX_MP      megapíxeles por foto; mayores se reducen (24)
  PANO_ORIGINS     orígenes CORS separados por coma (https://realify.es,https://www.realify.es)

Los errores usan códigos HTTP reales (400/413/422) con {"error": "..."}.
Los endpoints son `def` (no `async def`): FastAPI los ejecuta en un hilo y el
trabajo de CPU del Stitcher no bloquea el servidor.
"""
import os
import threading

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

MAX_FILES = int(os.environ.get("PANO_MAX_FILES", "20"))
MAX_BYTES = int(os.environ.get("PANO_MAX_MB", "40")) * 1024 * 1024
MAX_MP = float(os.environ.get("PANO_MAX_MP", "24"))
ORIGINS = [o.strip() for o in os.environ.get(
    "PANO_ORIGINS", "https://realify.es,https://www.realify.es").split(",") if o.strip()]

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Un solo cosido a la vez por proceso: el Stitcher usa varios núcleos y mucha memoria.
_busy = threading.Semaphore(1)


def fail(code, msg):
    return JSONResponse({"error": msg}, status_code=code)


def crop_black_borders(image):
    # Añadir un borde de 10px para asegurar contornos cerrados
    stitched = cv2.copyMakeBorder(image, 10, 10, 10, 10, cv2.BORDER_CONSTANT, (0, 0, 0))
    gray = cv2.cvtColor(stitched, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY)[1]

    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return image

    c = max(cnts, key=cv2.contourArea)
    mask = np.zeros(thresh.shape, dtype="uint8")
    (x, y, w, h) = cv2.boundingRect(c)
    cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)

    minRect = mask.copy()
    sub = mask.copy()

    # Reducir el rectángulo hasta que no contenga ningún píxel negro (1 px por paso).
    # El número de pasos está acotado para que una panorámica enorme no bloquee el servicio.
    for _ in range(3000):
        if cv2.countNonZero(sub) == 0:
            break
        minRect = cv2.erode(minRect, None)
        sub = cv2.subtract(minRect, thresh)

    cnts, _ = cv2.findContours(minRect.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        (x, y, w, h) = cv2.boundingRect(c)
        return stitched[y:y + h, x:x + w]
    return image


def decode(contents):
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    h, w = img.shape[:2]
    mp = w * h / 1e6
    if mp > MAX_MP:
        k = (MAX_MP / mp) ** 0.5
        img = cv2.resize(img, (max(8, int(w * k)), max(8, int(h * k))), interpolation=cv2.INTER_AREA)
    return img


@app.get("/stitch/salud")
def salud():
    return {"ok": True}


@app.post("/stitch")
def stitch_images(files: list[UploadFile] = File(...), autocrop: bool = Form(True)):
    if len(files) > MAX_FILES:
        return fail(413, f"Demasiadas fotos (máximo {MAX_FILES})")
    imgs = []
    for file in files:
        contents = file.file.read(MAX_BYTES + 1)
        if len(contents) > MAX_BYTES:
            return fail(413, f"Una foto supera {MAX_BYTES // (1024 * 1024)} MB")
        img = decode(contents)
        if img is not None:
            imgs.append(img)

    if len(imgs) < 2:
        return fail(422, "Se necesitan al menos 2 imágenes para crear una panorámica")

    if not _busy.acquire(timeout=120):
        return fail(503, "Servicio ocupado, inténtalo de nuevo en un momento")
    try:
        stitcher = cv2.Stitcher_create()
        status, pano = stitcher.stitch(imgs)
        if status != cv2.Stitcher_OK:
            return fail(422, f"No se pudo coser la panorámica (código {status}): comprueba que las fotos se solapan")
        if autocrop:
            try:
                pano = crop_black_borders(pano)
            except Exception:
                pass
        _, encoded_img = cv2.imencode('.jpg', pano, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    finally:
        _busy.release()
    return Response(content=encoded_img.tobytes(), media_type="image/jpeg")
