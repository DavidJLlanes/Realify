/* ═══════════════════════════════════════════════════════════════
   REEMPLAZAR CIELO
   Detecta el cielo con el mismo modelo que «Seleccionar cielo»
   (DeepLab/ADE20K, ver filters/segment/) y deja el reemplazo —un cielo
   de la biblioteca (assets/skies), una foto propia, un degradado o un
   color liso— en una capa nueva, recortada al cielo con una máscara de
   verdad y editable después como cualquier otra: nada de esto se
   «cuece» en la foto original.

   Los cielos de foto (biblioteca o propios) se colocan con su horizonte
   —el borde inferior— sobre el horizonte detectado (la fila más baja
   con cielo), cubriendo el ancho sin deformarse; «Posición» lo sube o
   lo baja.
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

/* Biblioteca de cielos: catálogo y fotos, cargados sólo al usarlos */
const SKIES = new URL("../../assets/skies/", import.meta.url).href;
let catalog = null;
const skyCache = new Map();
async function loadCatalog(){
  if(catalog) return catalog;
  try{ catalog = (await (await fetch(SKIES + "catalog.json")).json()).skies || []; }
  catch{ catalog = []; }
  return catalog;
}
function loadSky(entry){
  if(!skyCache.has(entry.id)) skyCache.set(entry.id, new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { skyCache.delete(entry.id); reject(new Error("No se pudo cargar el cielo")); };
    img.src = SKIES + entry.file;
  }));
  return skyCache.get(entry.id);
}

/* Fila del horizonte: la más baja en la que todavía hay algo de cielo */
function horizonRow(mask, w, h){
  for(let y = h - 1; y >= 0; y--){
    let n = 0; const row = y * w;
    for(let x = 0; x < w; x += 4) if(mask[row + x] > 127) n++;
    if(n > w / 4 * 0.02) return y + 1;
  }
  return h;
}

/* Borde del cielo ajustado a la foto: la máscara del modelo (una
   rejilla de 129 celdas ampliada) pasa por un filtro guiado con la luz
   de la propia foto, así el borde sigue el contorno real de tejados y
   ramas y no queda un halo del cielo antiguo alrededor. Luego se
   aprieta un poco hacia dentro del cielo (el halo suele estar fuera). */
