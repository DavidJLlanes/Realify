/* ═══════════════════════════════════════════════════════════════
   ARCHIVO › EXPORTAR GIF ANIMADO
   Cada capa visible (de abajo arriba) es un fotograma, sola o
   acumulada sobre las anteriores. Diálogo compacto en el móvil.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { dialog } from "../ui/dialog.js";
import { toast, status, progress } from "../ui/toast.js";
import { isMobile } from "../core/device.js";

function frameOf(layers, w, h, bg){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  if(bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  for(const l of layers){
    if(!l.canvas || l.type === "adjust" || l.type === "group") continue;
    x.globalAlpha = l.opacity ?? 1;
    x.drawImage(l.canvas, 0, 0, w, h);
  }
  x.globalAlpha = 1;
  return c;
}

export async function exportGif(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const layers = doc.layers.filter(l => l.visible && l.canvas && l.type !== "adjust" && l.type !== "group");
  if(layers.length < 2){ toast("Para animar hacen falta al menos 2 capas visibles: cada una es un fotograma", "err"); return; }
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="hint" style="margin:0 0 8px">${layers.length} capas visibles = ${layers.length} fotogramas (de abajo arriba).</p>
    <div class="field"><label>Fotogramas</label><select id="gMode" class="grow">
      <option value="each">Cada capa sola</option><option value="stack">Capas acumuladas</option></select></div>
    <div class="field"><label>Duración de cada uno</label><input type="range" id="gDelay" class="grow" min="40" max="3000" step="20" value="500"><span class="unit mono" id="gDelayV">0,5 s</span></div>
    <div class="field"><label>Tamaño</label><input type="range" id="gScale" class="grow" min="10" max="100" value="${Math.min(100, Math.round(100 * 800 / Math.max(doc.w, doc.h)))}"><span class="unit mono" id="gScaleV"></span></div>
    <div class="field"><label>Colores</label><select id="gColors" class="grow"><option value="256">256 (máxima calidad)</option><option value="128">128</option><option value="64">64 (más ligero)</option><option value="32">32</option></select></div>
    <div class="field"><label>Fondo</label><select id="gBg" class="grow"><option value="">Transparente</option><option value="#ffffff">Blanco</option><option value="#000000">Negro</option></select></div>
    <label class="chk"><input type="checkbox" id="gLoop" checked> Repetir sin fin</label>
    <label class="chk"><input type="checkbox" id="gPing"> Ida y vuelta</label>`;
  const $ = s => body.querySelector(s);
  const size = () => { const k = +$("#gScale").value / 100; return [Math.max(1, Math.round(doc.w * k)), Math.max(1, Math.round(doc.h * k))]; };
  const sync = () => { $("#gDelayV").textContent = (+$("#gDelay").value / 1000).toLocaleString("es", { maximumFractionDigits: 2 }) + " s"; const [w, h] = size(); $("#gScaleV").textContent = `${w}×${h}`; };
  body.addEventListener("input", sync); sync();
  const res = await dialog({ title: "Exportar GIF animado", body, cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label: "Cancelar", value: null }, { label: "Exportar", primary: true, value: "go" }] });
  if(res !== "go") return;
  const [w, h] = size(), bg = $("#gBg").value || null, stack = $("#gMode").value === "stack";
  let frames = layers.map((l, i) => frameOf(stack ? layers.slice(0, i + 1) : [l], w, h, bg));
  if($("#gPing").checked) frames = frames.concat(frames.slice(1, -1).reverse());
  status("Creando el GIF…");
  try{
    const { gifFromCanvases } = await import("./formats.js");
    const blob = await gifFromCanvases(frames, { delay: +$("#gDelay").value, loop: $("#gLoop").checked ? 0 : -1, colors: +$("#gColors").value, onProgress: f => progress(f) });
    const { saveOrShare, stamp } = await import("./export.js");
    const r = await saveOrShare(blob, `${doc.name || "realify"}-${stamp()}.gif`);
    if(r !== "cancelled") toast(`GIF de ${frames.length} fotogramas · ${w} × ${h} · ${Math.round(blob.size / 1024)} KB`, "ok");
  }catch(err){ toast("No se pudo crear el GIF: " + err.message, "err"); }
  finally{ progress(null); status(""); }
}
