/* ═══════════════════════════════════════════════════════════════
   PALETA DE COLORES DE LA IMAGEN · CUENTAGOTAS DE PANTALLA

   Paleta: los colores dominantes de la imagen visible (k-medias sobre
   una muestra, en un espacio aproximadamente uniforme para el ojo).
   Tocar un color lo copia y lo pone como color frontal; la paleta se
   puede crear como CAPA NUEVA (franja de muestras con su código),
   descargar como PNG o copiar como texto.

   Cuentagotas de pantalla: la API EyeDropper (Chrome y Edge de
   escritorio) coge un color de cualquier sitio de la pantalla.
   ═══════════════════════════════════════════════════════════════ */

import { doc, addLayer } from "../core/doc.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";
import { flatten } from "../editor/layertree.js";
import { state as toolState } from "../editor/tools.js";
import { dialog } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { isMobile } from "../core/device.js";

const hex = ([r, g, b]) => "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
const lum = ([r, g, b]) => (.2126 * r + .7152 * g + .0722 * b) / 255;

/** Colores dominantes (k-medias++ con 12 iteraciones). */
export function dominantColors(canvas, k = 6){
  const s = Math.min(1, Math.sqrt(40000 / (canvas.width * canvas.height)));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(canvas.width * s)); c.height = Math.max(1, Math.round(canvas.height * s));
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(canvas, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, px = [];
  for(let i = 0; i < d.length; i += 4) if(d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
  if(!px.length) return [];
  // Distancia con pesos «redmean», más cercana a la percepción que la euclídea en RGB
  const dist = (a, b) => { const rm = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };
  let rnd = 12345; const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const cent = [px[Math.floor(rand() * px.length)].slice()];
  while(cent.length < k){
    const dd = px.map(p => Math.min(...cent.map(q => dist(p, q)))), tot = dd.reduce((a, b) => a + b, 0);
    let r = rand() * tot, i = 0; while(i < dd.length - 1 && (r -= dd[i]) > 0) i++;
    cent.push(px[i].slice());
  }
  const lab = new Int32Array(px.length);
  for(let it = 0; it < 12; it++){
    px.forEach((p, i) => { let b = 0, bd = Infinity; cent.forEach((q, j) => { const v = dist(p, q); if(v < bd){ bd = v; b = j; } }); lab[i] = b; });
    const sum = cent.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = sum[lab[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sum.forEach((s, j) => { if(s[3]) cent[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const count = cent.map(() => 0); lab.forEach(l => count[l]++);
  return cent.map((c, j) => ({ rgb: c.map(Math.round), hex: hex(c), share: count[j] / px.length }))
             .filter(c => c.share > 0).sort((a, b) => b.share - a.share);
}

function swatchCanvas(colors, w, h, labels = true){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), cw = w / colors.length;
  colors.forEach((col, i) => {
    x.fillStyle = col.hex; x.fillRect(Math.floor(i * cw), 0, Math.ceil(cw), h);
    if(labels){
      x.fillStyle = lum(col.rgb) > .55 ? "rgba(0,0,0,.8)" : "rgba(255,255,255,.92)";
      x.font = `600 ${Math.max(10, Math.round(Math.min(cw / 6, h / 5)))}px system-ui, sans-serif`;
      x.textAlign = "center"; x.textBaseline = "bottom";
      x.fillText(col.hex.toUpperCase(), (i + .5) * cw, h - h * .1);
    }
  });
  return c;
}

export async function colorPalette(){
  if(!doc.open){ toast("No hay documento abierto", "err"); return; }
  const flat = flatten();
  let n = 6, colors = dominantColors(flat, n);
  const body = document.createElement("div");
  const render = () => {
    body.querySelector(".pal").innerHTML = colors.map((c, i) =>
      `<button type="button" data-i="${i}" title="Copiar y usar como color frontal" style="display:grid;gap:4px;padding:0;border:0;background:none;color:inherit;cursor:pointer">
        <span style="display:block;height:56px;border-radius:8px;background:${c.hex};border:1px solid var(--line-strong)"></span>
        <span class="mono" style="font-size:11px">${c.hex.toUpperCase()}</span>
        <span style="font-size:10px;color:var(--tx-dim)">${Math.round(c.share * 100)} %</span></button>`).join("");
    body.querySelector("#palNV").textContent = n;
  };
  body.innerHTML = `
    <div class="pal" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;margin-bottom:12px"></div>
    <div class="field"><label>Colores</label><input type="range" id="palN" class="grow" min="3" max="12" value="${n}"><span class="unit mono" id="palNV">${n}</span></div>
    <p class="hint" style="margin:4px 0 0">Toca un color para copiarlo y usarlo como color frontal.</p>`;
  body.addEventListener("click", async e => {
    const b = e.target.closest("[data-i]"); if(!b) return;
    const c = colors[+b.dataset.i];
    toolState.fg = c.hex; emit("color:change");
    try{ await navigator.clipboard.writeText(c.hex.toUpperCase()); toast(`${c.hex.toUpperCase()} copiado y puesto como color frontal`, "ok"); }
    catch{ toast(`${c.hex.toUpperCase()} puesto como color frontal`, "ok"); }
  });
  body.querySelector("#palN").addEventListener("change", e => { n = +e.target.value; colors = dominantColors(flat, n); render(); });
  body.querySelector("#palN").addEventListener("input", e => { body.querySelector("#palNV").textContent = e.target.value; });
  render();
  const res = await dialog({ title: "Paleta de colores", body, wide: !isMobile(), cls: isMobile() ? "dlg-compact" : "",
    buttons: [{ label: "Cerrar", value: null }, { label: "Copiar códigos", value: "copy" }, { label: "Descargar PNG", value: "png" }, { label: "Crear capa", primary: true, value: "layer" }] });
  if(res === "copy"){
    const txt = colors.map(c => `${c.hex.toUpperCase()}  rgb(${c.rgb.join(", ")})`).join("\n");
    try{ await navigator.clipboard.writeText(txt); toast("Códigos de la paleta copiados", "ok"); }catch{ toast("No se pudo copiar al portapapeles", "err"); }
  } else if(res === "png"){
    const blob = await new Promise(r => swatchCanvas(colors, 1200, 300).toBlob(r, "image/png"));
    const { saveOrShare, stamp } = await import("../io/export.js");
    await saveOrShare(blob, `${doc.name || "paleta"}-paleta-${stamp()}.png`);
  } else if(res === "layer"){
    // Capa nueva: franja con las muestras abajo del todo
    const prevLayers = doc.layers.slice(), prevActive = doc.activeId;
    const l = addLayer({ name: "Paleta de colores" });
    const h = Math.max(40, Math.round(doc.h * .14));
    l.ctx.drawImage(swatchCanvas(colors, doc.w, h), 0, doc.h - h);
    l.thumbDirty = true;
    const nextLayers = doc.layers.slice(), nextActive = l.id;
    const put = (ls, a) => { doc.layers = ls.slice(); doc.activeId = a; emit("doc:structure"); emit("doc:change"); };
    record("Paleta de colores", () => put(prevLayers, prevActive), () => put(nextLayers, nextActive));
    emit("doc:structure"); emit("doc:change");
    toast("Paleta añadida en una capa nueva", "ok");
  }
}

/** Cuentagotas de pantalla (EyeDropper). */
export async function screenEyedropper(){
  if(!("EyeDropper" in window)){
    toast("Este navegador no permite coger colores fuera de la página. Funciona en Chrome o Edge de escritorio; aquí usa el Cuentagotas (I) sobre la imagen.", "err");
    return;
  }
  try{
    const { sRGBHex } = await new window.EyeDropper().open();
    toolState.fg = sRGBHex; emit("color:change");
    toast(`${sRGBHex.toUpperCase()} puesto como color frontal`, "ok");
  }catch{ /* cancelado con Esc */ }
}
