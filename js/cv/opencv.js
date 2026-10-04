/* ═══════════════════════════════════════════════════════════════
   OPENCV.JS BAJO DEMANDA (fase 7 de PENDIENTE.md)
   OpenCV 4.12 (Apache-2.0, ~11 MB) sólo se descarga al usar una
   herramienta que lo necesita, avisando antes del tamaño. Después
   queda en la caché del navegador / service worker.

   OJO: `cv` es «thenable» (tiene `.then`): devolverlo desde una
   promesa o hacer `await cv` no termina nunca. Aquí se devuelve
   siempre envuelto en `{ cv }`.
   ═══════════════════════════════════════════════════════════════ */

import { confirmDlg } from "../ui/dialog.js";

const SIZE_MB = 11, KEY = "realify.opencvAsked";
let loading = null;

export const opencvReady = () => typeof window.cv !== "undefined" && typeof window.cv.Mat === "function";

/** Carga OpenCV.js. `ask`: avisar del tamaño la primera vez (devuelve null si se rechaza). */
export function loadOpenCv({ ask = true } = {}){
  if(opencvReady()) return Promise.resolve({ cv: window.cv });
  if(loading) return loading;
  loading = (async () => {
    let asked = false; try{ asked = localStorage.getItem(KEY) === "1"; }catch{}
    if(ask && !asked){
      const ok = await confirmDlg("Descargar OpenCV", `Esta herramienta usa OpenCV (${SIZE_MB} MB, una sola vez). Se guarda en el dispositivo y funciona sin conexión después.`, "Descargar");
      if(!ok) return null;
      try{ localStorage.setItem(KEY, "1"); }catch{}
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = new URL("../vendor/opencv/opencv.js", import.meta.url).href;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo descargar OpenCV. Comprueba la conexión."));
      document.head.appendChild(s);
    });
    const t0 = Date.now();
    while(!opencvReady()){
      if(Date.now() - t0 > 60000) throw new Error("OpenCV no arrancó");
      await new Promise(r => setTimeout(r, 30));
    }
    return { cv: window.cv };
  })().finally(() => { loading = null; });
  return loading;
}
