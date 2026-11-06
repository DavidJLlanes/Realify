/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PANELES (clip, proyecto, exportar)
   Declara los mandos con el montador común (mountControls de fsshell: panel lateral en escritorio, barra inferior en móvil). Mínimo a propósito: la vista previa manda.
   Entradas: { sh, obtener():{p,sel}, hacer(fn, etiqueta), formatos, alFormato(f), alContenedor(c) }. Salida: { actualizar() }.
   ═══════════════════════════════════════════════════════════════ */
import { mountControls } from "../bridge/ui.js";
import * as T from "../timeline/ops.js";
import { buscarClip } from "../project/modelo.js";

export function construirPanel({ sh, obtener, hacer, formatos, alFormato, alContenedor }){
  const est = { cont: "mp4" };
  const formatoActual = () => { const s = obtener().p.salida; return Object.entries(formatos).find(([, f]) => f.ancho === s.ancho && f.alto === s.alto)?.[0] || "vertical"; };
  const clip = () => { const { p, sel } = obtener(); return sel ? buscarClip(p, sel)?.clip : null; };
  const secciones = [
    { id: "clip", label: "Clip", when: () => !!clip(), props: [{ type: "range", key: "vel", label: "Velocidad", min: 0.25, max: 4, step: 0.05, def: 1, buttons: true, fmt: v => v.toFixed(2) + "×" }] },
    { id: "proyecto", label: "Formato", props: [{ type: "seg", key: "formato", label: "Formato", options: [["vertical", "9:16"], ["horizontal", "16:9"], ["cuadrado", "1:1"]] }] },
    { id: "exportar", label: "Salida", props: [{ type: "seg", key: "cont", label: "Archivo", options: [["mp4", "MP4"], ["webm", "WebM"]] }] }
  ];
  const get = k => k === "vel" ? clip()?.velocidad ?? 1 : k === "formato" ? formatoActual() : est.cont;
  const set = (k, v, fin) => {
    if(k === "vel"){ const c = clip(); if(c && fin) hacer(pp => T.cambiarVelocidad(pp, c.id, v), "Velocidad"); }
    else if(k === "formato") alFormato(formatos[v]); else { est.cont = v; alContenedor(v); }
  };
  const ctl = mountControls(sh, { sections: secciones, get, set });
  return { actualizar: () => ctl.refresh() };
}
