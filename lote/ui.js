/* ═══════════════════════════════════════════════════════════════
   LOTE · VENTANA «APLICAR ESTA EDICIÓN A OTRAS FOTOS»
   Pantalla completa (js/ui/fsshell.js):
     · izquierda (móvil: grupo «Edición»): la edición de la foto de
       referencia, capa a capa, con casillas;
     · centro: rejilla con la vista previa de cada foto; tocar una la
       quita o la vuelve a poner en el lote;
     · derecha: fotos (pestañas abiertas y de la galería), igualar
       exposición y resultado (pestañas con capas reeditables o ZIP).
   ═══════════════════════════════════════════════════════════════ */

import { createShell, mountControls, decodePhoto, pickFiles, scaledCanvas } from "../js/ui/fsshell.js";
import { previewEdit, kindName } from "./edit.js";
import { toast } from "../js/ui/toast.js";

const TOUCH = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const THUMB = TOUCH ? 240 : 320;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function openBatchEditor({ edit, tabs, onApply, hasFields = false }){
  // tabs: [{ tabId, name, proxy }] — las otras pestañas abiertas
  const targets = tabs.map(t => ({ ...t, kind: "tab", on: true, preview: null }));
  const S = { expo: true, expoStrength: 100, output: "tabs", format: "image/jpeg", quality: 90, alpha: true, bg: "#ffffff", metaKeep: true, metaFields: true, hasFields };
  let closed = false, seq = 0, grid = null;

  const sh = createShell({ title: "Aplicar esta edición a otras fotos", subtitle: `Referencia: ${edit.name}`, applyLabel: "Aplicar",
    onCancel: () => close(), onApply: () => apply(), onUndo: () => {}, onRedo: () => {} });
  sh.root.querySelector('[data-a="undo"]').hidden = true; sh.root.querySelector('[data-a="redo"]').hidden = true;

  /* ── Edición (lista de capas) ── */
  function editList(){
    const box = document.createElement("div");
    box.className = "fsp-photos";
    if(!edit.items.length){
      box.innerHTML = `<p class="fsp-note">Esta foto no tiene nada que copiar todavía. Edítala con capas de ajuste, filtros, textos o marcas de agua y vuelve aquí.${S.expo ? " (Igualar exposición sí se puede aplicar.)" : ""}</p>`;
      return box;
    }
    edit.items.forEach(it => {
      const r = document.createElement("label"); r.className = "fsp-photo"; r.style.cursor = "pointer"; r.style.gridTemplateColumns = "auto minmax(0,1fr)";
      r.innerHTML = `<input type="checkbox"${it.on ? " checked" : ""} style="width:18px;height:18px;accent-color:#7fa6ff"><div><b>${esc(it.name)}</b><small>${kindName(it.kind)} · ${esc(it.detail || "")}${it.hasMask ? " · sin su máscara" : ""}</small></div>`;
      r.querySelector("input").addEventListener("change", e => { it.on = e.target.checked; refreshPreviews(); });
      box.appendChild(r);
    });
    return box;
  }
  function renderLeft(){
    const L = sh.left; L.innerHTML = `<h3>Edición que se copia</h3>`;
    L.appendChild(editList());
    const n = document.createElement("p"); n.className = "fsp-note";
    n.textContent = "Se copian capas de ajuste, filtros (recalculados en cada foto), textos e imágenes añadidas, con su opacidad y modo de fusión. No se copian máscaras, pinceladas ni recortes.";
    L.appendChild(n);
  }

  /* ── Fotos ── */
  async function addFiles(){
    const files = await pickFiles();
    if(!files.length) return;
    sh.setBusy("Abriendo fotos…");
    for(const f of files){
      try{
        const proxy = await decodePhoto(f, THUMB * 2);
        targets.push({ kind: "file", file: f, name: f.name.replace(/\.[^.]+$/, ""), proxy, on: true, preview: null });
      }catch(err){ toast(err.message, "err"); }
    }
    sh.setBusy(null);
    controls.refresh(); refreshPreviews();
  }
  function photoList(){
    const box = document.createElement("div");
    const list = document.createElement("div"); list.className = "fsp-photos";
    if(!targets.length) list.innerHTML = `<p class="fsp-note">No hay otras fotos abiertas. Añádelas desde la galería.</p>`;
    targets.forEach((t, i) => {
      const r = document.createElement("div"); r.className = "fsp-photo" + (t.on ? " on" : "");
      r.innerHTML = `<img alt="" src="${scaledCanvas(t.proxy, 120).toDataURL("image/jpeg", .7)}"><div><b>${esc(t.name)}</b><small>${t.kind === "tab" ? "Pestaña abierta" : "De la galería"}${t.on ? "" : " · no se aplica"}</small></div><span class="ops"><button type="button" class="x" aria-label="${t.on ? "No aplicar" : "Aplicar"}">${t.on ? "✓" : "—"}</button>${t.kind === "file" ? '<button type="button" class="x" data-rm aria-label="Quitar">✕</button>' : ""}</span>`;
      r.querySelector(".x").addEventListener("click", () => { t.on = !t.on; controls.refresh(); drawGrid(); });
      r.querySelector("[data-rm]")?.addEventListener("click", () => { targets.splice(i, 1); controls.refresh(); drawGrid(); });
      list.appendChild(r);
    });
    box.appendChild(list);
    const b = document.createElement("button"); b.type = "button"; b.className = "fsp-btn dashed"; b.textContent = "+ Añadir fotos de la galería"; b.addEventListener("click", addFiles);
    box.appendChild(b);
    return box;
  }

  /* ── Rejilla de vistas previas ── */
  const view = document.createElement("canvas");
  function layoutGrid(n){
    const aspect = 4 / 3, avail = sh.stage.clientWidth / Math.max(1, sh.stage.clientHeight);
    let best = 1, bestSize = 0;
    for(let c = 1; c <= n; c++){ const r = Math.ceil(n / c), cell = Math.min(avail / c, 1 / r * aspect); if(cell > bestSize){ bestSize = cell; best = c; } }
    return { cols: best, rows: Math.ceil(n / best) };
  }
  function drawGrid(){
    if(!targets.length){ sh.setView(null); sh.setEmpty(`<b>Aplicar esta edición a otras fotos</b><span>Añade las fotos a las que quieres copiar la edición de «${esc(edit.name)}».</span><button type="button" data-add>Añadir fotos</button>`); return; }
    sh.setEmpty(null);
    const { cols, rows } = layoutGrid(targets.length), cw = THUMB, ch = Math.round(THUMB * .75), g = 12, lab = 22;
    view.width = cols * cw + (cols + 1) * g; view.height = rows * (ch + lab) + (rows + 1) * g;
    const x = view.getContext("2d");
    x.fillStyle = "#15191e"; x.fillRect(0, 0, view.width, view.height);
    grid = { cols, cw, ch, g, lab };
    targets.forEach((t, i) => {
      const X = g + (i % cols) * (cw + g), Y = g + Math.floor(i / cols) * (ch + lab + g);
      const img = t.preview || t.proxy, k = Math.min(cw / img.width, ch / img.height), w = img.width * k, h = img.height * k;
      x.globalAlpha = t.on ? 1 : .28;
      x.drawImage(img, X + (cw - w) / 2, Y + (ch - h) / 2, w, h);
      x.globalAlpha = 1;
      x.fillStyle = t.on ? "#e9edf4" : "#77808c"; x.font = "600 13px system-ui"; x.textAlign = "center"; x.textBaseline = "middle";
      let name = t.name; while(name.length > 4 && x.measureText(name).width > cw - 10) name = name.slice(0, -2);
      x.fillText((t.on ? "" : "✕ ") + (name !== t.name ? name + "…" : name), X + cw / 2, Y + ch + lab / 2 + 2);
      if(!t.preview && t.on){ x.fillStyle = "#0009"; x.fillRect(X, Y, cw, ch); x.fillStyle = "#cfd8e6"; x.fillText("Calculando…", X + cw / 2, Y + ch / 2); }
    });
    sh.setView(view, !!sh.view);
  }
  sh.setInteract((type, pt) => {
    if(type !== "down" || !grid || !pt) return false;
    const { cols, cw, ch, g, lab } = grid;
    const c = Math.floor((pt.x - g / 2) / (cw + g)), r = Math.floor((pt.y - g / 2) / (ch + lab + g)), i = r * cols + c;
    if(c < 0 || c >= cols || !targets[i]) return false;
    targets[i].on = !targets[i].on; controls.refresh(); drawGrid();
    return true;
  });
  sh.stage.addEventListener("click", e => { if(e.target.closest("[data-add]")) addFiles(); });
  async function refreshPreviews(){
    const my = ++seq;
    targets.forEach(t => { t.preview = null; });
    drawGrid();
    for(const t of targets){
      if(my !== seq || closed) return;
      try{ t.preview = await previewEdit(edit, scaledCanvas(t.proxy, THUMB), { expo: S.expo, expoStrength: S.expoStrength / 100 }); }
      catch(err){ console.warn("[lote] vista previa", err); t.preview = t.proxy; }
      if(my === seq) drawGrid();
    }
  }

  /* ── Ajustes ── */
  const sections = [
    { id: "edit", label: "Edición", when: () => matchMedia("(max-width:900px)").matches, props: [{ key: "editList", label: "Edición", type: "custom", render: () => editList() }] },
    { id: "photos", label: "Fotos", props: [{ key: "photos", label: "Fotos", type: "custom", render: () => photoList() }] },
    { id: "expo", label: "Exposición", props: [
      { key: "expo", label: "Igualar exposición con la foto de referencia", type: "toggle" },
      { key: "expoStrength", label: "Intensidad", type: "range", min: 10, max: 100, unit: " %", def: 100, when: () => S.expo }
    ], note: "Añade a cada foto una capa «Exposición» (reeditable) para que su brillo medio sea el de la foto de referencia." },
    { id: "out", label: "Resultado", props: [
      { key: "output", label: "Resultado", type: "seg", options: [["tabs", "En sus pestañas"], ["zip", "ZIP"]] },
      { key: "format", label: "Formato", type: "select", options: [["image/jpeg", "JPEG"], ["image/png", "PNG"], ["image/webp", "WebP"], ["image/avif", "AVIF"]], when: () => S.output === "zip" },
      { key: "quality", label: "Calidad", type: "range", min: 40, max: 100, unit: " %", def: 90, when: () => S.output === "zip" && S.format !== "image/png" },
      // Transparencia (ver js/io/alpha.js): se conserva en los formatos que la admiten.
      { key: "alpha", label: "Conservar la transparencia", type: "toggle", when: () => S.output === "zip" && S.format !== "image/jpeg" },
      { key: "bg", label: "Fondo de las zonas transparentes", type: "color", when: () => S.output === "zip" && (S.format === "image/jpeg" || !S.alpha) },
      { key: "metaKeep", label: "Conservar los metadatos de cada foto (sin ubicación)", type: "toggle", when: () => S.output === "zip" },
      { key: "metaFields", label: "Aplicar mis campos de «Editar metadatos»", type: "toggle", when: () => S.output === "zip" && !!S.hasFields }
    ], note: () => S.output === "tabs" ? "Cada foto queda en su pestaña con la edición como capas nuevas que puedes retocar." : "Se exporta cada foto editada y se entrega todo en un ZIP; las pestañas abiertas no se modifican." }
  ];
  const controls = mountControls(sh, { sections, get: k => S[k],
    set: (k, v, final) => { S[k] = v; if(final && (k === "expo" || k === "output" || k === "format" || k === "alpha")) controls.refresh(); if(k.startsWith("expo") && final) refreshPreviews(); } });

  async function apply(){
    const list = targets.filter(t => t.on);
    if(!list.length){ toast("No hay ninguna foto marcada", "err"); return; }
    sh.setApplyEnabled(false);
    try{ close(); await onApply(list, { ...S }); }
    catch(err){ toast("No se pudo aplicar: " + err.message, "err"); }
  }
  function close(){ if(closed) return; closed = true; sh.close(); }
  renderLeft(); refreshPreviews();
  return { close };
}
