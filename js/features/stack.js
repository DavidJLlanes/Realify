/* ═══════════════════════════════════════════════════════════════
   APILAR FOTOS (Premium 👑 · fase 7 de PENDIENTE.md)
   Menú Imagen › Apilar fotos…

   Varias tomas de la misma escena, hechas a pulso, se alinean con
   precisión subpíxel (OpenCV: puntos ORB + RANSAC + ECC, y opcionalmente
   flujo óptico, ver js/cv/align.js) y se combinan:

     · Reducir ruido: media de las tomas en luz lineal, rechazando lo que
       se mueve (gente, hojas) con el ruido medido en la propia pila;
       N tomas bajan el ruido en √N.
     · Enfoque: en cada punto gana la toma más nítida (profundidad de
       campo ampliada para macro y paisaje).

   Siempre a la resolución completa que admite el editor, por franjas y
   sin pasar por 8 bits hasta el final (tramado de ±½ nivel). El
   resultado se abre como una foto nueva. OpenCV (11 MB) se descarga sólo
   al usar esto, avisando antes.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../ui/dialog.js";
import { toast, progress, status } from "../ui/toast.js";

const MAX = 16;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
let running = false;

/** Memoria que se permite para las tomas ya alineadas (RGBA de 8 bits). */
const budgetBytes = () => {
  const coarse = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches || /iP(hone|ad|od)/.test(navigator.userAgent);
  return (coarse || (navigator.deviceMemory || 8) <= 4) ? 260e6 : 900e6;
};

