/* ═══════════════════════════════════════════════════════════════
   ANTES Y DESPUÉS · VENTANA
   Pantalla completa (js/ui/fsshell.js). Compone una imagen para
   compartir con el original y el resultado: dividida por una línea
   (arrastrable), en diagonal, lado a lado o arriba y abajo, con
   etiquetas y en el formato de la red elegida.
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, stateHistory, scaledCanvas } from "../js/ui/fsshell.js";

export const LAYOUTS = [["split", "Dividida"], ["diagonal", "Diagonal"], ["side", "Lado a lado"], ["stack", "Arriba y abajo"]];
const FORMATS = [["orig", "Como la imagen"], ["1:1", "Cuadrada 1:1"], ["4:5", "Vertical 4:5"], ["9:16", "Historia 9:16"], ["16:9", "Horizontal 16:9"]];
function layoutSvg(id){
  const A = 'fill="#8a96a8"', B = 'fill="#cfd8e6"';
  if(id === "split") return `<svg viewBox="0 0 48 48"><rect x="4" y="10" width="20" height="28" ${A}/><rect x="24" y="10" width="20" height="28" ${B}/><path d="M24 7v34" stroke="#fff" stroke-width="2"/></svg>`;
  if(id === "diagonal") return `<svg viewBox="0 0 48 48"><path d="M4 10h30L14 38H4z" ${A}/><path d="M34 10h10v28H14z" ${B}/></svg>`;
  if(id === "side") return `<svg viewBox="0 0 48 48"><rect x="3" y="14" width="20" height="20" ${A}/><rect x="25" y="14" width="20" height="20" ${B}/></svg>`;
  return `<svg viewBox="0 0 48 48"><rect x="14" y="3" width="20" height="20" ${A}/><rect x="14" y="25" width="20" height="20" ${B}/></svg>`;
}

/* Recorte «cover» de una imagen a w × h */
function cover(x, img, X, Y, w, h){
  const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k;
  x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, X, Y, w, h);
}
function label(x, text, X, Y, S, align){
  if(!S.labels || !text) return;
  const fs = S.labelSize * S._u, pad = fs * .45;
  x.font = `700 ${fs}px system-ui, sans-serif`;
  const w = x.measureText(text).width + pad * 2, h = fs + pad * 1.4;
  const bx = align === "right" ? X - w : align === "center" ? X - w / 2 : X;
  x.fillStyle = S.labelBg; x.beginPath(); x.roundRect ? x.roundRect(bx, Y, w, h, h / 2) : x.rect(bx, Y, w, h); x.fill();
  x.fillStyle = S.labelColor; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(text, bx + w / 2, Y + h / 2 + fs * .04);
}

/** Composición a `maxSide` de lado mayor. */
export function compose(before, after, S, maxSide){
  const r = S.format === "orig" ? after.width / after.height : (() => { const [a, b] = S.format.split(":").map(Number); return a / b; })();
  let W, H;
  if(S.layout === "side"){ W = r * 2; H = 1; } else if(S.layout === "stack"){ W = r; H = 2; } else { W = r; H = 1; }
  const k = maxSide / Math.max(W, H); W = Math.round(W * k); H = Math.round(H * k);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  S._u = Math.min(W, H) / 100;
  const gap = S.layout === "side" || S.layout === "stack" ? Math.round(S.gap * S._u / 5) : 0;
  x.fillStyle = S.bg; x.fillRect(0, 0, W, H);
  const m = S._u * 3;
  if(S.layout === "side"){
    const w = (W - gap) / 2;
    cover(x, before, 0, 0, w, H); cover(x, after, w + gap, 0, w, H);
    label(x, S.beforeText, m, m, S, "left"); label(x, S.afterText, w + gap + m, m, S, "left");
  } else if(S.layout === "stack"){
    const h = (H - gap) / 2;
    cover(x, before, 0, 0, W, h); cover(x, after, 0, h + gap, W, h);
    label(x, S.beforeText, m, m, S, "left"); label(x, S.afterText, m, h + gap + m, S, "left");
  } else {
    cover(x, after, 0, 0, W, H);
    x.save(); x.beginPath();
    const sx = W * S.split / 100;
    if(S.layout === "split") x.rect(0, 0, sx, H);
    else { const t = H * .35; x.moveTo(0, 0); x.lineTo(sx + t, 0); x.lineTo(sx - t, H); x.lineTo(0, H); x.closePath(); }
    x.clip(); cover(x, before, 0, 0, W, H); x.restore();
    if(S.line > 0){
      x.strokeStyle = S.lineColor; x.lineWidth = S.line * S._u / 5;
      x.beginPath();
      if(S.layout === "split"){ x.moveTo(sx, 0); x.lineTo(sx, H); } else { const t = H * .35; x.moveTo(sx + t, 0); x.lineTo(sx - t, H); }
      x.stroke();
      if(S.handle && S.layout === "split"){
        const R = S._u * 4; x.fillStyle = S.lineColor; x.beginPath(); x.arc(sx, H / 2, R, 0, Math.PI * 2); x.fill();
        x.fillStyle = "rgba(20,22,26,.8)"; x.beginPath(); x.moveTo(sx - R * .55, H / 2); x.lineTo(sx - R * .15, H / 2 - R * .4); x.lineTo(sx - R * .15, H / 2 + R * .4); x.fill();
        x.beginPath(); x.moveTo(sx + R * .55, H / 2); x.lineTo(sx + R * .15, H / 2 - R * .4); x.lineTo(sx + R * .15, H / 2 + R * .4); x.fill();
      }
    }
    label(x, S.beforeText, m, m, S, "left"); label(x, S.afterText, W - m, m, S, "right");
  }
  return c;
}

