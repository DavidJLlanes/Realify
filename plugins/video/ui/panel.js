/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PANELES (clip, efectos, formato, salida)
   Declara los mandos con el montador común (mountControls de fsshell: panel lateral en escritorio, barra inferior en móvil). Mínimo a propósito: la vista previa manda.
   Los mandos de los efectos salen de sus manifiestos: el panel no conoce ningún efecto. Los cambios de un mando se confirman al soltarlo (un paso de deshacer cada uno).
   Entradas: { sh, obtener():{p,sel}, hacer(fn, etiqueta), formatos, alFormato(f), alContenedor(c) }. Salida: { actualizar() }.
   ═══════════════════════════════════════════════════════════════ */
import { mountControls } from "../bridge/ui.js";
import * as T from "../timeline/ops.js";
import { buscarClip } from "../project/modelo.js";
import { efectosDeLaApp } from "./motor-dom.js";

export function construirPanel({ sh, obtener, hacer, formatos, alFormato, alContenedor }){
  const est = { cont: "mp4" }, reg = efectosDeLaApp(), opciones = new Map();
  const formatoActual = () => { const s = obtener().p.salida; return Object.entries(formatos).find(([, f]) => f.ancho === s.ancho && f.alto === s.alto)?.[0] || "vertical"; };
  const clip = () => { const { p, sel } = obtener(); return sel ? buscarClip(p, sel)?.clip : null; };
  const secEfectos = { id: "efectos", label: "Efectos", when: () => !!clip(), props: [] };
  const secciones = [
    { id: "clip", label: "Clip", when: () => !!clip(), props: [{ type: "range", key: "vel", label: "Velocidad", min: 0.25, max: 4, step: 0.05, def: 1, buttons: true, fmt: v => v.toFixed(2) + "×" }] },
    secEfectos,
    { id: "proyecto", label: "Formato", props: [{ type: "seg", key: "formato", label: "Formato", options: [["vertical", "9:16"], ["horizontal", "16:9"], ["cuadrado", "1:1"]] }] },
    { id: "exportar", label: "Salida", props: [{ type: "seg", key: "cont", label: "Archivo", options: [["mp4", "MP4"], ["webm", "WebM"]] }] }
  ];
  let ctl = null;
  /* Claves de los efectos: «+efecto», «<id>|on», «<id>|<param>». */
  const efectoDe = k => clip()?.efectos.find(e => e.id === k.split("|")[0]);
  const paramDe = k => reg.manifiesto(efectoDe(k)?.efecto)?.params.find(d => d.key === k.split("|")[1]);
  function opcionesDe(m, d){
    const k = m.id + "." + d.key; if(!d.opciones) return d.options;
    if(!opciones.has(k)){ opciones.set(k, d.options); d.opciones().then(o => { opciones.set(k, o); ctl?.refresh(); }).catch(() => {}); }
    return opciones.get(k);
  }
  function propsEfectos(){
    const c = clip(), props = [{ type: "select", key: "+efecto", label: "Añadir efecto", options: [["", "Elegir…"], ...reg.lista().map(m => [m.id, m.nombre + (m.premium ? " 👑" : "")])] }];
    for(const e of c?.efectos || []){
      const m = reg.manifiesto(e.efecto); if(!m) continue;
      props.push({ type: "toggle", key: e.id + "|on", label: m.nombre });
      for(const d of m.params) props.push({ ...d, key: e.id + "|" + d.key, options: opcionesDe(m, d) });
      props.push({ type: "button", key: e.id + "|quitar", label: "Quitar " + m.nombre, run: () => hacer(pp => T.quitarEfecto(pp, c.id, e.id), "Quitar efecto") });
    }
    return props;
  }
  const get = k => {
    if(k === "vel") return clip()?.velocidad ?? 1; if(k === "formato") return formatoActual(); if(k === "cont") return est.cont; if(k === "+efecto") return "";
    const e = efectoDe(k); if(!e) return 0; return k.endsWith("|on") ? e.activo !== false : (e.params[k.split("|")[1]] ?? paramDe(k)?.def);
  };
  const set = (k, v, fin) => {
    if(!fin && k !== "formato" && k !== "cont") return;
    if(k === "vel"){ const c = clip(); if(c) hacer(pp => T.cambiarVelocidad(pp, c.id, v), "Velocidad"); }
    else if(k === "formato") alFormato(formatos[v]);
    else if(k === "cont"){ est.cont = v; alContenedor(v); }
    else if(k === "+efecto"){ const c = clip(), m = reg.manifiesto(v); if(c && m) hacer(pp => T.ponerEfecto(pp, c.id, m.id, Object.fromEntries(m.params.map(d => [d.key, d.def])), m.version), "Añadir efecto"); }
    else { const c = clip(), e = efectoDe(k), campo = k.split("|")[1]; if(c && e) hacer(pp => T.ajustarEfecto(pp, c.id, e.id, campo === "on" ? { activo: v } : { params: { [campo]: v } }), "Ajustar efecto"); }
  };
  secEfectos.props = propsEfectos();
  ctl = mountControls(sh, { sections: secciones, get, set });
  return { actualizar(){ secEfectos.props = propsEfectos(); ctl.refresh(); } };
}
