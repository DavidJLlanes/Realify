/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · DECODIFICADOR DE RESPALDO «elemento-video»
   Para navegadores sin WebCodecs (o sin el códec por ahí): usa un <video> oculto, busca el instante con `currentTime` y copia el fotograma a un lienzo. Es lento y
   no exacto al fotograma, pero decodifica lo que el navegador sepa reproducir. Misma interfaz que el decodificador principal. Sólo en el hilo principal (no en workers).
   ═══════════════════════════════════════════════════════════════ */
export const id = "elemento-video", prioridad = 10;

const cargar = archivo => new Promise((ok, no) => {
  const url = URL.createObjectURL(archivo), v = document.createElement("video");
  v.muted = true; v.preload = "auto"; v.playsInline = true; v.src = url;
  v.onloadedmetadata = () => ok({ v, url }); v.onerror = () => { URL.revokeObjectURL(url); no(new Error("El navegador no puede reproducir ese vídeo")); };
});
const ir = (v, t) => new Promise(ok => { const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); v.currentTime = t; });

export async function soporta(archivo){
  if(typeof document === "undefined") return false;
  try{ const { v, url } = await cargar(archivo); URL.revokeObjectURL(url); return v.videoWidth > 0; }catch{ return false; }
}

export async function abrir(archivo, { ancho = 0 } = {}){
  const { v, url } = await cargar(archivo); const w = v.videoWidth, h = v.videoHeight, k = ancho && ancho < w ? ancho / w : 1, W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
  const info = { duracion: v.duration, ancho: w, alto: h, fps: 30, codec: null, audio: true };
  const pintar = async t => { await ir(v, Math.max(0, Math.min(t, v.duration - 1e-3))); const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(v, 0, 0, W, H); return { lienzo: c, t: v.currentTime }; };
  return {
    info, fotograma: pintar,
    async *fotogramas(desde = 0, hasta = info.duracion){ for(let t = desde; t < hasta; t += 1 / info.fps) yield await pintar(t); },
    cerrar(){ v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); }
  };
}
