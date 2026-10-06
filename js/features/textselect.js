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
   Partes de la cara (fase 20): «pelo», «ojos y labios», «cuello»… se
   resuelven con BiSeNet (js/ai/textclasses.js › FACE_PARTS), de uso NO
   comercial (ver js/ai/models.js › faceparse).
   LÍMITE: el vocabulario es cerrado (esas 150 categorías más las partes de
   la cara); no entiende «una taza con un dibujo». Un modelo de vocabulario
   abierto (CLIPSeg…) exigiría descargarlo de Hugging Face: ver PENDIENTE.
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
    else msg.textContent = p.terms.map(t => `${t.neg ? "sin " : ""}${t.label || "color"}${t.open ? " (IA, descripción libre)" : ""}`).join(" · ") + (p.unknown.length ? ` (ignoro: ${p.unknown.join(", ")})` : "")
      + (p.terms.some(t => t.open) ? " · La primera vez se descarga el modelo CLIPSeg (273 MB)." : "");
    if(ok) ok.disabled = !p.terms.length || p.terms.every(t => t.neg);
  };
  const go = await dialog({
    title: "Seleccionar por texto · Premium 👑", cls: "dlg-textsel",
    body: `<div class="field"><label>Qué</label><input type="text" class="grow" data-k="q" placeholder="persona, cielo, pelo, una taza azul…" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
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

/**
 * Descripción libre con CLIPSeg (fase 20): «una taza azul con un dibujo», «el logo»… El texto se traduce al inglés (js/ai/es2en.js),
 * se pasa por el tokenizador de CLIP y el modelo (fp16, 273 MB, se descarga una vez avisando) da, para una vista de 352×352, la probabilidad
 * de que cada píxel sea eso. Vista de la foto entera + (si es grande) 2×2 mosaicos con solape, que ven los detalles más finos; se
 * promedian con ventana suave y la máscara resultante, a tamaño completo, pasa después por el ajuste de borde con filtro guiado.
 */
export async function openVocabMask(src, text, W, H, title){
  const [{ loadClipTokenizer }, { toEnglish }, { runModel }] = await Promise.all([import("../ai/cliptokenizer.js"), import("../ai/es2en.js"), import("../ai/runtime.js")]);
  const tok = await loadClipTokenizer(), en = toEnglish(text).text || String(text);
  const { ids, mask } = tok.pad(en);
  const big = Math.min(W, H) >= 640;
  /* Vistas de la foto: entera y, si es grande, cuatro mosaicos de 0,6 (objetos medianos). Si con eso no se ve claro (probabilidad máxima < 0,7), se busca un
     objeto PEQUEÑO con nueve mosaicos de 0,4 más: en esa escala el modelo ve, p. ej., un semáforo o una señal (0,1 → 0,8) que en la foto entera se le pierde. */
  const mk = (list, f, n) => { const tw = W * f, th = H * f; for(let iy = 0; iy < n; iy++) for(let ix = 0; ix < n; ix++) list.push({ x: (W - tw) * ix / (n - 1), y: (H - th) * iy / (n - 1), w: tw, h: th }); return list; };
  const views = [{ x: 0, y: 0, w: W, h: H, whole: true }];
  if(big) mk(views, 0.6, 2);
  const crop = v => { const c = document.createElement("canvas"); c.width = c.height = 352; const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high";
    x.drawImage(src, v.x, v.y, v.w, v.h, 0, 0, 352, 352); return x.getImageData(0, 0, 352, 352).data; };            // CLIPSeg entrena con recortes estirados a 352×352
  const infer = async list => { const tiles = list.map(crop); return (await runModel("clipseg", "clipseg", { tiles, ids, mask }, tiles.map(t => t.buffer), { title })).outs; };
  const outs = await infer(views);
  const peakOf = lg => { let m = 0; for(let i = 0; i < lg.length; i++){ const v = 1 / (1 + Math.exp(-lg[i])); if(v > m) m = v; } return m; };
  let fine = [], fineOuts = [];
  if(big && Math.min(W, H) >= 900 && Math.max(...outs.map(peakOf)) < 0.7){ fine = mk([], 0.4, 3); fineOuts = await infer(fine); }
  // Probabilidades combinadas a una rejilla de trabajo de ≤ 1024 px
  const k = Math.min(1, 1024 / Math.max(W, H)), gw = Math.max(8, Math.round(W * k)), gh = Math.max(8, Math.round(H * k));
  const acc = new Float32Array(gw * gh), wsum = new Float32Array(gw * gh), small = new Float32Array(gw * gh);
  const paint = (v, lg, edge, into) => {
    const x0 = Math.max(0, Math.floor(v.x * k)), x1 = Math.min(gw, Math.ceil((v.x + v.w) * k)), y0 = Math.max(0, Math.floor(v.y * k)), y1 = Math.min(gh, Math.ceil((v.y + v.h) * k));
    for(let y = y0; y < y1; y++){
      const ty = ((y + 0.5) / k - v.y) / v.h, fy = Math.min(351, Math.max(0, ty * 352 - 0.5)), a0 = fy | 0, a1 = Math.min(351, a0 + 1), dy = fy - a0;
      for(let xx = x0; xx < x1; xx++){
        const tx = ((xx + 0.5) / k - v.x) / v.w, fx = Math.min(351, Math.max(0, tx * 352 - 0.5)), b0 = fx | 0, b1 = Math.min(351, b0 + 1), dx = fx - b0;
        const l = (lg[a0 * 352 + b0] * (1 - dx) + lg[a0 * 352 + b1] * dx) * (1 - dy) + (lg[a1 * 352 + b0] * (1 - dx) + lg[a1 * 352 + b1] * dx) * dy;
        into(y * gw + xx, 1 / (1 + Math.exp(-l)), edge(Math.min(1, Math.max(0, tx)), Math.min(1, Math.max(0, ty))), v);
      }
    }
  };
  views.forEach((v, vi) => paint(v, outs[vi], (tx, ty) => v.whole ? 1 : 0.15 + 1.35 * Math.sin(Math.PI * tx) * Math.sin(Math.PI * ty), (i, p, w) => { acc[i] += w * p; wsum[i] += w; }));
  // mosaicos finos: sólo cuentan los que ven algo con claridad (≥ 0,5), con un fundido de 15 % en los bordes para que no se vean costuras; se toma el máximo
  fine.forEach((v, vi) => { if(peakOf(fineOuts[vi]) < 0.5) return;
    paint(v, fineOuts[vi], (tx, ty) => Math.min(1, Math.min(tx, 1 - tx, ty, 1 - ty) / 0.15), (i, p, w) => { const q = p * w; if(q > small[i]) small[i] = q; }); });
  let peak = 0; const p = new Float32Array(gw * gh);
  for(let i = 0; i < p.length; i++){ p[i] = Math.max(wsum[i] ? acc[i] / wsum[i] : 0, small[i]); if(p[i] > peak) peak = p[i]; }
  const out = new Uint8ClampedArray(W * H);
  if(peak < 0.4) return out;                                                   // el modelo no ve eso en la foto
  for(let y = 0; y < H; y++){
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) * k - 0.5)), a0 = fy | 0, a1 = Math.min(gh - 1, a0 + 1), dy = fy - a0;
    for(let xx = 0; xx < W; xx++){
      const fx = Math.min(gw - 1, Math.max(0, (xx + 0.5) * k - 0.5)), b0 = fx | 0, b1 = Math.min(gw - 1, b0 + 1), dx = fx - b0;
      const v = (p[a0 * gw + b0] * (1 - dx) + p[a0 * gw + b1] * dx) * (1 - dy) + (p[a1 * gw + b0] * (1 - dx) + p[a1 * gw + b1] * dx) * dy;
      const t = Math.min(1, Math.max(0, (v - 0.32) / 0.3));
      out[y * W + xx] = t * t * (3 - 2 * t) * 255 + 0.5;
    }
  }
  return out;
}

/** Máscara 0-255 del tamaño de `src` para un término (unión de clases, con su color). */
async function termMask(src, term, px, W, H, SEG, title){
  const n = W * H;
  let m;
  if(term.open) m = await openVocabMask(src, term.open, W, H, title);
  else if(term.parts) m = await facePartsMask(src, term.parts, W, H, title);
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
