/* ═══════════════════════════════════════════════════════════════
   ESTILOS
   Más de ciento cincuenta looks (treinta clásicos y el catálogo
   ampliado de más abajo), por categorías y con buscador, construidos exactamente igual que el ajuste de
   Curvas manual: una curva maestra de contraste, una curva por canal
   para el tinte de color, y un empujón de saturación. Ningún nombre
   ni ninguna receta copia un filtro concreto de ninguna aplicación:
   son combinaciones propias que persiguen el mismo tipo de resultado
   —cálido y desvaído, frío y contrastado, pastel, etc.— con las
   herramientas que ya tiene este editor.

   v260: además de las recetas de curvas de arriba, hay estilos por capas convertidos de acciones de Photoshop (assets/estilos/*.json, ver
   tools/atn/ y filters/looks/styleengine.js): copias de la imagen, capas de ajuste, rellenos de degradado, destellos de luz… Se cargan al abrir la
   herramienta y se añaden DESPUÉS de los clásicos: un estilo se guarda en la capa por su posición (picked) y por su id.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer } from "../../core/doc.js";
import { runAdjust } from "../../editor/adjust/adjust.js";
import { dialog } from "../../ui/kit/dialog.js";
import { toast } from "../../core/toast.js";
import { renderStyle, styleIsPure, registerTexture, hasTexture, recipeTextures } from "./styleengine.js";

export { LOOKS, LOOK_CATS, applyLook } from "./catalog.js";
import { LOOKS, LOOK_CATS, applyLook } from "./catalog.js";

/* ── Estilos por capas (recetas convertidas de acciones .atn) ───────────────── */
export const RECIPES = [];                 // { id, name, cat, pack, recipe }
export const RECIPE_CATS = [];             // categorías en el orden en que aparecen
let recipesLoaded = null;
/** Carga (una vez) los archivos de assets/estilos. Si falla (sin red y sin caché), sólo quedan los clásicos. */
export function loadRecipes(){
  return recipesLoaded ||= (async () => {
    try{
      const base = new URL("../../../assets/estilos/", import.meta.url);
      const idx = await (await fetch(new URL("index.json", base))).json();
      const packs = await Promise.all(idx.packs.map(async p => (await fetch(new URL(p.file, base))).json()));
      for(const pk of packs) for(const st of pk.styles){
        RECIPES.push({ ...st, pack: pk.pack });
        if(!RECIPE_CATS.includes(st.cat)) RECIPE_CATS.push(st.cat);
      }
    }catch(err){ console.warn("[estilos] no se pudieron cargar los estilos por capas", err); recipesLoaded = null; }
  })();
}
/** Entrada de la lista unificada (clásicos primero, luego recetas) */
export function styleAt(i){
  if(i < 0) return null;
  if(i < LOOKS.length) return LOOKS[i];
  return RECIPES[i - LOOKS.length] || null;
}
export const styleCount = () => LOOKS.length + RECIPES.length;
export const allStyleCats = () => [...LOOK_CATS, ...RECIPE_CATS.filter(c => !LOOK_CATS.includes(c))];
/** Posición de un estilo por su id (los clásicos no tienen id: se identifican por posición) */
export function indexOfId(id){ const j = RECIPES.findIndex(r => r.id === id); return j < 0 ? -1 : LOOKS.length + j; }