export function openCompareEditor({ before, after, onPickBefore, onAccept }){
  const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
  let pb = scaledCanvas(before, 1400), pa = scaledCanvas(after, 1400), closed = false;
  const state = { s: { layout: "split", format: "orig", split: 50, line: 6, lineColor: "#ffffff", handle: true, gap: 10, bg: "#ffffff",
    labels: true, beforeText: "ANTES", afterText: "DESPUÉS", labelSize: 5, labelColor: "#ffffff", labelBg: "rgba(0,0,0,.55)" } };
  const S = state.s;
  const sh = createShell({ title: "Antes y después", subtitle: "Imagen de comparación para compartir", applyLabel: "Crear imagen", cls: "fsp-noleft",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => hist.undo(), onRedo: () => hist.redo() });
  const hist = stateHistory(state, () => { Object.assign(S, state.s); state.s = S; controls.refresh(); render(); }, sh);
  const render = () => sh.setView(compose(pb, pa, S, TOUCH ? 1000 : 1400), !!sh.view);
  let drag = false;
  sh.setInteract((type, pt) => {
    if(S.layout !== "split" && S.layout !== "diagonal") return false;
    const v = sh.view; if(!v || !pt) { drag = false; return false; }
    // Tocar o arrastrar en cualquier punto lleva allí la división
    if(type === "down"){ drag = true; S.split = Math.max(2, Math.min(98, pt.x / v.width * 100)); render(); return true; }
    if(!drag) return false;
    if(type === "move"){ S.split = Math.max(2, Math.min(98, pt.x / v.width * 100)); render(); return true; }
    if(type === "up" || type === "cancel"){ drag = false; hist.commit(); controls.refresh(); return true; }
    return false;
  });
  const sections = [
    { id: "layout", label: "Diseño", props: [
      { key: "layout", label: "Diseño", type: "thumbs", options: LAYOUTS, thumb: layoutSvg },
      { key: "format", label: "Formato", type: "select", options: FORMATS },
      { key: "split", label: "Posición de la división", type: "range", min: 2, max: 98, unit: " %", def: 50, when: () => S.layout === "split" || S.layout === "diagonal" },
      { key: "gap", label: "Separación", type: "range", min: 0, max: 50, def: 10, when: () => S.layout === "side" || S.layout === "stack" },
      { key: "bg", label: "Color de la separación", type: "color", when: () => (S.layout === "side" || S.layout === "stack") && S.gap > 0 },
      { key: "pickBefore", label: "Cambiar la foto de «antes»…", type: "button", run: async () => { const c = await onPickBefore(); if(c){ before = c; pb = scaledCanvas(c, 1400); render(); } } }
    ] },
    { id: "line", label: "Línea", when: () => S.layout === "split" || S.layout === "diagonal", props: [
      { key: "line", label: "Grosor", type: "range", min: 0, max: 30, def: 6 },
      { key: "lineColor", label: "Color", type: "color" },
      { key: "handle", label: "Tirador en el centro", type: "toggle", when: () => S.layout === "split" }
    ] },
    { id: "labels", label: "Etiquetas", props: [
      { key: "labels", label: "Mostrar etiquetas", type: "toggle" },
      { key: "beforeText", label: "Texto de antes", type: "text", when: () => S.labels },
      { key: "afterText", label: "Texto de después", type: "text", when: () => S.labels },
      { key: "labelSize", label: "Tamaño", type: "range", min: 2, max: 12, def: 5, when: () => S.labels },
      { key: "labelColor", label: "Color del texto", type: "color", when: () => S.labels }
    ] }
  ];
  const controls = mountControls(sh, { sections, get: k => S[k],
    set: (k, v, final) => { S[k] = v; if(final){ hist.commit(); if(["layout", "labels", "gap"].includes(k)) controls.refresh(); } render(); } });
  function apply(){
    // Cada foto conserva su resolución: lado a lado (o apiladas) el lienzo mide el doble.
    const side = Math.max(after.width, after.height, 1080) * (S.layout === "side" || S.layout === "stack" ? 2 : 1);
    const c = compose(before, after, S, Math.min(side, 6000)); close(); onAccept(c);
  }
  function close(){ if(closed) return; closed = true; sh.close(); }
  render();
  return { close };
}
