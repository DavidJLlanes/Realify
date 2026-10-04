/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR POR PROFUNDIDAD (Premium 👑 · fase 5 de PENDIENTE.md)
   Menú Inteligencia Artificial › Seleccionar, menú Capa › Máscara de
   capa y botón «Por profundidad…» de las propiedades de una máscara.

   La IA (Depth Anything V2, js/ai/depth.js) da la distancia de cada
   punto; aquí se elige qué parte de esa distancia interesa:
     · Primer plano, plano medio o fondo (tercios de la imagen por
       cantidad de píxeles, no por distancia: siempre dan algo útil), o
       un intervalo manual Desde–Hasta (0 % = lo más cercano).
     · Tocar la imagen elige la distancia de ese punto.
     · La transición entre zonas es suave y el borde se ajusta a los
       contornos reales de la foto (filtro guiado, ver depthAt).
   El resultado es una SELECCIÓN o la MÁSCARA de una capa (cualquiera: de
   imagen o de ajuste, para hacer un ajuste local por distancia), siempre
   al tamaño del documento: la distancia se calcula a la resolución de
   trabajo y se interpola a tamaño real antes de aplicar la zona, así que
   el contorno no sale a escalones.

   Procesado Premium («el bueno y el mejor»): mapa de profundidad por
   bloques (fase 3) con borde guiado por la foto, y zonas con transición
   suave en vez de un corte seco.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../core/doc.js";
import { toast } from "../ui/toast.js";
import { depthAt } from "../ai/depth.js";
import { zoneAlpha, presetZone } from "../ai/depthmath.js";
import { commitSelection } from "../editor/selection.js";
import { setMaskFromArray, setMaskTarget } from "../editor/masks.js";
import { visibleImage, getDepth, scaled, pixelsOf, WORK, PREVIEW, prepare, openShell, sampler } from "./depthtools.js";

/* ── Distancia a tamaño de documento ─────────────────────────── */

/** Distancia guiada por la foto a la resolución de trabajo, con lo
    necesario para leerla a tamaño real (bilineal). */
export function depthField(src, map){
  const W = src.width, H = src.height, small = scaled(src, WORK()), w = small.width, h = small.height;
  const d = depthAt(map, w, h, pixelsOf(small));
  return { d, w, h, W, H, smp: sampler(w, h, W, H) };
}

/** Recorre el documento entero por franjas y devuelve Uint8ClampedArray
    W×H con `fn(u)` (u = distancia 0-1 en ese punto, `fn` → 0-1). */
export async function fieldToArray(field, fn){
  const { W, H, smp, d } = field, out = new Uint8ClampedArray(W * H);
  const rows = Math.max(1, Math.floor(2e6 / W));
  for(let y0 = 0; y0 < H; y0 += rows){
    const y1 = Math.min(H, y0 + rows);
    for(let Y = y0; Y < y1; Y++){
      const o = Y * W;
      for(let X = 0; X < W; X++) out[o + X] = fn(1 - smp(d, X, Y)) * 255 + 0.5;
    }
    await new Promise(r => setTimeout(r, 0));
  }
  return out;
}

/* ── Herramienta ─────────────────────────────────────────────── */

const ZONES = [["near", "Primer plano"], ["mid", "Plano medio"], ["far", "Fondo"], ["manual", "Intervalo manual"]];
const half = soft => soft / 200;            // «Suavidad» 0-40 % → mitad de la transición (0-0.2)

let open = false;

/** `target`: capa a la que se pone la máscara (desde Propiedades de la
    máscara o el menú Capa); sin `target` se elige Selección o Máscara de
    la capa activa en el propio editor. */
