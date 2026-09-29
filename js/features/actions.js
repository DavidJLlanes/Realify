/* ═══════════════════════════════════════════════════════════════
   ACCIONES: GRABAR Y REPRODUCIR
   Una acción es una lista de comandos (los mismos ids que usan los
   menús) con los valores que se dejaron en sus diálogos. Grabar no
   necesita que cada herramienta sepa nada: se observan los comandos
   (ui/commands.js › onRun) y el cierre de cada diálogo (ui/dialog.js ›
   setDialogHooks), y al reproducir los diálogos se rellenan solos con
   lo grabado y se pulsa el mismo botón.

   Lo que no se graba: trazos de pincel y demás gestos sobre la imagen,
   y los editores a pantalla completa (si una acción los incluye, al
   reproducirla se abren y esperan a que se terminen a mano).

   Se guardan en este navegador (localStorage) y se pueden exportar e
   importar como JSON. Se reproducen sobre la imagen abierta o en lote
   sobre muchas fotos, con el resultado en un ZIP.
   ═══════════════════════════════════════════════════════════════ */

import { pickFiles } from "../ui/fsshell.js";
import { alphaFieldsHTML, wireAlphaFields } from "../io/alpha.js";
import { onRun, runAsync } from "../ui/commands.js";
import { dialog, setDialogHooks, promptDlg, confirmDlg } from "../ui/dialog.js";
import { toast, status, progress } from "../ui/toast.js";
import { isMobile } from "../core/device.js";

const KEY = "realify.actions";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/* Comandos que no tienen sentido dentro de una acción (navegación,
   archivos, deshacer…) o que abren editores interactivos. */
const SKIP = /^(view\.|file\.|edit\.(undo|redo)|actions\.|help\.|tab\.|an\.|panel\.|app\.|pwa\.)/;
const INTERACTIVE = new Set(["image.hdr", "image.merge", "image.slice", "image.shapeCrop", "image.beforeAfter", "filter.photoDevelop", "filter.camera", "filter.vintage", "layer.meme", "layer.stickers", "adj.curves"]);

function load(){ try{ const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; }catch{ return []; } }
function save(list){ try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch{ toast("No se pudo guardar la acción en este navegador", "err"); } }

