/* ═══════════════════════════════════════════════════════════════
   PANEL EXIF
   Dos modos. El automático fija un valor de exposición para la
   escena y deriva la velocidad de la apertura y el ISO, de forma que
   el triángulo se sostenga; el manual deja tocar cada campo.
   La identidad y la ubicación valen en los dos modos: son datos del
   usuario, no de la escena.
   ═══════════════════════════════════════════════════════════════ */

import { BODIES, LENSES, BODY_BY_ID, LENS_BY_ID, SHUTTERS, APERTURES, ISOS,
         CITIES, SCENES, shLabel, shSec, nearestShutter,
         cropOf, rollExif } from "./db.js";
import { buildExifBlock, injectExif } from "./writer.js";
import { checkCoherence } from "../analysis/coherence.js";
import { doc } from "../core/doc.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";

const LS = "realify.exif";

export const exifState = {
  on: false, mode: "auto",
  body: "canon_600d", lens: "tamron_18_270",
  scene: "portrait_day", vary: true, naming: true, jitter: true,
  last: null,
  manual: null,
  id: { artist:"", copyright:"", serial:"", software:"" },
  gps: { on:false, city:-1, lat:40.4168, lon:-3.7038, alt:667 }
};

try{
  const o = JSON.parse(localStorage.getItem(LS) || "null");
  if(o){
    Object.assign(exifState, o);
    exifState.last = null;   // el sorteo no se conserva: se rehace
  }
}catch{}

export function saveExif(){
  try{
    const { last, manual, ...rest } = exifState;
    localStorage.setItem(LS, JSON.stringify({ ...rest, manual }));
  }catch{}
}

/* Un copyright de 2026 sobre una captura de 2024 es una contradicción
   tonta y evitable: el año se alinea con la fecha del disparo. */
function syncYear(v){
  if(v.copyright && v.date instanceof Date && !isNaN(v.date))
    v.copyright = v.copyright.replace(/\b(?:19|20)\d{2}\b/, String(v.date.getFullYear()));
  return v;
}

function identity(){
  return {
    software: exifState.id.software.trim(),
    artist: exifState.id.artist.trim(),
    copyright: exifState.id.copyright.trim(),
    serial: exifState.id.serial.trim(),
    gps: exifState.gps.on
      ? { lat: exifState.gps.lat, lon: exifState.gps.lon, alt: exifState.gps.alt }
      : null
  };
}

export function exifValues(reroll){
  if(exifState.mode === "auto"){
    if(reroll || !exifState.last ||
       exifState.last.bodyId !== exifState.body ||
       exifState.last.lensId !== exifState.lens){
      exifState.last = rollExif(exifState.body, exifState.lens, exifState.scene);
    }
    return syncYear(Object.assign({}, exifState.last, identity()));
  }
  const m = exifState.manual || (exifState.manual = rollExif(
    exifState.body, exifState.lens, exifState.scene));
  return syncYear(Object.assign({}, m, {
    bodyId: exifState.body, lensId: exifState.lens
  }, identity()));
}

/* Un GPS real tiene error de metros y jamás repite lectura. Veinte
   fotos con la misma coordenada al microgrado es una constante que
   delata el lote. ±0.002° son unos 200 m: el mismo barrio. */
function jitterGps(g){
  if(!g || !exifState.jitter) return g;
  return {
    lat: g.lat + (Math.random()*2 - 1) * 0.002,
    lon: g.lon + (Math.random()*2 - 1) * 0.002,
    alt: Math.max(0, g.alt + Math.round((Math.random()*2 - 1) * 12))
  };
}

/* Envuelve un JPEG con la cabecera EXIF. Si algo falla se devuelve el
   original: mejor sin metadatos que corrupto. */
