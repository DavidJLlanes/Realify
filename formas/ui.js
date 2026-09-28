/* ═══════════════════════════════════════════════════════════════
   FORMAS · VENTANA
   Pantalla completa (js/ui/fsshell.js). La foto recortada con la forma
   (transparencia fuera) y, encima, la forma con sus asas:
     · arrastrar dentro la mueve,
     · una esquina la escala (desde el centro),
     · el asa de arriba la gira.
   ═══════════════════════════════════════════════════════════════ */

import { grabPx, drawPx, nearest } from "../js/editor/grab.js";
import { createShell, mountControls, stateHistory, scaledCanvas } from "../js/ui/fsshell.js";
import { SHAPES, GROUPS, placeShape, traceShape, fillRule, shapeIcon } from "./shapes.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const PREVIEW_SIDE = TOUCH ? 1000 : 1500;

/* Imagen recortada con la forma, al tamaño de `src`. `k` = escala de
   `src` respecto a la imagen original (para bordes y contornos). */
export function renderShape(src, S, k = 1){
  const W = src.width, H = src.height, m = Math.min(W, H);
  const w = S.size / 100 * m * S.sx / 100, h = S.size / 100 * m * S.sy / 100;
  const placed = placeShape(S.shape, S, S.cx * W, S.cy * H, w, h, S.rot);
  // Máscara (con borde suave: reducir y volver a ampliar la difumina)
  let mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  let mx = mask.getContext("2d");
  mx.fillStyle = "#fff"; traceShape(mx, placed); mx.fill(fillRule(placed));
  const f = S.feather * k;
  if(f >= 1){
    for(let pass = 0; pass < 2; pass++){
      const d = Math.max(1, f / (pass ? 3 : 1.6));
      const sm = document.createElement("canvas"); sm.width = Math.max(1, Math.round(W / d)); sm.height = Math.max(1, Math.round(H / d));
      const sx = sm.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(mask, 0, 0, sm.width, sm.height);
      mx.clearRect(0, 0, W, H); mx.imageSmoothingQuality = "high"; mx.drawImage(sm, 0, 0, W, H);
    }
  }
  if(S.invert){
    const inv = document.createElement("canvas"); inv.width = W; inv.height = H;
    const ix = inv.getContext("2d"); ix.fillStyle = "#fff"; ix.fillRect(0, 0, W, H);
    ix.globalCompositeOperation = "destination-out"; ix.drawImage(mask, 0, 0);
    mask = inv; mx = ix;
  }
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const x = out.getContext("2d");
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "destination-in"; x.drawImage(mask, 0, 0);
  x.globalCompositeOperation = "source-over";
  if(S.stroke > 0){
    x.save(); x.lineJoin = "round"; x.strokeStyle = S.strokeColor; x.lineWidth = S.stroke * k;
    traceShape(x, placed); x.stroke(); x.restore();
  }
  if(S.outside === "color"){ x.globalCompositeOperation = "destination-over"; x.fillStyle = S.bg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; }
  return { canvas: out, placed };
}

/** Caja que ocupa la forma (con su contorno y borde), para recortar. */
export function shapeBounds(placed, S, k, W, H){
  const pts = placed.paths.flat(), pad = (S.stroke / 2 + S.feather) * k + 1;
  if(S.invert || S.outside === "color") return { x: 0, y: 0, w: W, h: H };
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])) - pad)), y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])) - pad));
  const x1 = Math.min(W, Math.ceil(Math.max(...pts.map(p => p[0])) + pad)), y1 = Math.min(H, Math.ceil(Math.max(...pts.map(p => p[1])) + pad));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

