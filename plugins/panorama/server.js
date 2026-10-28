/* ═══════════════════════════════════════════════════════════════
   PANORÁMICA · COSIDO EN EL SERVIDOR (respaldo opcional)
   Si el cosido en el dispositivo falla, la ventana puede ofrecer, con
   permiso expreso del usuario, enviar las fotos al servicio de
   server/panorama (FastAPI + OpenCV Stitcher). Las fotos no se guardan.
   ═══════════════════════════════════════════════════════════════ */

const canvasToBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));

/**
 * Une las fotos en el servidor. `photos`: [{ file?, full }] — se envía el archivo original si lo hay, o el lienzo en JPEG.
 * Devuelve el lienzo con el resultado; lanza Error con el mensaje del servidor si falla.
 */
export async function stitchOnServer(photos, { autoCrop = true } = {}){
  const formData = new FormData();
  formData.append("autocrop", autoCrop ? "true" : "false");
  for(let i = 0; i < photos.length; i++){
    const p = photos[i];
    if(p.file) formData.append("files", p.file, p.file.name);
    else formData.append("files", await canvasToBlob(p.full), `photo_${i}.jpg`);
  }

  const res = await fetch("/api/stitch", { method: "POST", body: formData });
  const contentType = res.headers.get("content-type") || "";
  if(!res.ok || contentType.includes("application/json")){
    let msg = "El servidor respondió con código " + res.status;
    try{ const json = await res.json(); if(json.error) msg = json.error; }catch{}
    throw new Error(msg);
  }

  const url = URL.createObjectURL(await res.blob());
  try{
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}