/* Texturas de los estilos de destellos y bokeh: se descargan sólo al usarlas (la grande, a resolución completa) o al ver la cuadrícula (la miniatura) */
const texLoading = new Map(), TEX_KEEP = 3, texOrder = [];
async function loadTex(src, thumb){
  const key = thumb ? src + "#t" : src;
  if(hasTexture(src, thumb)) return;
  if(!texLoading.has(key)) texLoading.set(key, (async () => {
    const url = new URL("../../../assets/estilos/" + (thumb ? src.replace(/\.jpg$/, "-t.jpg") : src), import.meta.url);
    const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: "none" });
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
    const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(bmp, 0, 0); bmp.close?.();
    registerTexture(src, c.width, c.height, cx.getImageData(0, 0, c.width, c.height).data, thumb);
  })().finally(() => texLoading.delete(key)));
  return texLoading.get(key);
}
/** Deja listo un estilo antes de calcularlo (descarga sus texturas). Devuelve false si no se pudo. */
export async function prepareStyle(i, thumb = false){
  const s = styleAt(i); if(!s || !s.recipe) return true;
  const srcs = recipeTextures(s.recipe); if(!srcs.length) return true;
  try{ await Promise.all(srcs.map(u => loadTex(u, thumb))); return true; }
  catch(err){ console.warn("[estilos] no se pudo cargar la textura de", s.name, err); toast("No se pudo cargar la textura de este estilo"); return false; }
}
/** Miniaturas de todos los estilos con textura de una categoría (se piden al abrir la cuadrícula) */
export function prepareThumbs(idxs){ return Promise.all(idxs.map(i => prepareStyle(i, true))); }
/** Aplica el estilo `i` a unos píxeles RGBA con la intensidad t (0-1) */
export function applyStyleAt(data, w, h, i, t){
  const s = styleAt(i); if(!s) return;
  if(s.recipe){ renderStyle(data, w, h, s.recipe, { intensity: t }); return; }
  const orig = t < 1 ? Uint8ClampedArray.from(data) : null;
  applyLook(data, s);
  if(orig) for(let k = 0; k < data.length; k += 4){
    data[k] = orig[k] + (data[k] - orig[k]) * t; data[k+1] = orig[k+1] + (data[k+1] - orig[k+1]) * t; data[k+2] = orig[k+2] + (data[k+2] - orig[k+2]) * t;
  }
}

/** Miniaturas: un recorte cuadrado y centrado de la imagen, reducido, con cada estilo aplicado (con caché) */
export function makeThumbs(source, S = 112, onReady){
  const base = document.createElement("canvas"); base.width = base.height = S;
  const bx = base.getContext("2d", { willReadFrequently: true }), side = Math.min(source.width, source.height);
  bx.imageSmoothingQuality = "high";
  bx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, S, S);
  const baseData = bx.getImageData(0, 0, S, S), cache = new Map();
  return {
    original: base,
    canvas(i){
      if(cache.has(i)) return cache.get(i);
      // estilo con textura aún sin descargar: de momento la foto sin cambios (no se guarda) y, al llegar la miniatura, se avisa para repintar
      const st = i >= 0 ? styleAt(i) : null;
      if(st && st.recipe && recipeTextures(st.recipe).some(u => !hasTexture(u) && !hasTexture(u, true))){
        prepareStyle(i, true).then(ok => { if(ok) onReady?.(i); });
        return base;
      }
      const img = new ImageData(new Uint8ClampedArray(baseData.data), S, S);
      try{ if(i >= 0) applyStyleAt(img.data, S, S, i, 1); }catch(err){ console.warn("[estilos] miniatura", i, err); }
      const c = document.createElement("canvas"); c.width = c.height = S; c.getContext("2d").putImageData(img, 0, 0);
      cache.set(i, c); return c;
    },
    has: i => cache.has(i)
  };
}

export async function openLooks(opts = {}){
  const state = { picked: -1, intensity: 100, ...opts.init };
  await loadRecipes();
  // las capas guardadas llevan el id del estilo: manda sobre la posición si las listas cambian
  if(state.id){ const j = indexOfId(state.id); if(j >= 0) state.picked = j; }
  if(state.picked >= 0) await prepareStyle(state.picked);
  if(!opts.render){
    const layer = opts.edit || activeLayer();
    if(!layer){ toast("No hay capa activa"); return; }
  }
  const fullscreen = !opts.container && !opts.render;
  if(fullscreen) lookFsRef ||= await import("./looksfs.js");
  const pure = () => { const s = styleAt(state.picked); return !s || !s.recipe || styleIsPure(s.recipe); };
  let applied = false;

  const res = await runAdjust({
    title: "Estilos",
    wide: true,
    asLayer: true, filterId: "look", filterParams: state,
    fullscreen,
    previewLimit: 5e5, refineEstMs: 8000, refineRealMs: 4000,
    float: () => pure() ? true : "delta",
    compute(data, w, h){
      if(state.picked < 0) return;
      applyStyleAt(data, w, h, state.picked, state.intensity / 100);
    },
    buildBody({ preview, source }){
      if(fullscreen){
        const { lookFullscreen } = lookFsRef;
        return lookFullscreen({ state, preview, source, edit: !!opts.edit, onApplied: () => { applied = true; },
          api: { styleAt, styleCount, allStyleCats, makeThumbs, prepareStyle, LOOKS, RECIPES, LOOK_CATS } });
      }
      return compactPanel({ state, preview, source });
    }
  }, opts);
  // la capa nueva lleva el nombre del estilo
  if(fullscreen && applied && !opts.edit){
    const l = activeLayer(), s = styleAt(state.picked);
    if(l && s && l.filters?.[0]?.id === "look"){ l.name = `Estilos · ${s.name}`; try{ (await import("../../core/bus.js")).emit("doc:structure"); }catch{} }
  }
  return res;
}
let lookFsRef = null;

