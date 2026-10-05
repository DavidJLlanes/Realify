/* ═══════════════════════════════════════════════════════════════
   SELECCIONAR POR TEXTO (Premium 👑 · fase 10 de PENDIENTE.md)
   Menú Selección › Por texto…

   Se escribe lo que se quiere seleccionar —«persona», «cielo»,
   «coche rojo», «césped sin personas»— y sale una selección (o la
   máscara de la capa), editable como cualquier otra.

   Cómo: el modelo DeepLab (ADE20K, Apache-2.0) que ya viaja con la web
   distingue 150 tipos de cosas (js/ai/textclasses.js: nombres y
   sinónimos en español). Se calcula con el mismo método por bloques que
   «Seleccionar cielo» (fase 3: la foto entera para decidir y bloques con
   4 veces más detalle en los bordes), el borde se ajusta a los contornos
   reales de la foto con un filtro guiado, y un adjetivo de color
   («rojo», «azul»…) deja sólo los píxeles de ese color dentro de la
   clase. «Sin X» resta. Todo en el equipo, sin descargas.
   LÍMITE: el vocabulario es cerrado (esas 150 categorías); no entiende
   «una taza con un dibujo». Un modelo de vocabulario abierto (CLIPSeg…)
   exigiría descargarlo de Hugging Face: ver PENDIENTE.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../ui/dialog.js";
import { toast, progress, status } from "../ui/toast.js";
import { doc, activeLayer } from "../core/doc.js";
import { visibleImage } from "./depthtools.js";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export async function openTextSelect({ target = null } = {}){
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  const T = await import("../ai/textclasses.js");
  let q = "", out = target ? "mask" : "sel";
  let bodyEl = null;
  const refresh = () => {
    if(!bodyEl) return;
    const p = T.parseQuery(q), ok = bodyEl.closest(".modal")?.querySelector(".modal-foot button.primary");
    const msg = bodyEl.querySelector(".ts-state");
    if(p.empty) msg.textContent = "Escribe qué quieres seleccionar.";
    else if(!p.terms.length) msg.textContent = `No conozco «${p.unknown.join(" ")}». Prueba con: ${T.EXAMPLES.join(", ")}…`;
    else msg.textContent = p.terms.map(t => `${t.neg ? "sin " : ""}${t.label || "color"}`).join(" · ") + (p.unknown.length ? ` (ignoro: ${p.unknown.join(", ")})` : "");
    if(ok) ok.disabled = !p.terms.length || p.terms.every(t => t.neg);
  };
  const go = await dialog({
    title: "Seleccionar por texto · Premium 👑", cls: "dlg-textsel",
    body: `<div class="field"><label>Qué</label><input type="text" class="grow" data-k="q" placeholder="persona, cielo, coche rojo…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      <p class="hint ts-state" style="margin:6px 0"></p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px">${T.EXAMPLES.map(e => `<button type="button" class="ghost" data-ex="${esc(e)}" style="padding:2px 9px;font-size:12px">${esc(e)}</button>`).join("")}</div>
      ${target ? "" : `<div class="field"><label>Resultado</label><select data-k="out" class="grow"><option value="sel">Selección</option><option value="mask">Máscara de la capa</option></select></div>`}`,
    buttons: [{ label: "Cancelar", value: null }, { label: "Seleccionar", primary: true, value: "go" }],
    onOpen(body){
      bodyEl = body;
      const inp = body.querySelector('[data-k="q"]');
      body.addEventListener("input", e => { if(e.target === inp){ q = inp.value; refresh(); } });
      body.addEventListener("change", e => { if(e.target.dataset.k === "out") out = e.target.value; });
      body.addEventListener("click", e => { const x = e.target.closest("[data-ex]")?.dataset.ex; if(x){ inp.value = x; q = x; refresh(); } });
      body.addEventListener("keydown", e => { if(e.key === "Enter"){ const ok = body.closest(".modal")?.querySelector(".modal-foot button.primary"); if(ok && !ok.disabled) ok.click(); } });
      refresh();
      // Sin dar foco al abrir en el móvil (teclado que tapa el diálogo): sólo en escritorio
      if(!matchMedia("(pointer:coarse)").matches) setTimeout(() => inp.focus(), 50);
    }
  });
  if(go !== "go") return;
  await run(T.parseQuery(q), out, target);
}

/**
 * Partes de la cara (pelo, ojos, labios, orejas, cuello, gafas, sombrero…) con BiSeNet (fase 20): se buscan las caras
 * (YuNet), cada una se analiza en un recorte amplio de 512×512 (con margen para el pelo) y las probabilidades se llevan
 * a la foto con interpolación bilineal. Uso NO comercial del modelo (ver js/ai/models.js › faceparse).
 */
