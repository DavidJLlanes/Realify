from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    # Reducir el rectángulo hasta que no contenga ningún píxel negro
    while cv2.countNonZero(sub) > 0:
        minRect = cv2.erode(minRect, None)
        sub = cv2.subtract(minRect, thresh)

    cnts, _ = cv2.findContours(minRect.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        (x, y, w, h) = cv2.boundingRect(c)
        return stitched[y:y + h, x:x + w]
    return image

@app.post("/stitch")
async def stitch_images(
    files: list[UploadFile] = File(...),
    autocrop: bool = Form(True)
):
    imgs = []
    for file in files:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            imgs.append(img)

    if len(imgs) < 2:
        return {"error": "Se necesitan al menos 2 imágenes para crear una panorámica"}

    stitcher = cv2.Stitcher_create()
    status, pano = stitcher.stitch(imgs)

    if status != cv2.Stitcher_OK:
        return {"error": f"Error al coser. Código: {status}"}

    if autocrop:
        try:
            pano = crop_black_borders(pano)
        except Exception:
            pass

    _, encoded_img = cv2.imencode('.jpg', pano, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return Response(content=encoded_img.tobytes(), media_type="image/jpeg")