async function refineSkyMask(canvas, mask, w, h){
  const { guidedFilterAlpha } = await import("../editor/refineedge-math.js");
  const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const n = w * h, I = new Float32Array(n), P = new Float32Array(n);
  for(let i = 0, j = 0; i < n; i++, j += 4){ I[i] = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255; P[i] = mask[i] / 255; }
  const r = Math.max(2, Math.round(Math.max(w, h) / 250));
  const g = guidedFilterAlpha(I, P, w, h, r, 0.0004);
  const out = new Uint8ClampedArray(n);
  for(let i = 0; i < n; i++){ const v = (g[i] - 0.5) * 1.6 + 0.45; out[i] = Math.round(Math.min(1, Math.max(0, v)) * 255); }
  return out;
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
  rawMask = await refineSkyMask(base.canvas, rawMask, w, h);
  const p = { mode: "library", color: "#4a90d9", top: "#2f6fb0", bottom: "#dce9f5",
              feather: 2, image: null, skyId: null, offset: 0 };
  const sky = await loadCatalog();
  const filters = { time: "all", weather: "all", query: "" };
  const horizon = horizonRow(rawMask, w, h);
  if(sky.length){
    p.skyId = sky[0].id;
    try{ p.image = await loadSky(sky[0]); }catch{}
  } else p.mode = "gradient";

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
    } else if((p.mode === "image" || p.mode === "library") && p.image){
      // Cubre el ancho y la zona de cielo (hasta el horizonte) sin
      // deformar, con el borde inferior de la foto en el horizonte;
      // «Posición» lo desplaza (sin dejar huecos arriba).
      const iw = p.image.width, ih = p.image.height;
      const R = Math.max(horizon, h * 0.25) * (1 + Math.abs(p.offset) / 100);
      const scale = Math.max(w / iw, R / ih);
      const dw = iw * scale, dh = ih * scale;
      const dy = Math.min(0, Math.max(horizon, h * 0.25) - dh - p.offset / 100 * h);
      x.drawImage(p.image, (w - dw) / 2, dy, dw, dh);
      // Por debajo del horizonte (si la máscara llega), el color del
      // borde inferior del cielo, sin cortes
      if(dy + dh < h){ x.drawImage(p.image, 0, ih - 1, iw, 1, (w - dw) / 2, dy + dh, dw, h - dy - dh); }
    }
    layer.thumbDirty = true;
    emit("doc:change");
  };
  paint();

  const body = document.createElement("div");
  body.innerHTML = `
    <div class="seg" id="skyTabs">
      ${sky.length ? '<button data-m="library">Biblioteca</button>' : ""}
      <button data-m="image">Propia</button>
      <button data-m="gradient">Degradado</button>
      <button data-m="color">Color</button>
    </div>
    <div id="skyBody" style="margin-top:10px"></div>
    <div id="skyFeatherHost" style="margin-top:10px"></div>
    ${isMobile() ? "" : `<p class="hint" style="margin-top:8px">La máscara del cielo detectado queda como
      la máscara normal de esta capa nueva: se puede repintar a mano después, igual
      que cualquier otra.</p>`}`;

  const tabs = body.querySelector("#skyTabs");
  const host = body.querySelector("#skyBody");
  for(const b of tabs.querySelectorAll("button")){
    if(b.dataset.m === p.mode) b.classList.add("on");
    b.addEventListener("click", () => {
      p.mode = b.dataset.m;
      // Cada modo de foto conserva la suya
      if(p.mode === "image") p.image = p.own || null;
      else if(p.mode === "library"){
        p.image = null;
        const e = sky.find(q => q.id === p.skyId);
        if(e) loadSky(e).then(img => {
          if(p.mode === "library" && p.skyId === e.id){ p.image = img; paint(); }
        }).catch(err => toast(err.message, "err"));
      }
      tabs.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      renderMode();
      paint();
    });
  }

  function renderMode(){
    host.innerHTML = "";
    if(p.mode === "library"){
      // En el móvil, los filtros empiezan plegados para dejar sitio a la foto.
      const filterWrap = document.createElement("details");
      filterWrap.className = "sky-filter-wrap";
      filterWrap.open = !isMobile();
      const summary = document.createElement("summary");
      summary.textContent = "Buscar y filtrar cielos";
      filterWrap.appendChild(summary);
      const tools = document.createElement("div");
      tools.className = "sky-tools";
      tools.innerHTML = `<label>Momento
        <select data-filter="time">
          <option value="all">Cualquier hora</option>
          <option value="sunrise">Amanecer</option>
          <option value="morning">Mañana</option>
          <option value="midday">Mediodía</option>
          <option value="afternoon">Tarde</option>
          <option value="sunset">Atardecer</option>
          <option value="dusk">Crepúsculo</option>
          <option value="night">Noche</option>
        </select></label>
        <label>Tiempo
        <select data-filter="weather">
          <option value="all">Cualquier tiempo</option>
          <option value="clear">Despejado</option>
          <option value="partly_cloudy">Nubes y claros</option>
          <option value="overcast">Cubierto</option>
          <option value="fog">Niebla</option>
          <option value="storm">Tormenta</option>
          <option value="special">Especial</option>
        </select></label>
        <label>Buscar
        <input type="search" data-filter="query" placeholder="Nombre o característica" autocomplete="off"></label>`;
      tools.querySelector('[data-filter="time"]').value = filters.time;
      tools.querySelector('[data-filter="weather"]').value = filters.weather;
      tools.querySelector('[data-filter="query"]').value = filters.query;
      filterWrap.appendChild(tools);
      host.appendChild(filterWrap);
      const count = document.createElement("p");
      count.className = "sky-count";
      host.appendChild(count);
      const grid = document.createElement("div");
      grid.className = "sky-lib" + (isMobile() ? " strip" : "");
      host.appendChild(grid);
      const timeNames = { sunrise:"Amanecer", morning:"Mañana", midday:"Mediodía",
        afternoon:"Tarde", sunset:"Atardecer", dusk:"Crepúsculo", night:"Noche" };
      const weatherNames = { clear:"Despejado", partly_cloudy:"Nubes y claros",
        overcast:"Cubierto", fog:"Niebla", storm:"Tormenta", special:"Especial" };
      const renderSkies = () => {
        const query = filters.query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const matches = sky.filter(e =>
          (filters.time === "all" || e.time === filters.time) &&
          (filters.weather === "all" || e.weather === filters.weather) &&
          (!query || [e.name, e.tags, timeNames[e.time], weatherNames[e.weather]]
            .filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query)));
        count.textContent = `${matches.length} de ${sky.length} cielos`;
        grid.replaceChildren();
        for(const e of matches){
          const b = document.createElement("button");
          b.type = "button"; b.className = "sky-thumb" + (e.id === p.skyId ? " on" : "");
          const provenance = e.kind === "photo" ? "Foto de Poly Haven · CC0" : "Cielo generado";
          b.title = `${e.name} · ${timeNames[e.time] || ""} · ${weatherNames[e.weather] || ""} · ${provenance}`;
          b.setAttribute("aria-label", b.title);
          const img = document.createElement("img");
          img.alt = ""; img.loading = "lazy"; img.src = SKIES + e.thumb;
          const label = document.createElement("span");
          label.textContent = e.name;
          const source = document.createElement("small");
          source.textContent = e.kind === "photo" ? "Foto · Poly Haven" : "Generado";
          b.append(img, label, source);
          b.addEventListener("click", async () => {
            p.skyId = e.id;
            p.image = null;
            grid.querySelectorAll(".sky-thumb").forEach(t => t.classList.toggle("on", t === b));
            paint();
            try{
              const loaded = await loadSky(e);
              if(p.mode === "library" && p.skyId === e.id){ p.image = loaded; paint(); }
            }
            catch(err){ toast(err.message, "err"); }
          });
          grid.appendChild(b);
        }
      };
      for(const input of tools.querySelectorAll("[data-filter]")){
        input.addEventListener(input.type === "search" ? "input" : "change", () => {
          filters[input.dataset.filter] = input.value;
          renderSkies();
        });
      }
      renderSkies();
      host.appendChild(slider("Posición", -50, 50, p.offset, v => { p.offset = v; paint(); }, " %"));
    } else if(p.mode === "color"){
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
      hint.textContent = "Su borde inferior se coloca en el horizonte, sin deformarla.";
      if(!isMobile()) host.appendChild(hint);
      row.querySelector("#skyFile").addEventListener("change", async e => {
        const f = e.target.files?.[0];
        if(!f) return;
        try{
          p.image = p.own = await loadImageFile(f);
          paint();
        }catch(err){
          toast(err.message, "err");
        }
      });
      host.appendChild(slider("Posición", -50, 50, p.offset, v => { p.offset = v; paint(); }, " %"));
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

  if(res !== "go" || ((p.mode === "image" || p.mode === "library") && !p.image)){
    dropLayer(layer);
    if(res === "go") toast("Elige una imagen antes de aplicar", "err");
    return;
  }

  // Porcentaje de aplicación: mezcla el cielo nuevo con el original
  (await import("../editor/filterlayer.js")).markMixLayer(layer, "Cielo reemplazado");
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
