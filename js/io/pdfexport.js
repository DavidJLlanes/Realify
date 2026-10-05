/* Exportar PDF… (fase 17): diálogo del PDF profesional. El motor está en pdfpro.js. */
import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { isMobile } from "../core/device.js";
import { isP3Doc, toSrgbCanvas } from "../core/colorspace.js";
import { saveOrShare, sanitizeFilename } from "./export.js";
import { buildPdf, PAGES, PER_PAGE } from "./pdfpro.js";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const KEY = "realify.pdf";
const load = () => { try{ return JSON.parse(localStorage.getItem(KEY) || "{}"); }catch{ return {}; } };
const save = v => { try{ localStorage.setItem(KEY, JSON.stringify(v)); }catch{} };

/** Datos de un JPEG que se pueden incrustar tal cual: [ok, ancho, alto]. No vale si lleva giro EXIF, perfil ICC o no es gris/RGB. */
export function jpegInfo(u8){
  if(u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
  let o = 2, orient = 1, icc = false, comps = 0, w = 0, h = 0;
  while(o + 4 < u8.length){
    if(u8[o] !== 0xFF){ o++; continue; }
    const m = u8[o + 1]; if(m === 0xFF){ o++; continue; }
    if(m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01){ o += 2; continue; }
    const len = (u8[o + 2] << 8) | u8[o + 3];
    if(m === 0xE1 && u8[o + 4] === 0x45 && u8[o + 5] === 0x78){                    // «Exif»
      const t = o + 10, le = u8[t] === 0x49, g16 = p => le ? u8[p] | (u8[p + 1] << 8) : (u8[p] << 8) | u8[p + 1];
      const g32 = p => le ? (u8[p] | (u8[p + 1] << 8) | (u8[p + 2] << 16) | (u8[p + 3] << 24)) >>> 0 : ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
      const ifd = t + g32(t + 4), n = g16(ifd);
      for(let i = 0; i < n && ifd + 2 + i * 12 + 12 < u8.length; i++) if(g16(ifd + 2 + i * 12) === 0x0112) orient = g16(ifd + 2 + i * 12 + 8);
    }
    if(m === 0xE2 && String.fromCharCode(...u8.subarray(o + 4, o + 15)) === "ICC_PROFILE"){      // un perfil sRGB no cambia nada: los visores de PDF ya suponen sRGB
      const head = String.fromCharCode(...u8.subarray(o + 18, Math.min(o + 2 + len, o + 18 + 700)));
      if(!/s\x00?R\x00?G\x00?B/.test(head)) icc = true;
    }
    if(m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC){ h = (u8[o + 5] << 8) | u8[o + 6]; w = (u8[o + 7] << 8) | u8[o + 8]; comps = u8[o + 9]; break; }
    o += 2 + len;
  }
  if(!w || !h) return null;
  return { raw: orient === 1 && !icc && (comps === 1 || comps === 3), w, h };
}

async function readImage(file){
  const buf = new Uint8Array(await file.arrayBuffer()), name = file.name.replace(/\.[^.]+$/, "");
  if(file.type === "image/jpeg"){ const j = jpegInfo(buf); if(j?.raw) return { name, jpeg: buf, w: j.w, h: j.h }; }
  let bmp;
  try{ bmp = await createImageBitmap(new Blob([buf], { type: file.type }), { colorSpaceConversion: "default" }); }
  catch{
    try{ bmp = await (await import("./compatibility.js")).decodeAny(file); }
    catch{ throw new Error(`No se pudo leer «${file.name}»`); }
  }
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  c.getContext("2d", { colorSpace: "srgb" }).drawImage(bmp, 0, 0);
  return { name, canvas: c };
}

export async function exportPdf(){
  if(!doc.open){ toast("No hay documento abierto"); return; }
  const p = { page: "a4", orientation: "auto", perPage: 1, margin: 10, bleed: 0, dpi: 300, quality: 90, lossless: false, cover: false, numbering: false, captions: false, author: "", ...load() };
  const extra = [];
  const body = document.createElement("div");
  const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}"${String(v) === String(cur) ? " selected" : ""}>${l}</option>`).join("");
  body.innerHTML = `
    <div class="field"><label>Páginas</label><span class="grow" id="pdSrc"></span><button type="button" id="pdAdd">Añadir imágenes…</button></div>
    <div class="field"><label>Tamaño</label><select id="pdPage" class="grow">${opts([["image", "Como la imagen"], ["a4", "A4"], ["a3", "A3"], ["a5", "A5"], ["letter", "Carta"], ["legal", "Legal"]], p.page)}</select>
      <select id="pdOri">${opts([["auto", "Automática"], ["portrait", "Vertical"], ["landscape", "Horizontal"]], p.orientation)}</select></div>
    <div class="field"><label>Por página</label><select id="pdPer" class="grow">${opts(PER_PAGE.map(n => [n, n === 1 ? "1 imagen" : n + " imágenes"]), p.perPage)}</select></div>
    <div class="field"><label>Márgenes</label><input id="pdMargin" type="number" min="0" max="50" step="1" value="${p.margin}" style="width:64px"><span class="unit mono">mm</span>
      <label style="margin-left:10px">Sangrado</label><input id="pdBleed" type="number" min="0" max="10" step="0.5" value="${p.bleed}" style="width:64px"><span class="unit mono">mm</span></div>
    <div class="field"><label>Resolución</label><select id="pdDpi" class="grow">${opts([[96, "96 ppp (pantalla)"], [150, "150 ppp"], [200, "200 ppp"], [300, "300 ppp (impresión)"], [450, "450 ppp"], [600, "600 ppp"]], p.dpi)}</select></div>
    <div class="field" id="pdQRow"><label>Calidad</label><input id="pdQ" type="range" class="grow" min="40" max="100" value="${p.quality}"><span class="unit mono" id="pdQv">${p.quality}</span></div>
    <label class="chk"><input id="pdLossless" type="checkbox"${p.lossless ? " checked" : ""}> Sin pérdidas (PNG, más peso)</label>
    <label class="chk"><input id="pdCover" type="checkbox"${p.cover ? " checked" : ""}> Portada</label>
    <div class="field" id="pdCoverRow" hidden><label>Título</label><input id="pdTitle" class="grow" value="${esc(sanitizeFilename(doc.name || "") || "")}"></div>
    <label class="chk"><input id="pdNum" type="checkbox"${p.numbering ? " checked" : ""}> Numerar las páginas</label>
    <label class="chk" id="pdCapRow"><input id="pdCap" type="checkbox"${p.captions ? " checked" : ""}> Nombre bajo cada imagen</label>
    <details style="margin:6px 0"><summary style="cursor:pointer">Metadatos del PDF</summary>
      <div class="field"><label>Autor</label><input id="pdAuthor" class="grow" value="${esc(p.author)}"></div>
      <div class="field"><label>Asunto</label><input id="pdSubject" class="grow"></div>
      <div class="field"><label>Palabras clave</label><input id="pdKeys" class="grow" placeholder="separadas por comas"></div></details>
    <div class="mono" id="pdInfo" style="font-size:11px;margin-top:4px"></div>`;
  const $ = s => body.querySelector(s);
  const total = () => 1 + extra.length;
  const sync = () => {
    $("#pdSrc").textContent = extra.length ? `Documento + ${extra.length} imagen${extra.length === 1 ? "" : "es"}` : "Sólo el documento";
    const free = $("#pdPage").value === "image";
    if(free) $("#pdPer").value = "1";
    $("#pdPer").disabled = free; $("#pdOri").disabled = free;
    $("#pdQRow").hidden = $("#pdLossless").checked;
    $("#pdCoverRow").hidden = !$("#pdCover").checked;
    $("#pdCapRow").hidden = +$("#pdPer").value === 1;
    const pages = Math.ceil(total() / +$("#pdPer").value) + ($("#pdCover").checked ? 1 : 0);
    $("#pdInfo").textContent = `${pages} página${pages === 1 ? "" : "s"}` + (+$("#pdBleed").value > 0 ? " · con sangrado y marcas de recorte en TrimBox" : "");
  };
  body.addEventListener("input", e => { if(e.target.id === "pdQ") $("#pdQv").textContent = e.target.value; sync(); });
  body.addEventListener("change", sync);
  const picker = document.createElement("input"); picker.type = "file"; picker.accept = "image/*"; picker.multiple = true; picker.hidden = true; body.appendChild(picker);
  $("#pdAdd").addEventListener("click", () => picker.click());
  picker.addEventListener("change", async () => {
    const files = [...picker.files]; picker.value = "";
    for(const f of files){ try{ extra.push(await readImage(f)); }catch(err){ toast(String(err.message || err), "err"); } }
    sync();
  });
  sync();
  const r = await dialog({ title: "Exportar PDF", body, wide: true, cls: isMobile() ? "dlg-compact" : "", buttons: [{ label: "Cancelar", value: null }, { label: "Crear PDF", primary: true, value: "go" }] });
  if(r !== "go") return;
  const num = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : d; };
  const s = { page: $("#pdPage").value, orientation: $("#pdOri").value, perPage: +$("#pdPer").value, margin: num("#pdMargin", 10), bleed: num("#pdBleed", 0), dpi: +$("#pdDpi").value,
    quality: +$("#pdQ").value, lossless: $("#pdLossless").checked, cover: $("#pdCover").checked, numbering: $("#pdNum").checked, captions: $("#pdCap").checked, author: $("#pdAuthor").value };
  save(s);
  status("Creando PDF…");
  try{
    let flat = flatten(); if(isP3Doc()) flat = toSrgbCanvas(flat);
    const name = sanitizeFilename(doc.name || "") || "documento";
    const out = await buildPdf([{ name, canvas: flat }, ...extra], { page: s.page, orientation: s.orientation, perPage: s.perPage, marginMm: s.margin, bleedMm: s.bleed, dpi: s.dpi,
      quality: s.quality / 100, lossless: s.lossless, numbering: s.numbering, captions: s.captions,
      cover: s.cover ? { title: $("#pdTitle").value || name } : null,
      meta: { title: $("#pdTitle").value || name, author: s.author, subject: $("#pdSubject").value, keywords: $("#pdKeys").value } });
    status("");
    const saved = await saveOrShare(out.blob, `${name}.pdf`, "auto");
    if(saved !== "cancelled") toast(`PDF · ${out.pages} página${out.pages === 1 ? "" : "s"} · ${(out.blob.size / 1048576).toFixed(2)} MB`, "ok");
  }catch(err){ status(""); toast("No se pudo crear el PDF: " + (err.message || err), "err"); }
}
