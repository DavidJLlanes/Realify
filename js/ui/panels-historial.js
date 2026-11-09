/* ═══════════════════════════════════════════════════════════════
   PANELES · instantáneas, historial e información
   Pintan las listas de los tres paneles laterales a partir del estado del documento (js/ui/panels.js se suscribe a los eventos y llama a estas
   funciones). Entradas: estado de core/doc.js, core/history.js y core/snapshots.js. Salida: DOM de #snapshotList, #historyList e #infoBody.
   ═══════════════════════════════════════════════════════════════ */
import { doc, activeLayer } from "../core/doc.js";
import { list as historyList, jumpTo } from "../core/history.js";
import { listSnapshots, getBrushSourceId, setBrushSource, restoreSnapshot,
         renameSnapshot, removeSnapshot } from "../core/snapshots.js";
import { confirmDlg, promptDlg } from "./kit/dialog.js";
import { escapeHtml } from "../core/util/html.js";

const snapshotEl = document.getElementById("snapshotList");

export function renderSnapshots(){
  const list = listSnapshots();
  const sourceId = getBrushSourceId();
  snapshotEl.innerHTML = "";
  for(const s of list){
    const row = document.createElement("div");
    row.className = "snap-row";
    row.innerHTML = `
      <button type="button" class="snap-src${s.id === sourceId ? " on" : ""}"
        title="${s.id === sourceId ? "Origen del pincel de historial" : "Usar como origen del pincel de historial"}"
        aria-label="Origen del pincel de historial">●</button>
      <button type="button" class="snap-name" title="Clic: volver a esta instantánea · Doble clic: renombrar">
        ${escapeHtml(s.name)}</button>
      <button type="button" class="snap-remove icon" title="Eliminar instantánea" aria-label="Eliminar instantánea">✕</button>`;
    row.querySelector(".snap-src").addEventListener("click", () => { setBrushSource(s.id); });
    row.querySelector(".snap-name").addEventListener("click", () => { restoreSnapshot(s.id); });
    row.querySelector(".snap-name").addEventListener("dblclick", async e => {
      e.stopPropagation();
      const name = await promptDlg("Renombrar instantánea", "Nombre", s.name);
      if(name) renameSnapshot(s.id, name);
    });
    row.querySelector(".snap-remove").addEventListener("click", async () => {
      if(await confirmDlg("Eliminar instantánea", `Se borra «${s.name}». No afecta al historial de deshacer.`, "Eliminar")){
        removeSnapshot(s.id);
      }
    });
    snapshotEl.appendChild(row);
  }
}

/* ── panel de historial ── */
const historyEl = document.getElementById("historyList");

export function renderHistory(){
  const h = historyList();
  historyEl.innerHTML = "";
  const mk = (label, i, cls) => {
    const b = document.createElement("button");
    b.className = "hitem " + cls;
    b.innerHTML = `<span class="n">${i}</span><span>${escapeHtml(label)}</span>`;
    b.addEventListener("click", () => jumpTo(i));
    return b;
  };
  h.past.forEach((e, i) =>
    historyEl.appendChild(mk(e.label, i, i === h.past.length - 1 ? "now" : "")));
  h.future.slice().reverse().forEach((e, i) =>
    historyEl.appendChild(mk(e.label, h.past.length + i, "future")));
  if(!h.past.length && !h.future.length){
    historyEl.innerHTML = '<p class="hint" style="margin:0">Sin cambios todavía.</p>';
  }
  historyEl.scrollTop = historyEl.scrollHeight;
}

/* ── información ── */
const infoBody = document.getElementById("infoBody");
export function renderInfo(){
  if(!doc.open){ infoBody.textContent = "Sin documento."; return; }
  const l = activeLayer();
  const mp = (doc.w * doc.h / 1e6).toFixed(1);
  const mem = (doc.layers.length * doc.w * doc.h * 4 / 1048576).toFixed(0);
  infoBody.innerHTML =
    `<div class="field"><label>Documento</label><span class="mono">${doc.w} × ${doc.h}</span></div>
     <div class="field"><label>Megapíxeles</label><span class="mono">${mp} MP</span></div>
     <div class="field"><label>Capas</label><span class="mono">${doc.layers.length}</span></div>
     <div class="field"><label>Memoria</label><span class="mono">~${mem} MB</span></div>
     ${l ? `<div class="field"><label>Activa</label><span>${escapeHtml(l.name)}</span></div>` : ""}
     ${doc.source ? `<div class="field"><label>Origen</label><span class="mono">${doc.source.w} × ${doc.source.h}</span></div>` : ""}`;
}
