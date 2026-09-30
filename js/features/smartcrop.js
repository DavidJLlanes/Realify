/* ═══════════════════════════════════════════════════════════════
   RECORTE INTELIGENTE PARA REDES (Premium 👑)
   Menú Inteligencia Artificial › Encuadre y su pestaña del cajón.
   Elige el formato (Instagram, historias, YouTube…) y propone el mejor
   encuadre de la foto para él; se puede arrastrar para afinarlo.

   Procesado Premium («el bueno y el mejor»):
     · Bueno: mapa de lo importante de la foto con IA: el sujeto con
       U²-Net (incluido en la web) y las caras con YuNet, que pesan más
       (en una foto con gente, lo que importa son las caras).
     · Mejor: entre todos los recortes posibles de ese formato (tamaños
       del 100 % al 55 % y cualquier posición) gana el que conserva más
       de lo importante, NO corta caras ni corta el sujeto por el borde,
       deja el centro del sujeto cerca de un punto fuerte de los tercios
       y es lo más grande posible.
   Aplicar recorta el documento (un paso de deshacer, como Recortar).
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { toast, status } from "../ui/toast.js";

export const FORMATS = [
  ["1:1", "Instagram · cuadrado 1:1", 1],
  ["4:5", "Instagram · vertical 4:5", 4 / 5],
  ["9:16", "Historias, Reels y TikTok 9:16", 9 / 16],
  ["16:9", "YouTube y X 16:9", 16 / 9],
  ["1.91:1", "Facebook y LinkedIn 1,91:1", 1.91],
  ["2:3", "Pinterest 2:3", 2 / 3],
  ["3:4", "Retrato 3:4", 3 / 4]
];

/* Mapa de importancia en una rejilla de ≤ 200 px */
export async function importanceMap(src){
  const G = 200, k = G / Math.max(src.width, src.height);
  const gw = Math.max(4, Math.round(src.width * k)), gh = Math.max(4, Math.round(src.height * k));
  const imp = new Float32Array(gw * gh);
  // Sujeto (U²-Net, 320×320)
  try{
    const c = document.createElement("canvas"); c.width = c.height = 320;
    const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, 320, 320);
    const { runModel } = await import("../ai/runtime.js");
    const r = await runModel("matte", "u2netp", { rgba: x.getImageData(0, 0, 320, 320).data, size: 320 }, [], { quiet: true });
    for(let y = 0; y < gh; y++) for(let xx = 0; xx < gw; xx++){
      const v = r.mask[Math.min(319, (y / gh * 320) | 0) * 320 + Math.min(319, (xx / gw * 320) | 0)] / 255;
      imp[y * gw + xx] = v;
    }
  }catch(err){ if(err.cancelled) throw err; }
  // Un poco de centro (desempata fotos sin sujeto claro)
  for(let y = 0; y < gh; y++) for(let x = 0; x < gw; x++){
    const dx = (x / gw - 0.5) * 2, dy = (y / gh - 0.5) * 2;
    imp[y * gw + x] = imp[y * gw + x] + 0.08 * Math.max(0, 1 - Math.hypot(dx, dy));
  }
  // Caras: pesan mucho más (y la cabeza, algo por encima de la caja)
  let faces = [];
  try{ const { detectFaces } = await import("../ai/faces.js"); faces = await detectFaces(src); }catch(err){ if(err.cancelled) throw err; }
  const fb = faces.map(f => ({ x: f.x * k, y: (f.y - f.h * 0.35) * k, w: f.w * k, h: f.h * 1.5 * k }));
  for(const f of fb){
    const x0 = Math.max(0, Math.floor(f.x)), y0 = Math.max(0, Math.floor(f.y)), x1 = Math.min(gw, Math.ceil(f.x + f.w)), y1 = Math.min(gh, Math.ceil(f.y + f.h));
    for(let y = y0; y < y1; y++) for(let x = x0; x < x1; x++) imp[y * gw + x] += 3;
  }
  return { imp, gw, gh, k, faces: fb };
}