/* ── Valores de un diálogo ───────────────────────────────────── */
function keyOf(el, seen){
  let lab = el.id || el.getAttribute("aria-label") || "";
  if(!lab){
    const f = el.closest(".field, label, .fsp-field");
    lab = (f?.querySelector("label, span")?.textContent || el.name || el.type || el.tagName).replace(/\s+/g, " ").trim().slice(0, 40);
  }
  const n = (seen[lab] = (seen[lab] || 0) + 1);
  return `${lab}#${n}`;
}
function fields(body){
  const seen = {}, out = [];
  body.querySelectorAll("input, select, textarea").forEach(el => {
    if(el.type === "file" || el.type === "button" || el.type === "submit") return;
    if(el.tagName === "SELECT" && el.parentElement?.dataset.picker) return;   // desplegable del modo compacto
    out.push({ k: keyOf(el, seen), v: el.type === "checkbox" || el.type === "radio" ? el.checked : el.value });
  });
  const segs = [...body.querySelectorAll(".seg")].map(s => s.querySelector("button.on")?.textContent.trim() || null);
  return { f: out, s: segs };
}
function fill(body, rec){
  const seen = {}, byKey = new Map();
  body.querySelectorAll("input, select, textarea").forEach(el => {
    if(el.tagName === "SELECT" && el.parentElement?.dataset.picker) return;
    byKey.set(keyOf(el, seen), el);
  });
  for(const { k, v } of rec.f || []){
    const el = byKey.get(k); if(!el) continue;
    if(el.type === "checkbox" || el.type === "radio"){ if(el.checked !== v){ el.checked = v; el.dispatchEvent(new Event("change", { bubbles: true })); } continue; }
    if(el.value === v) continue;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  [...body.querySelectorAll(".seg")].forEach((s, i) => {
    const want = rec.s?.[i]; if(!want) return;
    const b = [...s.querySelectorAll("button")].find(x => x.textContent.trim() === want);
    if(b && !b.classList.contains("on")) b.click();
  });
}

/* ── Grabación ───────────────────────────────────────────────── */
let rec = null, bar = null, unhook = null;
function showBar(){
  bar?.remove();
  bar = document.createElement("div");
  bar.className = "update-bar actions-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span><b style="color:#ff6b6b">●</b> Grabando «${esc(rec.name)}» · <span class="n">0 pasos</span></span>
    <button type="button" data-a="stop" class="primary">Detener y guardar</button><button type="button" data-a="cancel">Descartar</button>`;
  bar.addEventListener("click", e => { const a = e.target.closest("[data-a]")?.dataset.a; if(a === "stop") stopRecording(); else if(a === "cancel") stopRecording(true); });
  document.body.appendChild(bar);
}
const updateBar = () => { if(bar) bar.querySelector(".n").textContent = `${rec.steps.length} ${rec.steps.length === 1 ? "paso" : "pasos"}`; };

export async function startRecording(){
  if(rec){ toast("Ya se está grabando una acción"); return; }
  const name = await promptDlg("Grabar acción", "Nombre de la acción", `Acción ${load().length + 1}`);
  if(!name) return;
  rec = { name: name.trim().slice(0, 60) || "Acción", steps: [] };
  unhook = onRun((id, arg) => {
    if(SKIP.test(id)) return;
    if(INTERACTIVE.has(id)) toast("Ese editor es interactivo: al reproducir la acción se abrirá para que lo termines a mano");
    rec.steps.push({ cmd: id, arg: arg ?? null, dialogs: [] });
    updateBar();
  });
  setDialogHooks({
    onClose(title, idx, body, value){
      const st = rec?.steps[rec.steps.length - 1];
      if(!st || !body) return;
      st.dialogs.push({ title, button: idx, ok: value !== null && value !== undefined && value !== false, ...fields(body) });
    }
  });
  showBar();
  toast("Grabando: usa ajustes, filtros y comandos como siempre", "ok");
}

export function stopRecording(discard = false){
  if(!rec) return;
  unhook?.(); unhook = null; setDialogHooks(null);
  bar?.remove(); bar = null;
  const r = rec; rec = null;
  // Pasos cancelados (el diálogo se cerró sin aplicar) no se guardan
  r.steps = r.steps.filter(s => !s.dialogs.length || s.dialogs[s.dialogs.length - 1].ok);
  if(discard){ toast("Grabación descartada"); return; }
  if(!r.steps.length){ toast("La acción no tiene pasos: no se ha guardado", "err"); return; }
  const list = load(); list.push({ ...r, created: Date.now() }); save(list);
  toast(`Acción «${r.name}» guardada con ${r.steps.length} ${r.steps.length === 1 ? "paso" : "pasos"}`, "ok");
}

/* ── Reproducción ────────────────────────────────────────────── */
const busySel = ".modal, .fsp, .cv-editor, .raw-developer, .vf-editor, .rf-editor, .mm-editor, .st-editor, .sp-editor, .ai-busy";
async function idle(timeout = 15 * 60e3){
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 60));
  while(document.querySelector(busySel)){
    if(performance.now() - t0 > timeout) throw new Error("un paso no ha terminado");
    await new Promise(r => setTimeout(r, 120));
  }
}

export async function playAction(action, { quiet = false } = {}){
  let queue = [];
  setDialogHooks({
    autofill(title, body){
      const i = queue.findIndex(d => d.title === title);
      if(i < 0) return -2;                       // diálogo no grabado: lo decide el usuario
      const d = queue.splice(i, 1)[0];
      fill(body, d);
      return d.button;
    }
  });
  try{
    for(let i = 0; i < action.steps.length; i++){
      const st = action.steps[i];
      if(!quiet) status(`Acción «${action.name}» · paso ${i + 1} de ${action.steps.length}`);
      queue = st.dialogs.slice();
      await runAsync(st.cmd, st.arg ?? undefined);
      await idle();
    }
  }finally{ setDialogHooks(null); if(!quiet) status(""); }
}

async function playOnCurrent(a){
  const { doc } = await import("../core/doc.js");
  if(!doc.open){ toast("Abre una imagen para aplicar la acción", "err"); return; }
  try{ await playAction(a); toast(`Acción «${a.name}» aplicada`, "ok"); }
  catch(err){ toast(`La acción se ha detenido: ${err.message}`, "err"); }
}

async function playBatch(a){
  const files = await pickFiles();   // antes de cualquier espera: ver promptStartBatch en io/open.js
  if(!files.length) return;
  const body = document.createElement("div");
  body.innerHTML = `<p class="hint" style="margin:0 0 8px">${files.length} fotos. Cada una se abre, se le aplica «${esc(a.name)}» y se guarda en un ZIP.</p>
    <div class="field"><label>Formato</label><select id="abType" class="grow"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/avif">AVIF</option></select></div>
    <div class="field"><label>Calidad</label><input type="range" id="abQ" class="grow" min="40" max="100" value="90"><span class="unit mono" id="abQV">90</span></div>
    ${alphaFieldsHTML("abA")}`;
  body.querySelector("#abQ").addEventListener("input", e => { body.querySelector("#abQV").textContent = e.target.value; });
  const tsel = body.querySelector("#abType");
  const alphaUI = wireAlphaFields(body, { id: "abA", getType: () => tsel.value, hasAlpha: false,
    switchTo: t => { tsel.value = t; tsel.dispatchEvent(new Event("change")); } });
  tsel.addEventListener("change", alphaUI.sync);
  const go = await dialog({ title: "Aplicar acción en lote", body, cls: isMobile() ? "dlg-compact" : "", buttons: [{ label: "Cancelar", value: null }, { label: `Procesar ${files.length}`, primary: true, value: "go" }] });
  if(go !== "go") return;
  const type = body.querySelector("#abType").value, q = +body.querySelector("#abQ").value / 100, alphaOpts = alphaUI.values();
  const ext = { "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[type] || "jpg";
  const [{ openFile }, { openAsNewTab, activeTab, closeTab }, { doc }, { renderExport, saveOrShare, stamp }, { buildZip }] = await Promise.all([
    import("../io/open.js"), import("../core/documents.js"), import("../core/doc.js"), import("../io/export.js"), import("../io/zip.js")]);
  const entries = [], failed = [];
  for(let i = 0; i < files.length; i++){
    const f = files[i];
    progress(i / files.length); status(`Lote «${a.name}» · ${i + 1} de ${files.length}: ${f.name}`);
    try{
      if(!(await openAsNewTab(() => openFile(f)))) throw new Error("no se pudo abrir");
      await playAction(a, { quiet: true });
      const blob = await renderExport({ w: doc.w, h: doc.h, type, quality: type === "image/png" ? undefined : q, ...alphaOpts });
      if(!blob) throw new Error("no se pudo exportar");
      entries.push({ name: `${f.name.replace(/\.[^.]+$/, "")}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
      const t = activeTab(); if(t) await closeTab(t.tabId, { confirm: false });
    }catch(err){ failed.push(`${f.name}: ${err.message}`); }
  }
  progress(null); status("");
  if(entries.length) await saveOrShare(buildZip(entries), `${a.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "accion"}-${stamp()}.zip`);
  toast(`${entries.length} de ${files.length} fotos procesadas${failed.length ? ` · ${failed.length} con error` : ""}`, failed.length ? "err" : "ok");
  if(failed.length) console.warn("[acciones] fallos:", failed);
}