export async function withExif(blob, w, h, reroll, dateOverride){
  if(!exifState.on || !blob || blob.type !== "image/jpeg") return blob;
  try{
    const v = exifValues(reroll && exifState.mode === "auto" && exifState.vary);
    if(dateOverride){ v.date = dateOverride; syncYear(v); }
    v.gps = jitterGps(v.gps);
    const tiff = buildExifBlock(v, w, h);
    const u8 = new Uint8Array(await blob.arrayBuffer());
    return injectExif(u8, tiff) || blob;
  }catch(err){
    console.error("[exif]", err);
    return blob;
  }
}

/* Una cámara no nombra sus archivos con la fecha: usa un contador. */
let counter = Math.floor(Math.random() * 8500) + 500;
export function cameraName(){
  counter = counter >= 9999 ? 1 : counter + 1;
  return "IMG_" + String(counter).padStart(4, "0") + ".JPG";
}
export const useCameraNaming = () => exifState.on && exifState.naming;

/* Las comprobaciones viven en analysis/coherence.js, no aquí: son las
   mismas que hacen falta al examinar un archivo ajeno, y tenerlas por
   duplicado significaba que tocar una regla en un sitio dejaba el otro
   mintiendo. Allí además son código puro, con pruebas propias.

   Se le pasan también las medidas de la imagen abierta, que es lo que
   permite cazar lo que el EXIF por sí solo no delata: un cuerpo que no
   da tantos píxeles, o un ISO alto sobre una imagen sin grano. */
export function warnings(v){
  return checkCoherence({
    bodyId: v.bodyId, lensId: v.lensId,
    iso: v.iso, aperture: v.aperture, focal: v.focal, date: v.date,
    width: doc.open ? doc.w : 0, height: doc.open ? doc.h : 0
  }).map(f => f.text);
}

/* ── diálogo ──────────────────────────────────────────────────── */
export async function openExif(){
  const wrap = document.createElement("div");
  wrap.className = "exif-panel";
  wrap.innerHTML = html();
  wire(wrap);
  await dialog({
    title:"Metadatos EXIF", wide:true, body: wrap,
    buttons:[{ label:"Hecho", primary:true }]
  });
  saveExif();
}

const opt = (v, l, sel) => `<option value="${v}"${sel ? " selected" : ""}>${l}</option>`;

