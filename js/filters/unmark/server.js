/* ══════════════════════════════════════════════════════════════
   UNMARK · CLIENTE DEL SERVIDOR PROPIO
   Lo único de toda la aplicación que sale a la red, y sólo si el
   usuario escribe aquí la dirección de SU servidor. Dos trabajos
   que no caben en un navegador: el relleno con LaMa / MI-GAN y la
   regeneración por difusión. El contrato es el de server/unmark
   (FastAPI): multipart con la imagen en PNG, respuesta en PNG.

   La CSP del sitio (`connect-src`) tiene que incluir el origen del
   servidor; la nota está en .htaccess y en server/unmark/README.md.
   ══════════════════════════════════════════════════════════════ */

const LS_KEY = "realify.unmark.server";

export const serverConfig = { url: "", token: "", timeout: 240 };
try{ Object.assign(serverConfig, JSON.parse(localStorage.getItem(LS_KEY) || "{}")); }catch{}

export function saveServerConfig(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(serverConfig)); }catch{}
}

export const serverConfigured = () => /^https?:\/\/\S+/i.test(serverConfig.url.trim());

const base = () => serverConfig.url.trim().replace(/\/+$/, "");
const headers = () => serverConfig.token ? { Authorization: "Bearer " + serverConfig.token.trim() } : {};

function toPngBlob(canvas){
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("No se pudo codificar la imagen")), "image/png"));
}

async function blobToCanvas(blob){
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d").drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

async function post(path, form, onStatus, signal){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(20, serverConfig.timeout) * 1000);
  if(signal) signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  try{
    const r = await fetch(base() + path, { method: "POST", body: form, headers: headers(), signal: ctrl.signal, mode: "cors" });
    if(!r.ok){
      let msg = `${r.status} ${r.statusText}`;
      try{ const j = await r.json(); if(j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); }catch{}
      throw new Error("Servidor: " + msg);
    }
    return r;
  }catch(err){
    if(err.name === "AbortError") throw new Error("El servidor no respondió a tiempo");
    if(err instanceof TypeError) throw new Error("No se pudo conectar con el servidor (¿CSP connect-src, CORS o dirección?)");
    throw err;
  }finally{ clearTimeout(t); }
}

export async function health(){
  if(!serverConfigured()) throw new Error("Sin dirección de servidor");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try{
    const r = await fetch(base() + "/health", { headers: headers(), signal: ctrl.signal, mode: "cors" });
    if(!r.ok) throw new Error(`Servidor: ${r.status} ${r.statusText}`);
    return await r.json();
  }catch(err){
    if(err.name === "AbortError") throw new Error("El servidor no responde");
    if(err instanceof TypeError) throw new Error("No se pudo conectar (¿CSP connect-src, CORS, HTTPS o dirección?)");
    throw err;
  }finally{ clearTimeout(t); }
}

/**
 * Regeneración por difusión. Devuelve un canvas del mismo tamaño.
 * @param {HTMLCanvasElement} canvas
 * @param {{strength:number, pipeline:string, seed:number, humanize:boolean}} o
 */
export async function regenerate(canvas, o, onStatus = () => {}, signal){
  if(!serverConfigured()) throw new Error("Servidor no configurado");
  onStatus("Enviando al servidor…");
  const form = new FormData();
  form.append("image", await toPngBlob(canvas), "image.png");
  form.append("strength", String(o.strength));
  form.append("pipeline", o.pipeline || "auto");
  form.append("seed", String(o.seed | 0));
  form.append("humanize", o.humanize ? "1" : "0");
  const r = await post("/regenerate", form, onStatus, signal);
  onStatus("Recibiendo…");
  const out = await blobToCanvas(await r.blob());
  if(out.width !== canvas.width || out.height !== canvas.height){
    const c = document.createElement("canvas");
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(out, 0, 0, c.width, c.height);
    return c;
  }
  return out;
}

/** Relleno remoto (LaMa / MI-GAN / cv2) de la máscara blanca. */
export async function inpaintRemote(canvas, maskCanvas, o, onStatus = () => {}, signal){
  if(!serverConfigured()) throw new Error("Servidor no configurado");
  onStatus("Enviando la zona al servidor…");
  const form = new FormData();
  form.append("image", await toPngBlob(canvas), "image.png");
  form.append("mask", await toPngBlob(maskCanvas), "mask.png");
  form.append("backend", o.backend || "auto");
  const r = await post("/inpaint", form, onStatus, signal);
  onStatus("Recibiendo…");
  return blobToCanvas(await r.blob());
}