/* ── Ventana de acciones ─────────────────────────────────────── */
function stepName(id){
  const el = document.querySelector(`[data-cmd="${CSS.escape(id)}"]`);
  return (el?.textContent || id).replace(/…/g, "").replace(/\s+/g, " ").trim();
}

export async function openActions(){
  if(rec){ stopRecording(); return; }
  const list = load();
  const body = document.createElement("div");
  body.innerHTML = `
    <button type="button" class="primary" data-a="rec" style="width:100%;min-height:40px;margin-bottom:10px">● Grabar una acción nueva</button>
    ${list.length ? "" : `<p class="hint">Aún no hay acciones. Graba una: pulsa «Grabar», usa ajustes, filtros y comandos como siempre y detén la grabación. Después podrás repetirla en cualquier foto o en muchas a la vez.</p>`}
    <div class="acts" style="display:grid;gap:8px">${list.map((a, i) => `
      <div style="border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b>${esc(a.name)}</b><span class="hint">${a.steps.length} ${a.steps.length === 1 ? "paso" : "pasos"}</span></div>
        <p class="hint" style="margin:3px 0 8px">${a.steps.map(s => esc(stepName(s.cmd))).join(" → ")}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button type="button" class="primary" data-a="play" data-i="${i}">Aplicar</button>
          <button type="button" data-a="batch" data-i="${i}">En lote…</button>
          <button type="button" data-a="rename" data-i="${i}">Renombrar</button>
          <button type="button" data-a="export" data-i="${i}">Exportar</button>
          <button type="button" data-a="del" data-i="${i}">Borrar</button>
        </div></div>`).join("")}</div>
    <button type="button" data-a="import" style="width:100%;margin-top:10px">Importar acciones (.json)…</button>`;
  let pick = null;
  const res = await dialog({ title: "Acciones", body, wide: !isMobile(), buttons: [{ label: "Cerrar", value: null }],
    onOpen(b, { close }){ b.addEventListener("click", e => { const t = e.target.closest("[data-a]"); if(!t) return; pick = { a: t.dataset.a, i: +t.dataset.i }; close("pick"); }); } });
  if(res !== "pick" || !pick) return;
  const a = list[pick.i];
  if(pick.a === "rec") return startRecording();
  if(pick.a === "play") return playOnCurrent(a);
  if(pick.a === "batch") return playBatch(a);
  if(pick.a === "rename"){ const n = await promptDlg("Renombrar acción", "Nombre", a.name); if(n){ a.name = n.trim().slice(0, 60) || a.name; save(list); } return openActions(); }
  if(pick.a === "del"){ if(await confirmDlg("Borrar acción", `¿Borrar «${esc(a.name)}»?`, "Borrar")){ list.splice(pick.i, 1); save(list); } return openActions(); }
  if(pick.a === "export"){
    const { saveOrShare } = await import("../io/export.js");
    await saveOrShare(new Blob([JSON.stringify({ realifyActions: 1, actions: [a] }, null, 1)], { type: "application/json" }), `${a.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, "").trim() || "accion"}.json`);
    return;
  }
  if(pick.a === "import"){
    const [f] = await pickFiles({ multiple: false, accept: "application/json,.json" });
    if(!f) return;
    try{
      const data = JSON.parse(await f.text()), acts = (data.actions || []).filter(x => x && Array.isArray(x.steps) && x.name);
      if(!acts.length) throw new Error("no contiene acciones");
      save(load().concat(acts)); toast(`${acts.length} ${acts.length === 1 ? "acción importada" : "acciones importadas"}`, "ok");
    }catch(err){ toast("No se pudo importar: " + err.message, "err"); }
    return openActions();
  }
}