function html(){
  const e = exifState;
  return `
  <label class="chk" style="margin-bottom:10px">
    <input type="checkbox" id="exOn" ${e.on ? "checked" : ""}>
    <b>Incrustar EXIF al exportar en JPEG</b></label>
  <p class="hint">El PNG no admite EXIF. Sin esto, se exporta limpio.</p>

  <div class="field"><label>Modo</label>
    <div class="seg grow">
      <button id="exAuto" class="${e.mode === "auto" ? "on" : ""}">Automático</button>
      <button id="exMan" class="${e.mode === "manual" ? "on" : ""}">Manual</button>
    </div></div>

  <div class="section-label">Equipo</div>
  <div class="field"><label>Cuerpo</label>
    <select id="exBody" class="grow">
      ${BODIES.map(b => opt(b.id, b.model, b.id === e.body)).join("")}
    </select></div>
  <div class="field"><label>Objetivo</label>
    <select id="exLens" class="grow">
      ${LENSES.map(l => opt(l.id, l.make + " " + l.model, l.id === e.lens)).join("")}
    </select></div>
  <p class="warn" id="exWarn"></p>
  <label class="chk"><input type="checkbox" id="exName" ${e.naming ? "checked" : ""}>
    Nombrar los archivos como la cámara (IMG_0001.JPG)</label>

  <div id="exAutoBox" ${e.mode === "auto" ? "" : "hidden"}>
    <div class="section-label">Escena</div>
    <div class="field"><label>Tipo</label>
      <select id="exScene" class="grow">
        ${Object.entries(SCENES).map(([k, v]) => opt(k, v.label, k === e.scene)).join("")}
      </select></div>
    <label class="chk"><input type="checkbox" id="exVary" ${e.vary ? "checked" : ""}>
      Sortear valores nuevos en cada exportación</label>
    <button id="exRoll" class="wide">Sortear ahora</button>
  </div>

  <div id="exManBox" ${e.mode === "manual" ? "" : "hidden"}>
    <div class="section-label">Exposición</div>
    <div class="field"><label>Velocidad</label><select id="mShutter" class="grow"></select></div>
    <div class="field"><label>Apertura</label><select id="mAp" class="grow"></select></div>
    <div class="field"><label>ISO</label><select id="mIso" class="grow"></select></div>
    <div class="field"><label>Focal</label>
      <input type="number" id="mFocal" class="grow" min="1" max="1200">
      <span class="unit">mm</span></div>
    <div class="field"><label>Compensación</label><select id="mBias" class="grow"></select></div>
    <div class="section-label">Cámara</div>
    <div class="field"><label>Programa</label>
      <select id="mProg" class="grow">
        ${[[0,"No definido"],[1,"Manual"],[2,"Programa"],[3,"Prioridad apertura"],
           [4,"Prioridad velocidad"],[5,"Creativo"],[6,"Acción"],[7,"Retrato"],
           [8,"Paisaje"]].map(([v,l]) => opt(v,l)).join("")}
      </select></div>
    <div class="field"><label>Medición</label>
      <select id="mMeter" class="grow">
        ${[[1,"Promedio"],[2,"Ponderada al centro"],[3,"Puntual"],
           [5,"Evaluativa"],[6,"Parcial"]].map(([v,l]) => opt(v,l)).join("")}
      </select></div>
    <div class="field"><label>Flash</label>
      <select id="mFlash" class="grow">
        ${[[16,"No disparó (apagado)"],[0,"No disparó"],[24,"No disparó (auto)"],
           [9,"Disparó (forzado)"],[25,"Disparó (auto)"],
           [89,"Disparó, ojos rojos"]].map(([v,l]) => opt(v,l)).join("")}
      </select></div>
    <div class="field"><label>Balance</label>
      <select id="mWb" class="grow">${opt(0,"Automático")}${opt(1,"Manual")}</select></div>
    <div class="field"><label>Escena</label>
      <select id="mScene" class="grow">
        ${[[0,"Estándar"],[1,"Paisaje"],[2,"Retrato"],[3,"Nocturna"]]
          .map(([v,l]) => opt(v,l)).join("")}</select></div>
    <div class="field"><label>Fecha y hora</label>
      <input type="datetime-local" id="mDate" class="grow" step="1"></div>
  </div>

  <div class="section-label">Identidad</div>
  <p class="hint">Se queda vacío salvo que lo rellenes. La herramienta no inventa
    autoría ni números de serie: atribuir un archivo a una persona o a un equipo
    concretos es una afirmación, y tiene que ser tuya.</p>
  <div class="field"><label>Autor</label>
    <input type="text" id="idArtist" class="grow" value="${esc(e.id.artist)}" placeholder="(vacío)"></div>
  <div class="field"><label>Copyright</label>
    <input type="text" id="idCopy" class="grow" value="${esc(e.id.copyright)}" placeholder="(vacío)"></div>
  <div class="field"><label>Nº de serie</label>
    <input type="text" id="idSerial" class="grow" value="${esc(e.id.serial)}" placeholder="(vacío)"></div>
  <div class="field"><label>Software</label>
    <input type="text" id="idSoft" class="grow" value="${esc(e.id.software)}" placeholder="(vacío)"></div>

  <div class="section-label">Ubicación</div>
  <label class="chk"><input type="checkbox" id="gpsOn" ${e.gps.on ? "checked" : ""}>
    Incluir coordenadas GPS</label>
  <div class="field"><label>Capital</label>
    <select id="gpsCity" class="grow">
      <option value="-1">A medida</option>
      ${CITIES.map((c, i) => opt(i, c[0], i === e.gps.city)).join("")}
    </select></div>
  <div class="field"><label>Latitud</label>
    <input type="number" id="gpsLat" class="grow" step="0.000001" value="${e.gps.lat}"></div>
  <div class="field"><label>Longitud</label>
    <input type="number" id="gpsLon" class="grow" step="0.000001" value="${e.gps.lon}"></div>
  <div class="field"><label>Altitud</label>
    <input type="number" id="gpsAlt" class="grow" step="1" value="${e.gps.alt}">
    <span class="unit">m</span></div>
  <label class="chk"><input type="checkbox" id="gpsJit" ${e.jitter ? "checked" : ""}>
    Desplazar unos metros en cada foto</label>

  <pre id="exSummary"></pre>`;
}