export async function openStack(){
  if(running) return;
  const items = [];                                   // { name, file? | tabId? , thumb }
  const S = { mode: "noise", reject: true, flow: false };

  const thumbOf = async file => {
    try{ const bm = await createImageBitmap(file, { resizeWidth: 96 }); const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; c.getContext("2d").drawImage(bm, 0, 0); bm.close(); return c.toDataURL("image/jpeg", .7); }catch{ return ""; }
  };

  let bodyEl = null;
  const render = () => {
    if(!bodyEl) return;
    const list = bodyEl.querySelector(".stk-list");
    list.innerHTML = items.length ? items.map((it, i) => `<div class="stk-it" data-i="${i}" title="${esc(it.name)}">${it.thumb ? `<img src="${it.thumb}" alt="">` : `<span>${esc(it.name.slice(0, 8))}</span>`}<button class="icon ghost" data-del="${i}" aria-label="Quitar">✕</button></div>`).join("") : '<p class="hint" style="margin:0">Añade de 2 a ' + MAX + ' fotos de la misma escena.</p>';
    bodyEl.querySelector(".stk-count").textContent = items.length ? `${items.length} ${items.length === 1 ? "foto" : "fotos"}` : "";
    const ok = bodyEl.closest(".modal")?.querySelector(".modal-foot button.primary");
    if(ok) ok.disabled = items.length < 2;
    bodyEl.querySelector('[data-k="reject"]').closest("label").style.display = S.mode === "noise" ? "" : "none";
  };

  const addFiles = async () => {
    const { pickFiles } = await import("../ui/fsshell.js");
    const files = await pickFiles({ gallery: true });
    for(const f of files){ if(items.length >= MAX) break; items.push({ name: f.name, file: f, thumb: await thumbOf(f) }); }
    render();
  };
  const addOpen = async () => {
    const docs = await import("../core/documents.js"), { doc } = await import("../core/doc.js");
    const tabs = docs.listTabs().length ? docs.listTabs().map(t => ({ id: t.tabId, title: t.title || "Foto", thumb: t.thumb || null, used: items.some(i => i.tabId === t.tabId) })) : (doc.open ? [{ id: null, title: doc.name || "Imagen abierta", thumb: null, used: items.some(i => i.tabId === null) }] : []);
    if(!tabs.length){ toast("No hay fotos abiertas"); return; }
    const { chooseUpTo } = await import("../../hdr/sources.js");
    const ids = tabs.filter(t => !t.used).length === 1 ? [tabs.find(t => !t.used).id] : (await chooseUpTo({ title: "Usar las fotos abiertas", intro: "Entran tal como las estás editando.", items: tabs.map(t => ({ id: t.id, label: t.title, thumb: t.thumb, locked: t.used, note: t.used ? "Ya añadida" : "" })), max: MAX - items.length })).map(v => v === "null" ? null : +v);
    for(const id of ids){ const t = tabs.find(x => x.id === id); if(t && items.length < MAX) items.push({ name: t.title, tabId: id, thumb: t.thumb || "" }); }
    render();
  };

  const go = await dialog({
    title: "Apilar fotos · Premium 👑", cls: "dlg-stack-photos",
    body: `<style>.stk-list{display:flex;flex-wrap:wrap;gap:6px;min-height:56px;margin:0 0 6px}.stk-it{position:relative;width:64px;height:48px;border-radius:6px;overflow:hidden;background:#111;display:grid;place-items:center;font-size:10px}.stk-it img{width:100%;height:100%;object-fit:cover}.stk-it button{position:absolute;top:0;right:0;width:20px;height:20px;padding:0;font-size:11px;background:rgba(0,0,0,.6)}</style>
      <div style="display:flex;gap:8px;margin:0 0 8px;flex-wrap:wrap"><button data-a="files">Del dispositivo…</button><button data-a="open">De las abiertas…</button><span class="stk-count hint" style="margin-left:auto;align-self:center"></span></div>
      <div class="stk-list"></div>
      <div class="field"><label>Para</label><select data-k="mode" class="grow"><option value="noise">Reducir ruido</option><option value="focus">Ampliar el enfoque</option></select></div>
      <label class="check" style="display:flex;gap:8px;align-items:center;margin:8px 0 0"><input type="checkbox" data-k="reject" checked> Quitar lo que se mueve</label>
      <label class="check" style="display:flex;gap:8px;align-items:center;margin:8px 0 0"><input type="checkbox" data-k="flow"> Corregir movimiento fino</label>`,
    buttons: [{ label: "Cancelar", value: null }, { label: "Apilar", primary: true, value: "go" }],
    onOpen(body){
      bodyEl = body;
      body.addEventListener("click", e => {
        const a = e.target.closest("[data-a]")?.dataset.a, d = e.target.closest("[data-del]")?.dataset.del;
        if(a === "files") addFiles(); else if(a === "open") addOpen(); else if(d !== undefined){ items.splice(+d, 1); render(); }
      });
      body.addEventListener("change", e => {
        const k = e.target.dataset.k; if(!k) return;
        S[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; render();
      });
      render();
    }
  });
  if(go !== "go" || items.length < 2) return;
  await runStack(items, S);
}

async function runStack(items, S){
  running = true;
  const fail = m => toast(m, "err");
  try{
    const { loadOpenCv } = await import("../cv/opencv.js");
    status("Preparando OpenCV…"); progress(0.02);
    const lib = await loadOpenCv();
    if(!lib){ return; }
    const { cv } = lib;
    const [{ createAligner, warpToReference }, M, { decodePhoto }, { docSizeLimit }] = await Promise.all([import("../cv/align.js"), import("../cv/stackmath.js"), import("../ui/fsshell.js"), import("../core/device.js")]);

    // Fuentes: archivos o pestañas (compuestas tal como se editan)
    let tabGrab = null;
    if(items.some(i => i.file === undefined)){
      const docs = await import("../core/documents.js"), { doc } = await import("../core/doc.js"), { flatten } = await import("../editor/layertree.js");
      tabGrab = ids => {
        const start = docs.activeTab()?.tabId ?? null, out = new Map();
        try{ for(const id of ids){ if(id !== null && id !== docs.activeTab()?.tabId && !docs.switchTo(id, { force: true })) continue; if(doc.open) out.set(id, flatten()); } }
        finally{ if(start !== null && docs.activeTab()?.tabId !== start) docs.switchTo(start, { force: true }); }
        return out;
      };
    }
    const tabs = tabGrab ? tabGrab(items.filter(i => i.file === undefined).map(i => i.tabId)) : new Map();
    const load = async it => it.file ? await decodePhoto(it.file, 1e5) : tabs.get(it.tabId);

    // Tamaño de trabajo: el de la primera foto, hasta lo que el editor admite
    status("Abriendo las fotos…");
    let first = await load(items[0]); if(!first){ fail("No se pudo abrir la primera foto"); return; }
    const [W, H] = docSizeLimit(first.width, first.height);
    const fit = c => { if(c.width === W && c.height === H) return c; const o = document.createElement("canvas"); o.width = W; o.height = H; const x = o.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, W, H); return o; };
    first = fit(first);
    const per = W * H * 4, maxN = Math.floor(budgetBytes() / per);
    if(maxN < 2){ fail(`Con fotos de ${(W * H / 1e6).toFixed(0)} megapíxeles no caben dos en la memoria de este dispositivo`); return; }
    const list = items.slice(0, maxN);
    if(list.length < items.length) toast(`Este dispositivo admite ${maxN} fotos de este tamaño: se usan las ${maxN} primeras`);

    // Alinear y llevar cada foto al sistema de la primera, una a una
    const aligner = createAligner(cv, first, { flow: S.flow });
    const frames = [], notes = [];
    try{
      for(let i = 0; i < list.length; i++){
        status(`Alineando ${i + 1} de ${list.length}…`); progress(0.05 + 0.5 * i / list.length);
        await new Promise(r => setTimeout(r, 0));
        const c = i === 0 ? first : fit(await load(list[i]));
        if(!c){ notes.push(`«${list[i].name}» no se pudo abrir`); continue; }
        const al = i === 0 ? aligner.identity() : await aligner.align(c);
        if(!al.ok){ notes.push(`«${list[i].name}» no se pudo alinear y se ha omitido`); continue; }
        frames.push((await warpToReference(cv, c, al)).data);
      }
    }finally{ aligner.dispose(); }
    if(frames.length < 2){ fail("No hay suficientes fotos alineables: ¿son de la misma escena?"); return; }

    // Combinar por franjas
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const ox = out.getContext("2d", { willReadFrequently: true });
    const rows = Math.max(16, Math.floor(2.5e6 / W / (S.mode === "focus" ? 2 : 1)));
    const sigmaOf = S.mode === "noise" ? M.noiseCurve(frames, W, H) : null;
    for(let y0 = 0; y0 < H; y0 += rows){
      const y1 = Math.min(H, y0 + rows), strip = new Uint8ClampedArray(W * (y1 - y0) * 4);
      if(S.mode === "noise") M.combineNoise(frames, W, y0, y1, strip, { reject: S.reject, sigmaOf });
      else M.combineFocus(frames, W, H, y0, y1, strip);
      ox.putImageData(new ImageData(strip, W, y1 - y0), 0, y0);
      status(`Combinando… ${Math.round(100 * y1 / H)} %`); progress(0.6 + 0.38 * y1 / H);
      await new Promise(r => setTimeout(r, 0));
    }
    const used = frames.length; frames.length = 0;
    const { resultToLayer } = await import("../ui/fsshell.js");
    const label = S.mode === "noise" ? "Apilado · menos ruido" : "Apilado · más enfoque";
    await resultToLayer(out, { name: label, docName: "Apilado", newDocument: true });
    progress(null);
    toast(`${used} fotos apiladas (${S.mode === "noise" ? "ruido ÷ " + Math.sqrt(used).toFixed(1) : "enfoque ampliado"}) · ${W} × ${H}` + (notes.length ? ". " + notes.join(". ") : ""), notes.length ? "" : "ok");
  }catch(err){
    console.error(err); progress(null);
    fail("No se pudo apilar: " + (err.message || err));
  }finally{ running = false; status(""); }
}
