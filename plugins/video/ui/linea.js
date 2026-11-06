/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · LÍNEA DE TIEMPO (lienzo)
   Dibuja pistas, clips, regla y cabezal, y traduce el ratón y el dedo en acciones: tocar un clip lo selecciona, arrastrarlo lo mueve (se confirma al soltar), arrastrar el fondo o la regla
   mueve el cabezal, rueda con Ctrl o botones hacen zoom, rueda sola desplaza. Sin lógica de edición: avisa con callbacks. Entradas: { contenedor, obtener():{p,sel,t}, vista(), alVista(v),
   alBuscar(t), alSeleccionar(id|null), alMover(id, inicio, idPista) }. Salida: { dibujar(), dispose() }.
   ═══════════════════════════════════════════════════════════════ */
import { finClip } from "../project/modelo.js";
import { tAPx, pxAT, zoomEn, desplazar, imantar } from "../timeline/vista.js";

const ALTO_FILA = 44, ALTO_REGLA = 22, COLORES = { video: ["#3d6fd1", "#6794ff"], audio: ["#2f9e6e", "#5fd3a0"] };
const paso = pps => { for(const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if(s * pps >= 70) return s; return 600; };
export const etiquetaTiempo = t => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function crearLinea({ contenedor, obtener, vista, alVista, alBuscar, alSeleccionar, alMover }){
  const cv = document.createElement("canvas"); cv.className = "vid-linea-cv"; contenedor.appendChild(cv);
  let drag = null, dpr = 1;
  const filas = () => obtener().p.pistas;
  function dibujar(){
    const { p, sel, t } = obtener(), v = vista(), w = contenedor.clientWidth, h = ALTO_REGLA + Math.max(2, filas().length) * ALTO_FILA + 6;
    dpr = Math.min(2, devicePixelRatio || 1); cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = "#0d0f12"; x.fillRect(0, 0, w, h);
    x.font = "10px system-ui"; x.textBaseline = "middle"; const s = paso(v.pps);
    x.fillStyle = "#9ca5b3"; x.strokeStyle = "#2b3038";
    for(let k = Math.ceil(v.desde / s); k * s <= pxAT(v, w); k++){ const px = tAPx(v, k * s); x.beginPath(); x.moveTo(px, ALTO_REGLA - 6); x.lineTo(px, h); x.stroke(); x.fillText(etiquetaTiempo(k * s), px + 3, 9); }
    filas().forEach((pista, i) => {
      const y = ALTO_REGLA + i * ALTO_FILA; x.fillStyle = i % 2 ? "#12151a" : "#0f1216"; x.fillRect(0, y, w, ALTO_FILA);
      for(const c of pista.clips){
        const off = drag && drag.id === c.id ? drag : null, ini = off ? off.inicio : c.inicio, fila = off ? off.fila : i, yy = ALTO_REGLA + fila * ALTO_FILA;
        const x0 = tAPx(v, ini), x1 = tAPx(v, ini + (finClip(c) - c.inicio)); if(x1 < 0 || x0 > w) continue;
        x.fillStyle = (COLORES[pista.tipo] || COLORES.video)[c.id === sel ? 1 : 0]; x.globalAlpha = off ? 0.75 : 1; x.beginPath(); x.roundRect(x0 + 1, yy + 4, Math.max(3, x1 - x0 - 2), ALTO_FILA - 8, 5); x.fill(); x.globalAlpha = 1;
        if(c.id === sel){ x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke(); x.lineWidth = 1; }
        x.fillStyle = "#fff"; x.save(); x.beginPath(); x.rect(x0 + 1, yy, Math.max(0, x1 - x0 - 2), ALTO_FILA); x.clip(); x.font = "600 11px system-ui"; x.fillText(`${p.medios[c.medio]?.nombre || "?"}${c.velocidad !== 1 ? " · " + c.velocidad + "×" : ""}${c.efectos.length ? " ✦" : ""}`, x0 + 8, yy + ALTO_FILA / 2); x.restore();
      }
    });
    const ph = tAPx(v, t); x.strokeStyle = "#ff5a5a"; x.lineWidth = 2; x.beginPath(); x.moveTo(ph, 0); x.lineTo(ph, h); x.stroke(); x.lineWidth = 1; x.fillStyle = "#ff5a5a"; x.beginPath(); x.moveTo(ph - 6, 0); x.lineTo(ph + 6, 0); x.lineTo(ph, 9); x.fill();
  }
  function clipEnPunto(px, py){
    const v = vista(), fila = Math.floor((py - ALTO_REGLA) / ALTO_FILA); if(fila < 0 || fila >= filas().length) return null;
    const t = pxAT(v, px), c = filas()[fila].clips.find(k => t >= k.inicio && t < finClip(k)); return c ? { c, fila } : null;
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId); const { x, y } = pos(e), hit = y >= ALTO_REGLA ? clipEnPunto(x, y) : null, v = vista();
    if(hit){ alSeleccionar(hit.c.id); drag = { id: hit.c.id, modo: "mover", x0: x, inicio0: hit.c.inicio, inicio: hit.c.inicio, fila0: hit.fila, fila: hit.fila, movido: false }; }
    else { alSeleccionar(null); drag = { modo: "cabezal" }; alBuscar(Math.max(0, pxAT(v, x))); }
    dibujar();
  });
  cv.addEventListener("pointermove", e => {
    if(!drag) return; const { x, y } = pos(e), v = vista();
    if(drag.modo === "cabezal") return alBuscar(Math.max(0, pxAT(v, x)));
    if(Math.abs(x - drag.x0) > 4 || drag.movido){ drag.movido = true; const bordes = filas().flatMap(p => p.clips.filter(c => c.id !== drag.id).flatMap(c => [c.inicio, finClip(c)])); drag.inicio = Math.max(0, imantar(v, drag.inicio0 + (x - drag.x0) / v.pps, bordes, obtener().p.salida.fps)); drag.fila = Math.max(0, Math.min(filas().length - 1, Math.floor((y - ALTO_REGLA) / ALTO_FILA))); dibujar(); }
  });
  const fin = () => { const d = drag; drag = null; if(d && d.modo === "mover" && d.movido) alMover(d.id, d.inicio, filas()[d.fila].id); dibujar(); };
  cv.addEventListener("pointerup", fin); cv.addEventListener("pointercancel", () => { drag = null; dibujar(); });
  cv.addEventListener("wheel", e => { e.preventDefault(); const { x } = pos(e); alVista(e.ctrlKey || e.metaKey ? zoomEn(vista(), e.deltaY < 0 ? 1.25 : 0.8, x) : desplazar(vista(), e.deltaY + e.deltaX)); }, { passive: false });
  return { dibujar, dispose(){ cv.remove(); } };
}