export async function openDepthSelect({ target = null } = {}){
  if(open) return;
  if(target && (target.type === "group" || !target.canvas)){ toast("Elige una capa de imagen o de ajuste"); return; }
  const src = await visibleImage(); if(!src) return;
  const map = await getDepth(src); if(!map) return;
  open = true;

  const small = scaled(src, PREVIEW), P = prepare(small, map);
  const S = { zone: "near", from: 0, to: 33, soft: 6, invert: false, view: "sel", out: target ? "mask" : "sel" };
  const setZone = kind => {
    S.zone = kind;
    const z = presetZone(kind, P.d);
    if(z){ S.from = Math.round(z[0] * 100); S.to = Math.round(z[1] * 100); }
  };
  setZone("near");

  const view = document.createElement("canvas"); view.width = P.w; view.height = P.h;
  const vx = view.getContext("2d");
  const alphaAt = u => {
    const a = zoneAlpha(u, S.from / 100, S.to / 100, half(S.soft));
    return S.invert ? 1 - a : a;
  };
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      const n = P.n, o = new Uint8ClampedArray(n * 4), px = P.px, d = P.d;
      let any = 0;
      for(let i = 0, j = 0; i < n; i++, j += 4){
        const a = alphaAt(1 - d[i]);
        if(a > 0.02) any++;
        if(S.view === "depth"){
          // Profundidad en grises (cerca = claro) y la zona elegida en ámbar
          const g = d[i] * 255;
          o[j] = g + (240 - g) * a * 0.55; o[j + 1] = g + (170 - g) * a * 0.55; o[j + 2] = g + (50 - g) * a * 0.55;
        } else {
          // Lo elegido, tal cual; el resto, apagado y teñido (como una máscara rápida)
          const k = 1 - a;
          o[j] = px[j] * (1 - 0.65 * k) + 220 * 0.45 * k; o[j + 1] = px[j + 1] * (1 - 0.65 * k) + 40 * 0.45 * k; o[j + 2] = px[j + 2] * (1 - 0.65 * k) + 60 * 0.45 * k;
        }
        o[j + 3] = 255;
      }
      vx.putImageData(new ImageData(o, P.w, P.h), 0, 0);
      sh.setView(view);
      sh.setApplyEnabled(any > 0);
    });
  };

  const close = () => { open = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Seleccionar por profundidad", subtitle: "Premium 👑 · toca la imagen para elegir una distancia", applyLabel: target ? "Poner máscara" : "Aplicar",
    onCancel: close,
    onApply: async () => {
      sh.setBusy("Calculando a resolución completa…");
      await new Promise(r => setTimeout(r, 30));
      try{
        const field = depthField(src, map);
        const arr = await fieldToArray(field, u => alphaAt(u));
        let any = false;
        for(let i = 0; i < arr.length; i += 7) if(arr[i] > 8){ any = true; break; }
        if(!any){ sh.setBusy(""); toast("No hay nada en ese intervalo de distancia", "err"); return; }
        if(S.out === "mask"){
          const layer = target || activeLayer();
          if(!layer || !setMaskFromArray(layer, arr, "Máscara por profundidad")){ sh.setBusy(""); toast("No se pudo poner la máscara en esa capa", "err"); return; }
          close();
          if(layer.id === doc.activeId) setMaskTarget(layer.id);
          toast("Máscara por profundidad puesta en «" + layer.name + "»", "ok");
        } else {
          close();
          commitSelection(arr, "new");
          toast("Selección por profundidad lista", "ok");
        }
      } catch(err){ sh.setBusy(""); toast("No se pudo calcular: " + err.message, "err"); }
    }
  });
  sh.setOriginal(small);

  // Tocar la imagen: la distancia de ese punto ± un margen
  let down0 = null;
  sh.setInteract((type, p, e) => {
    if(type === "down"){ down0 = { x: e.clientX, y: e.clientY }; return true; }
    if(type === "up" && down0 && p){
      if(Math.hypot(e.clientX - down0.x, e.clientY - down0.y) < 10 && p.x >= 0 && p.y >= 0 && p.x < P.w && p.y < P.h){
        const u = 1 - P.d[(p.y | 0) * P.w + (p.x | 0)];
        S.zone = "manual"; S.from = Math.max(0, Math.round((u - 0.12) * 100)); S.to = Math.min(100, Math.round((u + 0.12) * 100));
        ctl.refresh(); render();
      }
      down0 = null;
    }
    return false;
  });

  const sections = [
    { id: "z", label: "Distancia", props: [
      { key: "zone", label: "Zona", type: "select", options: ZONES },
      { key: "from", label: "Desde (cerca)", type: "range", min: 0, max: 100, unit: " %", def: 0 },
      { key: "to", label: "Hasta (lejos)", type: "range", min: 0, max: 100, unit: " %", def: 100 }
    ] },
    { id: "b", label: "Borde", props: [
      { key: "soft", label: "Suavidad", type: "range", min: 0, max: 40, unit: " %", def: 6 },
      { key: "invert", label: "Invertir", type: "toggle" }
    ] },
    { id: "v", label: "Vista y salida", props: [
      { key: "view", label: "Ver", type: "seg", options: [["sel", "Selección"], ["depth", "Profundidad"]] },
      ...(target ? [] : [{ key: "out", label: "Resultado", type: "seg", options: [["sel", "Selección"], ["mask", "Máscara de la capa"]] }])
    ] }
  ];
  const ctl = mountControls(sh, {
    sections,
    get: k => S[k],
    set: (k, v, commit) => {
      if(k === "zone"){ setZone(v); ctl.refresh(); }
      else if(k === "from" || k === "to"){
        S[k] = v;
        if(k === "from" && S.from > S.to) S.to = S.from;
        if(k === "to" && S.to < S.from) S.from = S.to;
        S.zone = "manual";
        if(commit) ctl.refresh();
      } else S[k] = v;
      render();
    }
  });
  render();
}

/** Desde menú Capa › Máscara de capa: a la capa activa. */
export function maskByDepthCommand(){
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return; }
  return openDepthSelect({ target: l });
}