export async function facePartsMask(src, parts, W, H, title){
  const T = await import("../ai/textclasses.js"), { detectFaces } = await import("../ai/faces.js"), { runModel } = await import("../ai/runtime.js");
  const faces = await detectFaces(src);
  if(!faces.length) throw new Error("No veo ninguna cara en la foto");
  /* Dos recortes: los rasgos pequeños (ojos, cejas, nariz, boca, labios, gafas) necesitan la cara ampliada (como el retoque,
     2× el lado de la cara) o el modelo no los ve; el pelo, las orejas, el cuello y el sombrero necesitan margen (2,6×). */
  const FINE = new Set(["ojos", "cejas", "nariz", "boca", "labios", "cara", "gafas"]);
  const groups = [[parts.filter(k => FINE.has(k)), 2.0, 0.45], [parts.filter(k => !FINE.has(k)), 2.6, 0.38]].filter(g => g[0].length);
  const out = new Uint8ClampedArray(W * H);
  for(const f of faces) for(const [keys, mult, cyk] of groups){
    const ch = [...new Set(keys.flatMap(k => T.FACE_PARTS[k].ch))];
    const side = Math.max(f.w, f.h) * mult, cx = f.x + f.w / 2, cy = f.y + f.h * cyk, sx = cx - side / 2, sy = cy - side / 2;
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512); x.imageSmoothingQuality = "high";
    x.drawImage(src, sx, sy, side, side, 0, 0, 512, 512);
    const r = await runModel("parse", "faceparse", { rgba: x.getImageData(0, 0, 512, 512).data, parts: { m: ch } }, [], { title });
    const g = r.groups.m, k = 512 / side;
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy)), x1 = Math.min(W, Math.ceil(sx + side)), y1 = Math.min(H, Math.ceil(sy + side));
    for(let y = y0; y < y1; y++){
      const fy = Math.min(511, Math.max(0, (y + 0.5 - sy) * k - 0.5)), a0 = fy | 0, a1 = Math.min(511, a0 + 1), ty = fy - a0;
      for(let xx = x0; xx < x1; xx++){
        const fx = Math.min(511, Math.max(0, (xx + 0.5 - sx) * k - 0.5)), b0 = fx | 0, b1 = Math.min(511, b0 + 1), tx = fx - b0;
        const t = g[a0 * 512 + b0] + (g[a0 * 512 + b1] - g[a0 * 512 + b0]) * tx, u = g[a1 * 512 + b0] + (g[a1 * 512 + b1] - g[a1 * 512 + b0]) * tx;
        const v = t + (u - t) * ty;
        if(v > out[y * W + xx]) out[y * W + xx] = v;
      }
    }
  }
  return out;
}

/** Máscara 0-255 del tamaño de `src` para un término (unión de clases, con su color). */
async function termMask(src, term, px, W, H, SEG, title){
  const n = W * H;
  let m;
  if(term.parts) m = await facePartsMask(src, term.parts, W, H, title);
  else if(term.classes.length) m = (await SEG.segmentClasses(src, term.classes, title)).mask;
  else { m = new Uint8ClampedArray(n); m.fill(255); }
  if(term.color){
    const T = await import("../ai/textclasses.js");
    for(let i = 0, j = 0; i < n; i++, j += 4){
      if(!m[i]) continue;
      m[i] = m[i] * T.colorMembership(px[j], px[j + 1], px[j + 2], term.color);
    }
  }
  return m;
}