export function openShapeEditor({ source, canLayer, onAccept }){
  const W = source.width, H = source.height;
  const proxy = scaledCanvas(source, PREVIEW_SIDE), pk = proxy.width / W;
  const state = {
    s: { shape: "heart", sides: 6, points: 5, inner: 45, round: 0, stretch: false,
         cx: .5, cy: .5, size: 85, sx: 100, sy: 100, rot: 0,
         feather: 0, stroke: 0, strokeColor: "#ffffff", invert: false, outside: "transparent", bg: "#ffffff",
         output: canLayer ? "layer" : "crop" }
  };
  const S = state.s;
  let closed = false, placed = null, drag = null;

  const sh = createShell({
    title: "Recortar en forma", subtitle: `${W} × ${H}`, applyLabel: "Crear capa",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => hist.undo(), onRedo: () => hist.redo()
  });
  const hist = stateHistory(state, () => { Object.assign(S, state.s); state.s = S; controls.refresh(); render(); renderLeft(); }, sh);

  const view = document.createElement("canvas");
  function render(){
    const r = renderShape(proxy, S, pk);
    view.width = r.canvas.width; view.height = r.canvas.height;
    view.getContext("2d").drawImage(r.canvas, 0, 0);
    placed = r.placed;
    sh.setView(view, !!sh.view);
    sh.redraw();
  }
  sh.setOriginal(proxy);

  /* ── Asas ── */
  const geom = () => {
    const m = Math.min(proxy.width, proxy.height);
    const w = S.size / 100 * m * S.sx / 100, h = S.size / 100 * m * S.sy / 100;
    const cx = S.cx * proxy.width, cy = S.cy * proxy.height, a = S.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const pt = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
    return { cx, cy, w, h, corners: [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)], rotH: pt(0, -h / 2 - 28 / Math.max(.2, sh.transform?.k / sh.transform?.dpr || 1)) };
  };
  sh.setOverlay((x, t) => {
    if(!placed) return;
    const X = v => t.ox + v * t.k, Y = v => t.oy + v * t.k, d = t.dpr, g = geom();
    x.lineWidth = 1.5 * d; x.setLineDash([6 * d, 4 * d]); x.strokeStyle = "rgba(255,255,255,.9)";
    x.beginPath(); g.corners.forEach(([a, b], i) => i ? x.lineTo(X(a), Y(b)) : x.moveTo(X(a), Y(b))); x.closePath(); x.stroke();
    x.setLineDash([]);
    x.strokeStyle = "#6794ff"; x.lineWidth = 2 * d;
    x.beginPath();
    for(const con of placed.paths){ con.forEach(([a, b], i) => i ? x.lineTo(X(a), Y(b)) : x.moveTo(X(a), Y(b))); x.closePath(); }
    x.stroke();
    const top = [(g.corners[0][0] + g.corners[1][0]) / 2, (g.corners[0][1] + g.corners[1][1]) / 2];
    x.strokeStyle = "#fff"; x.lineWidth = 1.5 * d; x.beginPath(); x.moveTo(X(top[0]), Y(top[1])); x.lineTo(X(g.rotH[0]), Y(g.rotH[1])); x.stroke();
    const R = drawPx(TOUCH ? 7 : 6) * d;
    x.fillStyle = "#fff"; x.strokeStyle = "#1a1d21"; x.lineWidth = 1.5 * d;
    for(const [a, b] of g.corners){ x.beginPath(); x.rect(X(a) - R, Y(b) - R, R * 2, R * 2); x.fill(); x.stroke(); }
    x.beginPath(); x.arc(X(g.rotH[0]), Y(g.rotH[1]), R * 1.1, 0, Math.PI * 2); x.fillStyle = "#6794ff"; x.fill(); x.stroke();
  });
  sh.setInteract((type, pt) => {
    if(!pt && type !== "cancel") return false;
    const g = geom();
    if(type === "hover"){ return false; }
    if(type === "down"){
      const tol = grabPx(12) / Math.max(.01, pt.k);
      // Esquinas y asa de giro compiten: gana la más cercana.
      const hit = nearest(pt, [...g.corners, g.rotH], tol * 1.2);
      if(hit === g.corners.length){ drag = { kind: "rot", a0: Math.atan2(pt.y - g.cy, pt.x - g.cx), r0: S.rot }; return true; }
      if(hit >= 0){ drag = { kind: "size", d0: Math.hypot(pt.x - g.cx, pt.y - g.cy), s0: S.size }; return true; }
      // Dentro de la caja girada
      const a = -S.rot * Math.PI / 180, dx = pt.x - g.cx, dy = pt.y - g.cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if(Math.abs(lx) <= g.w / 2 && Math.abs(ly) <= g.h / 2){ drag = { kind: "move", x: pt.x, y: pt.y, cx: S.cx, cy: S.cy }; return true; }
      return false;
    }
    if(!drag) return false;
    if(type === "move"){
      if(drag.kind === "move"){ S.cx = drag.cx + (pt.x - drag.x) / proxy.width; S.cy = drag.cy + (pt.y - drag.y) / proxy.height; }
      else if(drag.kind === "size") S.size = Math.max(5, Math.min(300, drag.s0 * Math.hypot(pt.x - g.cx, pt.y - g.cy) / Math.max(1, drag.d0)));
      else { let r = drag.r0 + (Math.atan2(pt.y - g.cy, pt.x - g.cx) - drag.a0) * 180 / Math.PI; r = ((r + 540) % 360) - 180; if(Math.abs(r % 45) < 3 || Math.abs(r % 45) > 42) r = Math.round(r / 45) * 45; S.rot = Math.round(r); }
      render(); return true;
    }
    if(type === "up" || type === "cancel"){ drag = null; hist.commit(); controls.refresh(); return true; }
    return false;
  });

  /* ── Formas (panel izquierdo, por grupos) ── */
  function renderLeft(){
    const L = sh.left; L.innerHTML = "";
    for(const g of GROUPS){
      const h = document.createElement("h3"); h.textContent = g; L.appendChild(h);
      const grid = document.createElement("div"); grid.className = "fsp-thumbs";
      for(const [id, label] of SHAPES.filter(s => s[2] === g)){
        const b = document.createElement("button"); b.type = "button"; b.className = "fsp-thumb" + (S.shape === id ? " on" : "");
        b.innerHTML = shapeIcon(id, S) + `<span>${label}</span>`;
        b.addEventListener("click", () => { S.shape = id; hist.commit(); render(); renderLeft(); controls.refresh(); });
        grid.appendChild(b);
      }
      L.appendChild(grid);
    }
  }

  /* ── Ajustes ── */
  const poly = () => { const f = SHAPES.find(s => s[0] === S.shape)[3](S); return !!f.poly; };
  const sections = [
    { id: "shape", label: "Forma", when: () => matchMedia("(max-width:900px)").matches, props: [
      { key: "shape", label: "Forma", type: "thumbs", options: SHAPES.map(s => [s[0], s[1]]), thumb: id => shapeIcon(id, S) }
    ] },
    { id: "params", label: "Forma", when: () => S.shape === "polygon" || S.shape === "star" || poly(), props: [
      { key: "sides", label: "Lados", type: "range", min: 3, max: 24, def: 6, when: () => S.shape === "polygon" },
      { key: "points", label: "Puntas", type: "range", min: 3, max: 30, def: 5, when: () => S.shape === "star" },
      { key: "inner", label: "Profundidad de las puntas", type: "range", min: 10, max: 95, unit: " %", def: 45, when: () => S.shape === "star" },
      { key: "round", label: "Esquinas redondeadas", type: "range", min: 0, max: 100, unit: " %", def: 0, when: poly }
    ] },
    { id: "size", label: "Tamaño y posición", props: [
      { key: "size", label: "Tamaño", type: "range", min: 5, max: 300, unit: " %", def: 85 },
      { key: "sx", label: "Ancho", type: "range", min: 10, max: 400, unit: " %", def: 100 },
      { key: "sy", label: "Alto", type: "range", min: 10, max: 400, unit: " %", def: 100 },
      { key: "stretch", label: "Deformar para llenar la caja", type: "toggle" },
      { key: "rot", label: "Giro", type: "range", min: -180, max: 180, unit: "°", def: 0 },
      { key: "center", label: "Centrar", type: "button", run: () => { S.cx = .5; S.cy = .5; hist.commit(); render(); } }
    ] },
    { id: "edge", label: "Borde", props: [
      { key: "feather", label: "Borde suave", type: "range", min: 0, max: 200, unit: " px", def: 0 },
      { key: "stroke", label: "Contorno", type: "range", min: 0, max: 100, unit: " px", def: 0 },
      { key: "strokeColor", label: "Color del contorno", type: "color", when: () => S.stroke > 0 }
    ] },
    { id: "bg", label: "Fuera de la forma", props: [
      { key: "invert", label: "Invertir (quitar lo de dentro)", type: "toggle" },
      { key: "outside", label: "Fuera de la forma", type: "seg", options: [["transparent", "Transparente"], ["color", "Color"]] },
      { key: "bg", label: "Color", type: "color", when: () => S.outside === "color" }
    ] },
    { id: "out", label: "Resultado", props: [
      { key: "output", label: "Crear", type: "select", options: [...(canLayer ? [["layer", "Capa nueva en este documento"]] : []), ["crop", "Pestaña nueva recortada a la forma"]] }
    ] }
  ];
  const controls = mountControls(sh, {
    sections, get: k => S[k],
    set: (k, v, final) => {
      S[k] = v;
      if(final){ hist.commit(); if(["shape", "stroke", "outside", "sides", "points", "inner", "round"].includes(k)){ controls.refresh(); renderLeft(); } }
      render();
    }
  });

  function apply(){
    const r = renderShape(source, S, 1);
    close();
    onAccept(r.canvas, { output: S.output, bounds: shapeBounds(r.placed, S, 1, W, H), name: SHAPES.find(s => s[0] === S.shape)[1] });
  }
  function close(){ if(closed) return; closed = true; sh.close(); }
  renderLeft(); render();
  return { close };
}
