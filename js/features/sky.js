/* ═══════════════════════════════════════════════════════════════
   REEMPLAZAR CIELO
   Detecta el cielo con el mismo modelo que «Seleccionar cielo»
   (DeepLab/ADE20K, ver filters/segment/) y deja el reemplazo —color
   liso, degradado o una foto propia— en una capa nueva, recortada al
   cielo con una máscara de verdad y editable después como cualquier
   otra: nada de esto se «cuece» en la foto original.
   ═══════════════════════════════════════════════════════════════ */

import { doc, activeLayer, addLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { dialog } from "../ui/dialog.js";
import { isMobile } from "../core/device.js";
import { toast, status } from "../ui/toast.js";
import { slider } from "../editor/adjust.js";
import { featherMask } from "../editor/selection.js";

/* Igual que `dropLayer` de editor/textedit.js: saca una capa de la
   pila sin pasar por el historial, para cuando se cancela un diálogo
   que había creado la capa como vista previa. No se comparte con ese
   archivo porque ninguno de los dos exporta la suya —cada uno vive
   junto a quien la usa—. */
function dropLayer(layer){
  const i = doc.layers.indexOf(layer);
  if(i < 0) return;
  doc.layers.splice(i, 1);
  if(doc.activeId === layer.id){
    const next = doc.layers[Math.min(i, doc.layers.length - 1)];
    doc.activeId = next ? next.id : null;
    emit("doc:active");
  }
  emit("doc:structure");
  emit("doc:change");
}

function maskCanvasFrom(arr, w, h){
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  const img = x.createImageData(w, h);
  for(let i = 0; i < arr.length; i++){
    img.data[i*4] = img.data[i*4+1] = img.data[i*4+2] = 255;
    img.data[i*4+3] = arr[i];
  }
  x.putImageData(img, 0, 0);
  return { canvas: c, ctx: x };
}

function loadImageFile(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}

export async function replaceSky(){
  const base = activeLayer();
  if(!base){ toast("No hay capa activa"); return; }
  if(base.type === "adjust"){ toast("Selecciona una capa de imagen"); return; }

  status("Detectando el cielo…");
  let rawMask, hasSky;
  try{
    const { segmentSky } = await import("../filters/segment/segment.js");
    ({ mask: rawMask, hasSky } = await segmentSky(base.canvas));
  }catch(err){
    status("");
    toast("No se pudo detectar el cielo: " + (err.message || err), "err");
    return;
  }
  status("");
  let coverage = 0;
  for(let i = 0; i < rawMask.length; i++) if(rawMask[i] > 127) coverage++;
  coverage /= rawMask.length;
  if(!hasSky || coverage < 0.01){
    toast("No se ha encontrado cielo en esta foto", "err");
    return;
  }

  const w = base.canvas.width, h = base.canvas.height;
  const p = { mode: "gradient", color: "#4a90d9", top: "#2f6fb0", bottom: "#dce9f5",
              feather: 8, image: null };

  const layer = addLayer({ name: "Cielo reemplazado" });

  const applyMask = () => {
    const fm = p.feather > 0 ? featherMask(rawMask, w, h, p.feather) : rawMask;
    layer.mask = maskCanvasFrom(fm, w, h);
    layer.maskEnabled = true;
  };
  applyMask();

  const paint = () => {
    const x = layer.ctx;
    x.clearRect(0, 0, w, h);
    if(p.mode === "color"){
      x.fillStyle = p.color;
      x.fillRect(0, 0, w, h);
    } else if(p.mode === "gradient"){
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, p.top);
      g.addColorStop(1, p.bottom);
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    } else if(p.mode === "image" && p.image){
      // «Cover»: llena el lienzo entero sin deformar, recortando lo
      // que sobre por los lados —el mismo criterio que un fondo CSS
      // `background-size:cover`—, centrado.
      const iw = p.image.width, ih = p.image.height;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      x.drawImage(p.image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    layer.thumbDirty = true;
    emit("doc:change");
  };
  paint();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="seg" id="skyTabs">
      <button data-m="gradient">Degradado</button>
      <button data-m="color">Color liso</button>
      <button data-m="image">Imagen propia</button>
    </div>
    <div id="skyBody" style="margin-top:10px"></div>
    <div id="skyFeatherHost" style="margin-top:10px"></div>
    <p class="hint" style="margin-top:8px">La máscara del cielo detectado queda como
      la máscara normal de esta capa nueva: se puede repintar a mano después, igual
      que cualquier otra.</p>`;

  const tabs = body.querySelector("#skyTabs");
  const host = body.querySelector("#skyBody");
  for(const b of tabs.querySelectorAll("button")){
    if(b.dataset.m === p.mode) b.classList.add("on");
    b.addEventListener("click", () => {
      p.mode = b.dataset.m;
      tabs.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      renderMode();
      paint();
    });
  }

  function renderMode(){
    host.innerHTML = "";
    if(p.mode === "color"){
      const row = document.createElement("div");
      row.className = "field";
      row.innerHTML = `<label>Color</label><input type="color" id="skyColor" value="${p.color}">`;
      host.appendChild(row);
      row.querySelector("#skyColor").addEventListener("input", e => { p.color = e.target.value; paint(); });
    } else if(p.mode === "gradient"){
      const row1 = document.createElement("div");
      row1.className = "field";
      row1.innerHTML = `<label>Arriba</label><input type="color" id="skyTop" value="${p.top}">`;
      const row2 = document.createElement("div");
      row2.className = "field";
      row2.innerHTML = `<label>Abajo</label><input type="color" id="skyBottom" value="${p.bottom}">`;
      host.append(row1, row2);
      row1.querySelector("#skyTop").addEventListener("input", e => { p.top = e.target.value; paint(); });
      row2.querySelector("#skyBottom").addEventListener("input", e => { p.bottom = e.target.value; paint(); });
    } else {
      const row = document.createElement("div");
      row.className = "field";
      row.innerHTML = `<label>Archivo</label><input type="file" id="skyFile" accept="image/*">`;
      host.appendChild(row);
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Se recorta para cubrir el lienzo entero, centrada, sin deformarla.";
      host.appendChild(hint);
      row.querySelector("#skyFile").addEventListener("change", async e => {
        const f = e.target.files?.[0];
        if(!f) return;
        try{
          p.image = await loadImageFile(f);
          paint();
        }catch(err){
          toast(err.message, "err");
        }
      });
    }
  }
  renderMode();

  const featherHost = body.querySelector("#skyFeatherHost");
  featherHost.appendChild(slider("Desvanecer borde", 0, 60, p.feather,
    v => { p.feather = v; applyMask(); paint(); }, " px"));

  const res = await dialog({
    title: "Reemplazar cielo", body, wide: true,
    cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label:"Cancelar", value:null }, { label:"Aplicar", primary:true, value:"go" }]
  });

  if(res !== "go" || (p.mode === "image" && !p.image)){
    dropLayer(layer);
    if(res === "go") toast("Elige una imagen antes de aplicar", "err");
    return;
  }

  const at = doc.layers.indexOf(layer);
  record("Reemplazar cielo",
    () => dropLayer(layer),
    () => {
      if(doc.layers.indexOf(layer) < 0) doc.layers.splice(Math.min(at, doc.layers.length), 0, layer);
      doc.activeId = layer.id;
      emit("doc:active"); emit("doc:structure"); emit("doc:change");
    });
  emit("doc:structure"); emit("doc:change");
  toast("Cielo reemplazado · capa nueva", "ok");
}