/* Mejor recorte del formato `ar` (ancho/alto) en coordenadas de la foto */
export function bestCrop(M, ar, W, H){
  const { imp, gw, gh, k, faces } = M;
  // Suma acumulada 2D
  const S = new Float64Array((gw + 1) * (gh + 1));
  for(let y = 0; y < gh; y++){ let row = 0; for(let x = 0; x < gw; x++){ row += imp[y * gw + x]; S[(y + 1) * (gw + 1) + x + 1] = S[y * (gw + 1) + x + 1] + row; } }
  const sum = (x0, y0, x1, y1) => S[y1 * (gw + 1) + x1] - S[y0 * (gw + 1) + x1] - S[y1 * (gw + 1) + x0] + S[y0 * (gw + 1) + x0];
  const total = sum(0, 0, gw, gh) || 1;
  // Recorte máximo del formato
  let mw = gw, mh = gw / ar;
  if(mh > gh){ mh = gh; mw = gh * ar; }
  let best = null;
  for(let s = 1; s >= 0.55; s -= 0.05){
    const cw = Math.max(2, Math.round(mw * s)), ch = Math.max(2, Math.round(mh * s));
    const stepX = Math.max(1, Math.round((gw - cw) / 40)), stepY = Math.max(1, Math.round((gh - ch) / 40));
    for(let y = 0; y + ch <= gh; y += stepY) for(let x = 0; x + cw <= gw; x += stepX){
      const inside = sum(x, y, x + cw, y + ch) / total;
      // Lo importante cortado por el borde (una banda de 1 px por lado)
      const band = (sum(x, y, x + cw, y + 1) + sum(x, y + ch - 1, x + cw, y + ch) + sum(x, y, x + 1, y + ch) + sum(x + cw - 1, y, x + cw, y + ch)) / (2 * (cw + ch)) / (total / (gw * gh));
      // Caras cortadas: dentro a medias
      let cut = 0;
      for(const f of faces){
        const ox = Math.max(0, Math.min(x + cw, f.x + f.w) - Math.max(x, f.x)), oy = Math.max(0, Math.min(y + ch, f.y + f.h) - Math.max(y, f.y));
        const fr = ox * oy / Math.max(1e-6, f.w * f.h);
        if(fr > 0.05 && fr < 0.97) cut += 1;
      }
      // Centro de lo importante cerca de un punto fuerte de los tercios
      let cx = 0, cy = 0, cs = 0;
      for(let yy = y; yy < y + ch; yy += 2) for(let xx = x; xx < x + cw; xx += 2){ const v = imp[yy * gw + xx]; cx += v * xx; cy += v * yy; cs += v; }
      let thirds = 0;
      if(cs > 0){
        const px = (cx / cs - x) / cw, py = (cy / cs - y) / ch;
        const d = Math.min(...[[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3],[0.5,0.5]].map(([a, b]) => Math.hypot(px - a, py - b)));
        thirds = Math.max(0, 1 - d / 0.3);
      }
      const score = inside * 1.0 - band * 0.08 - cut * 0.6 + thirds * 0.06 + s * 0.25;
      if(!best || score > best.score) best = { score, x, y, cw, ch };
    }
  }
  const f = 1 / k;
  let rw = best.cw * f, rh = rw / ar;
  if(rh > H){ rh = H; rw = rh * ar; }
  if(rw > W){ rw = W; rh = rw / ar; }
  const rx = Math.max(0, Math.min(W - rw, best.x * f)), ry = Math.max(0, Math.min(H - rh, best.y * f));
  return { x: rx, y: ry, w: rw, h: rh };
}

let open = false;
export async function openSmartCrop(){
  if(open) return;
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  const { flatten } = await import("../editor/layertree.js");
  const src = flatten(), W = src.width, H = src.height;
  let M;
  status("Analizando la foto…");
  try{ M = await importanceMap(src); }
  catch(err){ status(""); if(!err.cancelled) toast("No se pudo analizar la foto: " + err.message, "err"); return; }
  status("");
  open = true;
  const { createShell, ensureShellStyles } = await import("../ui/fsshell.js");
  await ensureShellStyles();
  let fmt = FORMATS[1], rect = bestCrop(M, fmt[2], W, H);
  const close = () => { open = false; sh.close(); };
  const sh = createShell({
    title: "Recorte inteligente", subtitle: "Premium 👑 · arrastra el marco para afinarlo", applyLabel: "Recortar",
    onCancel: close,
    onApply: async () => {
      const r = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) };
      close();
      const { state, applyCrop } = await import("../editor/tools.js");
      state.cropRect = r; applyCrop();
    }
  });
  sh.setView(src, false);
  // Fuera del recorte, oscurecido; dentro, los tercios
  sh.setOverlay((cx, t) => {
    const X = t.ox + rect.x * t.k, Y = t.oy + rect.y * t.k, RW = rect.w * t.k, RH = rect.h * t.k;
    const IW = W * t.k, IH = H * t.k;
    cx.fillStyle = "rgba(0,0,0,.55)";
    cx.fillRect(t.ox, t.oy, IW, Y - t.oy); cx.fillRect(t.ox, Y + RH, IW, t.oy + IH - Y - RH);
    cx.fillRect(t.ox, Y, X - t.ox, RH); cx.fillRect(X + RW, Y, t.ox + IW - X - RW, RH);
    cx.strokeStyle = "#e8a33d"; cx.lineWidth = 2 * t.dpr; cx.strokeRect(X, Y, RW, RH);
    cx.strokeStyle = "rgba(255,255,255,.45)"; cx.lineWidth = t.dpr;
    for(const q of [1 / 3, 2 / 3]){
      cx.beginPath(); cx.moveTo(X + RW * q, Y); cx.lineTo(X + RW * q, Y + RH); cx.stroke();
      cx.beginPath(); cx.moveTo(X, Y + RH * q); cx.lineTo(X + RW, Y + RH * q); cx.stroke();
    }
  });
  // Arrastrar el marco
  let drag = null;
  sh.setInteract((type, p) => {
    if(type === "down"){
      if(p.x < rect.x || p.y < rect.y || p.x > rect.x + rect.w || p.y > rect.y + rect.h) return false;
      drag = { dx: p.x - rect.x, dy: p.y - rect.y }; return true;
    }
    if(type === "move" && drag && p){
      rect = { ...rect, x: Math.max(0, Math.min(W - rect.w, p.x - drag.dx)), y: Math.max(0, Math.min(H - rect.h, p.y - drag.dy)) };
      sh.redraw();
    }
    if(type === "up" || type === "cancel") drag = null;
    return false;
  });
  // Mando mínimo: el formato (desplegable cerrado)
  const ctl = () => {
    const el = document.createElement("div"); el.className = "face-ctl smartcrop-ctl";
    el.innerHTML = `<select aria-label="Formato">${FORMATS.map(f => `<option value="${f[0]}">${f[1]}</option>`).join("")}</select>`;
    const s = el.querySelector("select"); s.value = fmt[0];
    s.addEventListener("change", () => {
      fmt = FORMATS.find(f => f[0] === s.value); rect = bestCrop(M, fmt[2], W, H);
      sh.root.querySelectorAll(".smartcrop-ctl select").forEach(o => o.value = fmt[0]);
      sh.redraw();
    });
    return el;
  };
  sh.mobile.appendChild(ctl()); sh.right.appendChild(ctl());
}
