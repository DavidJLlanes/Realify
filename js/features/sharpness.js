/* ═══════════════════════════════════════════════════════════════
   ANÁLISIS DE NITIDEZ (fase 8 de PENDIENTE.md)
   Menú Imagen › Análisis de nitidez…

     · Mapa de enfoque: una capa nueva, a resolución completa, que
       colorea lo que está nítido (azul = algo, verde, amarillo, rojo =
       muy nítido) y deja transparente lo que no lo está: se ve de un
       vistazo dónde cayó el foco y si la foto salió movida.
     · Mejor toma: de varias tomas parecidas (ráfaga, horquillado,
       varios disparos del mismo motivo), ordena de más a menos nítida
       con una nota de 0 a 100 y abre la mejor. La nota mide la
       varianza del Laplaciano en los bloques más nítidos de cada foto
       (a 1024 px, para poder comparar tamaños distintos), así que un
       cielo liso no hunde la nota.
   Matemática en js/cv/stackmath.js (sin DOM).
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../ui/dialog.js";
import { toast, progress, status } from "../ui/toast.js";
import { doc } from "../core/doc.js";

const MAX = 24;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const pixels = c => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;

async function currentFlat(){
  const { flatten } = await import("../editor/layertree.js");
  const c = flatten(), r = document.createElement("canvas"); r.width = c.width; r.height = c.height;
  r.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
  return r;
}

/** Mapa de enfoque a tamaño completo, a una capa nueva. */
async function makeFocusMap(){
  if(!doc.open){ toast("Abre una imagen primero"); return; }
  status("Midiendo la nitidez…"); progress(0.05);
  await new Promise(r => setTimeout(r, 30));
  try{
    const M = await import("../cv/stackmath.js"), src = await currentFlat(), W = src.width, H = src.height, img = pixels(src);
    const ref = M.focusMapRef(img, W, H);
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const ox = out.getContext("2d"), rows = Math.max(32, Math.floor(2e6 / W));
    for(let y0 = 0; y0 < H; y0 += rows){
      const y1 = Math.min(H, y0 + rows), strip = new Uint8ClampedArray(W * (y1 - y0) * 4);
      M.focusMapRows(img, W, H, y0, y1, strip, ref);
      ox.putImageData(new ImageData(strip, W, y1 - y0), 0, y0);
      progress(0.05 + 0.9 * y1 / H); await new Promise(r => setTimeout(r, 0));
    }
    const { resultToLayer } = await import("../ui/fsshell.js");
    await resultToLayer(out, { name: "Mapa de enfoque" });
    progress(null); toast("Mapa de enfoque en una capa nueva: rojo y amarillo = lo más nítido", "ok");
  }catch(err){ console.error(err); progress(null); toast("No se pudo medir: " + (err.message || err), "err"); }
  finally{ status(""); }
}