async function run(p, out, target){
  status("Buscando en la foto…"); progress(0.02);
  await new Promise(r => setTimeout(r, 30));
  try{
    const src = await visibleImage(); if(!src) return;
    const W = src.width, H = src.height, n = W * H;
    const SEG = await import("../filters/segment/segment.js");
    const px = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const pos = p.terms.filter(t => !t.neg), neg = p.terms.filter(t => t.neg);
    const res = new Float32Array(n), sub = new Float32Array(n);
    let k = 0; const total = pos.length + neg.length;
    for(const t of pos){
      const m = await termMask(src, t, px, W, H, SEG, `Buscando «${t.label}»`);
      for(let i = 0; i < n; i++){ const v = m[i] / 255; if(v > res[i]) res[i] = v; }
      progress(0.05 + 0.8 * ++k / total);
    }
    for(const t of neg){
      const m = await termMask(src, t, px, W, H, SEG, `Quitando «${t.label}»`);
      for(let i = 0; i < n; i++){ const v = m[i] / 255; if(v > sub[i]) sub[i] = v; }
      progress(0.05 + 0.8 * ++k / total);
    }
    const arr = new Uint8ClampedArray(n);
    let any = 0;
    for(let i = 0; i < n; i++){ const v = Math.max(0, res[i] - sub[i]); arr[i] = v * 255 + 0.5; if(v > 0.5) any++; }
    // Borde ajustado a los contornos de la foto (filtro guiado a ≤ 2000 px)
    status("Ajustando el borde…"); await new Promise(r => setTimeout(r, 0));
    const refined = await refineEdge(arr, px, W, H);
    progress(null);
    if(any < n * 0.0005){ toast("No he encontrado nada de eso en la foto", "err"); return; }
    if(out === "mask"){
      const { setMaskFromArray, setMaskTarget } = await import("../editor/masks.js");
      const layer = target || activeLayer();
      if(!layer || !setMaskFromArray(layer, refined, "Máscara por texto")){ toast("No se pudo poner la máscara en esa capa", "err"); return; }
      if(layer.id === doc.activeId) setMaskTarget(layer.id);
      toast(`Máscara «${p.terms.map(t => (t.neg ? "sin " : "") + t.label).join(" · ")}» puesta en «${layer.name}»`, "ok");
    } else {
      const { commitSelection } = await import("../editor/selection.js");
      commitSelection(refined, "new");
      toast(`Selección «${p.terms.map(t => (t.neg ? "sin " : "") + t.label).join(" · ")}» lista (${(100 * any / n).toFixed(0)} % de la foto)`, "ok");
    }
  }catch(err){ console.error(err); progress(null); toast("No se pudo seleccionar: " + (err.message || err), "err"); }
  finally{ status(""); }
}

/** Ajusta el borde de una máscara a los contornos de la foto con un filtro guiado (a resolución reducida, con interpolación). */
async function refineEdge(mask, px, W, H){
  const { guidedFilterAlpha } = await import("../editor/refineedge-math.js");
  const k = Math.min(1, 2000 / Math.max(W, H)), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
  if(k >= 1){
    const L = new Float32Array(W * H), A = new Float32Array(W * H);
    for(let i = 0, j = 0; i < L.length; i++, j += 4){ L[i] = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255; A[i] = mask[i] / 255; }
    const F = guidedFilterAlpha(L, A, W, H, Math.max(2, Math.round(Math.max(W, H) / 400)), 0.0006), out = new Uint8ClampedArray(W * H);
    for(let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, F[i])) * 255 + 0.5;
    return out;
  }
  // Reducido: guía y máscara a w×h, filtro, y la corrección se interpola a tamaño completo (la máscara original sigue mandando en lo fino)
  const sl = new Float32Array(w * h), sa = new Float32Array(w * h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const X = Math.min(W - 1, Math.round(x / k)), Y = Math.min(H - 1, Math.round(y / k)), i = Y * W + X, j = i * 4;
    sl[y * w + x] = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255; sa[y * w + x] = mask[i] / 255;
  }
  const F = guidedFilterAlpha(sl, sa, w, h, Math.max(2, Math.round(Math.max(w, h) / 400)), 0.0006), out = new Uint8ClampedArray(W * H);
  for(let y = 0; y < H; y++){
    const fy = Math.min(h - 1, y * k), y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for(let x = 0; x < W; x++){
      const fx = Math.min(w - 1, x * k), x0 = fx | 0, x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const f = (F[y0 * w + x0] * (1 - tx) + F[y0 * w + x1] * tx) * (1 - ty) + (F[y1 * w + x0] * (1 - tx) + F[y1 * w + x1] * tx) * ty;
      const s = (sa[y0 * w + x0] * (1 - tx) + sa[y0 * w + x1] * tx) * (1 - ty) + (sa[y1 * w + x0] * (1 - tx) + sa[y1 * w + x1] * tx) * ty;
      // Se suma lo que el filtro corrige en el borde a la máscara a tamaño completo
      const v = mask[y * W + x] / 255 + (f - s);
      out[y * W + x] = Math.min(1, Math.max(0, v)) * 255 + 0.5;
    }
  }
  return out;
}

/** Desde menú Capa › Máscara de capa: a la capa activa. */
export function maskByTextCommand(){
  const l = activeLayer();
  if(!l){ toast("No hay capa activa"); return; }
  return openTextSelect({ target: l });
}