/* Panel compacto (panel de Propiedades): buscador, categorías, rejilla de miniaturas e intensidad */
function compactPanel({ state, preview, source }){
  const box = document.createElement("div");
  box.innerHTML = `
    <input type="search" id="lkSearch" placeholder="Buscar estilo…" style="width:100%;box-sizing:border-box;margin-bottom:8px">
    <div id="lkCats" class="seg" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px"></div>
    <div id="lkGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));
         gap:8px;margin-bottom:10px;max-height:52vh;overflow:auto;padding-right:2px"></div>
    <div class="field" id="lkIntRow" style="display:${state.picked >= 0 ? "flex" : "none"}">
      <label>Intensidad</label>
      <input type="range" id="lkInt" class="grow" min="0" max="100" value="${Math.round(state.intensity)}">
      <span class="unit mono" id="lkIntV">${Math.round(state.intensity)}%</span>
    </div>`;
  const grid = box.querySelector("#lkGrid"), th = makeThumbs(source, 96, i => { const c = cells.find(x => x.idx === i); if(c) c.cell.__paint?.(); }), cells = [];
  const mkCell = (name, idx) => {
    const cell = document.createElement("button");
    cell.style.cssText = "padding:0;display:flex;flex-direction:column;gap:4px;background:transparent;border:0";
    const cv = document.createElement("canvas"); cv.width = cv.height = 96;
    cv.style.cssText = "width:100%;border-radius:var(--r);border:2px solid var(--line);display:block";
    const label = document.createElement("span"); label.textContent = name;
    label.style.cssText = "font-size:var(--fs-xs);color:var(--tx-dim);text-align:center;white-space:normal;overflow-wrap:anywhere;line-height:1.2";
    cell.append(cv, label);
    cell.dataset.cat = idx >= 0 ? styleAt(idx).cat : ""; cell.dataset.name = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    cell.__paint = () => cv.getContext("2d").drawImage(th.canvas(idx), 0, 0, 96, 96);
    cell.addEventListener("click", async () => {
      if(idx >= 0 && !(await prepareStyle(idx))) return;
      state.picked = idx; state.id = idx >= LOOKS.length ? styleAt(idx).id : undefined;
      cells.forEach(c => c.cv.style.borderColor = "var(--line)"); cv.style.borderColor = "var(--ac)";
      box.querySelector("#lkIntRow").style.display = idx >= 0 ? "flex" : "none"; preview();
    });
    cells.push({ cv, idx, cell }); return cell;
  };
  grid.appendChild(mkCell("Original", -1)); grid.firstChild.__paint();
  const cats = allStyleCats(), pending = [];
  for(const c of cats) for(let i = 0; i < styleCount(); i++){ const s = styleAt(i); if(s.cat !== c) continue; const el = mkCell(s.name, i); grid.appendChild(el); pending.push(el); }
  (function paintSome(){ const batch = pending.splice(0, 12); batch.forEach(c => c.__paint?.()); if(pending.length) requestAnimationFrame(paintSome); })();
  let cat = "Todos", query = "";
  const filter = () => {
    const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    for(const el of grid.children){
      const ok = !el.dataset.cat || ((cat === "Todos" || el.dataset.cat === cat) && (!q || el.dataset.name.includes(q)));
      el.style.display = ok ? "" : "none";
    }
  };
  const catBox = box.querySelector("#lkCats");
  for(const c of ["Todos", ...cats]){
    const b = document.createElement("button"); b.type = "button"; b.textContent = c + (c === "Todos" ? ` (${styleCount()})` : "");
    b.style.cssText = "flex:0 0 auto;padding:4px 9px"; b.classList.toggle("on", c === cat);
    b.addEventListener("click", () => { cat = c; catBox.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); filter(); });
    catBox.appendChild(b);
  }
  box.querySelector("#lkSearch").addEventListener("input", e => { query = e.target.value; filter(); });
  (cells.find(c => c.idx === state.picked) || cells[0]).cv.style.borderColor = "var(--ac)";
  box.querySelector("#lkInt").addEventListener("input", e => { state.intensity = +e.target.value; box.querySelector("#lkIntV").textContent = e.target.value + "%"; preview(); });
  return box;
}