export async function openSharpness(){
  const items = [];                                  // { name, file | tabId, score, thumb }
  let bodyEl = null, busy = false;

  const thumbOf = c => { const k = 96 / Math.max(c.width, c.height), t = document.createElement("canvas"); t.width = Math.max(1, Math.round(c.width * k)); t.height = Math.max(1, Math.round(c.height * k)); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", .7); };
  const score = async c => { const M = await import("../cv/stackmath.js"); return M.focusScore(pixels(c), c.width, c.height); };

  const render = async () => {
    if(!bodyEl) return;
    const M = await import("../cv/stackmath.js");
    const list = bodyEl.querySelector(".shp-list"), sorted = items.slice().sort((a, b) => b.score - a.score), top = sorted[0]?.score || 1;
    list.innerHTML = sorted.length ? sorted.map((it, i) => `<div class="shp-it${i === 0 ? " best" : ""}" title="${esc(it.name)}"><img src="${it.thumb}" alt=""><div class="shp-tx"><b>${i === 0 ? "★ " : ""}${esc(it.name)}</b><div class="shp-bar"><i style="width:${Math.max(3, 100 * it.score / top)}%"></i></div></div><span class="mono">${Math.round(M.scoreTo100(it.score))}</span></div>`).join("") : '<p class="hint" style="margin:0">Añade tomas parecidas para saber cuál salió más nítida.</p>';
    const best = bodyEl.closest(".modal")?.querySelector(".modal-foot button.primary"); if(best) best.disabled = !sorted.length;
  };

  const addFiles = async () => {
    if(busy) return; busy = true;
    try{
      const { pickFiles, decodePhoto } = await import("../ui/fsshell.js");
      const files = await pickFiles({ gallery: true });
      for(const f of files){
        if(items.length >= MAX) break;
        status(`Midiendo ${f.name}…`);
        try{ const c = await decodePhoto(f, 1400); items.push({ name: f.name, file: f, score: await score(c), thumb: thumbOf(c) }); }catch{ toast(`No se pudo abrir «${f.name}»`, "err"); }
        await new Promise(r => setTimeout(r, 0));
      }
    } finally { busy = false; status(""); await render(); }
  };
  const addOpen = async () => {
    if(busy) return; busy = true;
    try{
      const docs = await import("../core/documents.js"), { flatten } = await import("../editor/layertree.js");
      const tabs = docs.listTabs();
      if(!tabs.length){ toast("No hay fotos abiertas"); return; }
      const start = docs.activeTab()?.tabId ?? null;
      try{
        for(const t of tabs){
          if(items.some(i => i.tabId === t.tabId) || items.length >= MAX) continue;
          if(t.tabId !== docs.activeTab()?.tabId && !docs.switchTo(t.tabId, { force: true })) continue;
          if(!doc.open) continue;
          const f = flatten(), c = document.createElement("canvas"), k = Math.min(1, 1400 / Math.max(f.width, f.height)); c.width = Math.round(f.width * k); c.height = Math.round(f.height * k);
          c.getContext("2d", { willReadFrequently: true }).drawImage(f, 0, 0, c.width, c.height);
          items.push({ name: t.title || "Foto", tabId: t.tabId, score: await score(c), thumb: thumbOf(c) });
        }
      } finally { if(start !== null && docs.activeTab()?.tabId !== start) docs.switchTo(start, { force: true }); }
    } finally { busy = false; await render(); }
  };

  const res = await dialog({
    title: "Análisis de nitidez", cls: "dlg-sharp",
    body: `<style>.shp-list{display:grid;gap:6px;margin:6px 0}.shp-it{display:flex;align-items:center;gap:8px;padding:4px;border:1px solid var(--line,#333);border-radius:8px}.shp-it.best{border-color:var(--accent,#e8a33d)}.shp-it img{width:48px;height:36px;object-fit:cover;border-radius:4px}.shp-tx{flex:1;min-width:0}.shp-tx b{display:block;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.shp-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:4px}.shp-bar i{display:block;height:100%;border-radius:3px;background:var(--accent,#e8a33d)}</style>
      <div style="margin:0 0 14px"><button data-a="map" ${doc.open ? "" : "disabled"}>Mapa de enfoque de esta imagen</button></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button data-a="files">Comparar tomas del dispositivo…</button><button data-a="open">De las abiertas…</button></div>
      <div class="shp-list"></div>`,
    buttons: [{ label: "Cerrar", value: null }, { label: "Abrir la mejor", primary: true, value: "best" }],
    onOpen(body){
      bodyEl = body;
      body.addEventListener("click", e => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if(a === "files") addFiles(); else if(a === "open") addOpen();
        else if(a === "map"){ body.closest(".modal")?.querySelector("[data-close]")?.click(); makeFocusMap(); }
      });
      render();
    }
  });
  if(res !== "best" || !items.length) return;
  const best = items.slice().sort((a, b) => b.score - a.score)[0];
  if(best.tabId !== undefined){ const docs = await import("../core/documents.js"); docs.switchTo(best.tabId, { force: true }); toast(`Abierta la más nítida: ${best.name}`, "ok"); return; }
  const { decodePhoto, resultToLayer } = await import("../ui/fsshell.js");
  const c = await decodePhoto(best.file, 1e5);
  await resultToLayer(c, { name: best.name, docName: best.name.replace(/\.[^.]+$/, ""), newDocument: true });
  toast(`Abierta la más nítida: ${best.name}`, "ok");
}