const esc = s => String(s || "").replace(/"/g, "&quot;");

function wire(w){
  const q = s => w.querySelector(s);

  // Listas largas: se rellenan por JS para no inflar el HTML
  q("#mShutter").innerHTML = SHUTTERS.map((s, i) =>
    opt(i, shLabel(s[0], s[1]))).join("");
  q("#mAp").innerHTML  = APERTURES.map(a => opt(a, "f/" + a)).join("");
  q("#mIso").innerHTML = ISOS.map(v => opt(v, "ISO " + v)).join("");
  q("#mBias").innerHTML = Array.from({ length: 19 }, (_, i) => i - 9)
    .map(n => opt(n, (n > 0 ? "+" : "") + (n/3).toFixed(2).replace(/\.?0+$/, "") + " EV")).join("");

  const pullManual = () => {
    const m = exifState.manual || (exifState.manual = exifValues(false));
    q("#mShutter").value = String(SHUTTERS.findIndex(s =>
      s[0] === m.shutter[0] && s[1] === m.shutter[1]));
    q("#mAp").value = String(m.aperture);
    q("#mIso").value = String(m.iso);
    q("#mFocal").value = m.focal;
    q("#mBias").value = String(m.bias);
    q("#mProg").value = String(m.program);
    q("#mMeter").value = String(m.meter);
    q("#mFlash").value = String(m.flash);
    q("#mWb").value = String(m.wb);
    q("#mScene").value = String(m.sceneType);
    const d = new Date(m.date.getTime() - m.date.getTimezoneOffset() * 60000);
    q("#mDate").value = d.toISOString().slice(0, 19);
  };

  const pushManual = () => {
    const m = exifState.manual || (exifState.manual = exifValues(false));
    m.shutter   = SHUTTERS[+q("#mShutter").value] || [1, 250];
    m.aperture  = +q("#mAp").value;
    m.iso       = +q("#mIso").value;
    m.focal     = Math.max(1, +q("#mFocal").value || 50);
    m.bias      = +q("#mBias").value;
    m.program   = +q("#mProg").value;
    m.meter     = +q("#mMeter").value;
    m.flash     = +q("#mFlash").value;
    m.wb        = +q("#mWb").value;
    m.sceneType = +q("#mScene").value;
    const dv = q("#mDate").value;
    m.date = dv ? new Date(dv) : new Date();
    render();
  };

  const render = () => {
    const v = exifValues(false);
    const b = BODY_BY_ID[v.bodyId] || BODIES[0];
    const l = LENS_BY_ID[v.lensId] || LENSES[0];
    const crop = cropOf(b);
    const ev = Math.log2(v.aperture * v.aperture / shSec(v.shutter)) - Math.log2(v.iso / 100);
    const lines = [
      b.model,
      `${l.make} ${l.model}`,
      `${shLabel(v.shutter[0], v.shutter[1])} · f/${v.aperture} · ISO ${v.iso} · ${v.focal} mm` +
        (Math.abs(crop - 1) > 0.02 ? ` (${Math.round(v.focal * crop)} mm eq.)` : ""),
      `EV${ev.toFixed(1)} a ISO 100 · compensación ${(v.bias/3).toFixed(2).replace(/\.?0+$/, "")} EV`,
      new Date(v.date).toLocaleString("es-ES")
    ];
    if(v.artist)    lines.push("Autor: " + v.artist);
    if(v.copyright) lines.push(v.copyright);
    if(v.serial)    lines.push("Nº serie: " + v.serial);
    if(v.software)  lines.push("Software: " + v.software);
    if(v.gps)       lines.push(`GPS ${v.gps.lat.toFixed(4)}, ${v.gps.lon.toFixed(4)} · ${v.gps.alt} m`);
    q("#exSummary").textContent = exifState.on ? lines.join("\n") : "Desactivado.";
    q("#exWarn").textContent = warnings(v).join(" ");
  };

  q("#exOn").addEventListener("change", e => { exifState.on = e.target.checked; render(); });
  q("#exName").addEventListener("change", e => { exifState.naming = e.target.checked; });

  const setMode = m => {
    if(m === "manual" && !exifState.manual) exifState.manual = exifValues(false);
    exifState.mode = m;
    q("#exAuto").classList.toggle("on", m === "auto");
    q("#exMan").classList.toggle("on", m === "manual");
    q("#exAutoBox").hidden = m !== "auto";
    q("#exManBox").hidden = m === "auto";
    if(m === "manual") pullManual();
    render();
  };
  q("#exAuto").addEventListener("click", () => setMode("auto"));
  q("#exMan").addEventListener("click", () => setMode("manual"));

  q("#exBody").addEventListener("change", e => {
    exifState.body = e.target.value; exifState.last = null; render();
  });
  q("#exLens").addEventListener("change", e => {
    exifState.lens = e.target.value; exifState.last = null;
    const l = LENS_BY_ID[exifState.lens];
    if(exifState.manual && l){
      const f = exifState.manual.focal;
      if(f < l.fmin || f > l.fmax){
        exifState.manual.focal = Math.round((l.fmin + l.fmax) / 2);
        if(exifState.mode === "manual") pullManual();
      }
    }
    render();
  });
  q("#exScene").addEventListener("change", e => {
    exifState.scene = e.target.value; exifState.last = null; render();
  });
  q("#exVary").addEventListener("change", e => { exifState.vary = e.target.checked; });
  q("#exRoll").addEventListener("click", () => { exifValues(true); render(); });

  ["#mShutter","#mAp","#mIso","#mFocal","#mBias","#mProg","#mMeter",
   "#mFlash","#mWb","#mScene","#mDate"].forEach(sel =>
    q(sel).addEventListener("input", pushManual));

  const idMap = { "#idArtist":"artist", "#idCopy":"copyright",
                  "#idSerial":"serial", "#idSoft":"software" };
  for(const sel in idMap){
    q(sel).addEventListener("input", e => {
      exifState.id[idMap[sel]] = e.target.value;
      render();
    });
  }

  q("#gpsOn").addEventListener("change", e => { exifState.gps.on = e.target.checked; render(); });
  q("#gpsJit").addEventListener("change", e => { exifState.jitter = e.target.checked; });
  q("#gpsCity").addEventListener("change", e => {
    const i = +e.target.value;
    const c = CITIES[i];
    if(!c) return;
    exifState.gps.city = i;
    exifState.gps.lat = c[1]; exifState.gps.lon = c[2]; exifState.gps.alt = c[3];
    q("#gpsLat").value = c[1]; q("#gpsLon").value = c[2]; q("#gpsAlt").value = c[3];
    if(!exifState.gps.on){ exifState.gps.on = true; q("#gpsOn").checked = true; }
    render();
  });
  ["#gpsLat","#gpsLon","#gpsAlt"].forEach(sel =>
    q(sel).addEventListener("input", () => {
      exifState.gps.lat = +q("#gpsLat").value || 0;
      exifState.gps.lon = +q("#gpsLon").value || 0;
      exifState.gps.alt = +q("#gpsAlt").value || 0;
      // El desplegable no debe nombrar una ciudad que ya no es la de
      // los campos: se deduce de las coordenadas.
      const i = CITIES.findIndex(c =>
        Math.abs(c[1] - exifState.gps.lat) < 1e-4 &&
        Math.abs(c[2] - exifState.gps.lon) < 1e-4 && c[3] === exifState.gps.alt);
      exifState.gps.city = i;
      q("#gpsCity").value = String(i);
      render();
    }));

  if(exifState.mode === "manual") pullManual();
  render();
}
