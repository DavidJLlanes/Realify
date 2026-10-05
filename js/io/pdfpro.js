/* ═══════════════════════════════════════════════════════════════
   PDF PROFESIONAL (fase 17 de PENDIENTE.md)
   Con pdf-lib (MIT, js/vendor/pdf-lib, sin modificar, carga bajo demanda): varias páginas, A5/A4/A3/Carta/Legal o el
   tamaño de la imagen, vertical/horizontal, márgenes y sangrado (MediaBox, BleedBox y TrimBox), varias imágenes por página,
   portada, numeración, metadatos y resolución objetivo.
   «Sin recomprimir de más»: una foto JPEG que ya cabe en la resolución objetivo se incrusta tal cual (sin volver a
   codificarla); si hay que reducirla se remuestrea UNA vez, en una sola pasada de calidad alta, y se codifica una vez.
   ═══════════════════════════════════════════════════════════════ */

export const MM = 72 / 25.4;
export const PAGES = { a3: [297, 420], a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4], legal: [215.9, 355.6] };
export const PER_PAGE = [1, 2, 4, 6, 9];

let loading = null;
export function loadPdfLib(){
  if(globalThis.PDFLib) return Promise.resolve(globalThis.PDFLib);
  if(loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../vendor/pdf-lib/pdf-lib.min.js", import.meta.url).href;
    s.onload = () => globalThis.PDFLib ? resolve(globalThis.PDFLib) : reject(new Error("pdf-lib no arrancó"));
    s.onerror = () => reject(new Error("No se pudo cargar el generador de PDF"));
    document.head.appendChild(s);
  }).finally(() => { if(!globalThis.PDFLib) loading = null; });
  return loading;
}

const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

/** Remuestrea en una sola pasada (calidad alta) a w×h, sobre fondo blanco si `flat`. */
function scaled(src, w, h, flat){
  const c = mk(w, h), x = c.getContext("2d", { colorSpace:"srgb" });
  if(flat){ x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));

/** Texto apto para las fuentes estándar del PDF (WinAnsi): lo que no se puede escribir pasa a «?». */
export const safeText = (font, t) => String(t ?? "").split("").map(ch => { try{ font.encodeText(ch); return ch; }catch{ return "?"; } }).join("");

/** Casillas por página: [columnas, filas] según la orientación. */
export function gridFor(n, landscape){
  if(n === 2) return landscape ? [2, 1] : [1, 2];
  if(n === 4) return [2, 2];
  if(n === 6) return landscape ? [3, 2] : [2, 3];
  if(n === 9) return [3, 3];
  return [1, 1];
}

/**
 * images: [{ name, canvas } | { name, jpeg: Uint8Array, w, h }]
 * o: { page:"image"|"a4"…, orientation:"auto"|"portrait"|"landscape", perPage, marginMm, bleedMm, gapMm, dpi, quality 0-1,
 *      lossless, cover:{ title, subtitle }|null, numbering, captions, meta:{ title, author, subject, keywords }, onProgress }
 * Devuelve { blob, pages, images }.
 */
export async function buildPdf(images, o = {}){
  if(!images.length) throw new Error("No hay imágenes para el PDF");
  const L = await loadPdfLib(), { PDFDocument, StandardFonts, rgb } = L;
  const opt = { page:"a4", orientation:"auto", perPage:1, marginMm:10, bleedMm:0, gapMm:4, dpi:300, quality:.92, lossless:false, ...o };
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = opt.marginMm * MM, bleed = opt.bleedMm * MM, gap = opt.gapMm * MM;
  const wide = images.filter(i => (i.canvas?.width ?? i.w) > (i.canvas?.height ?? i.h)).length * 2 > images.length;
  const freeSize = opt.page === "image";
  if(freeSize && opt.perPage !== 1) throw new Error("Con «tamaño de la imagen» sólo cabe una imagen por página");
  const pageDims = img => {                           // [ancho, alto] del área final (sin sangrado), en pt
    if(freeSize){ const w = img.canvas?.width ?? img.w, h = img.canvas?.height ?? img.h; return [w * 72 / opt.dpi + margin * 2, h * 72 / opt.dpi + margin * 2]; }
    let [pw, ph] = PAGES[opt.page].map(v => v * MM);
    const land = opt.orientation === "landscape" || (opt.orientation === "auto" && (opt.perPage === 1 ? (img.canvas?.width ?? img.w) > (img.canvas?.height ?? img.h) : wide));
    return land ? [ph, pw] : [pw, ph];
  };
  const newPage = ([tw, th]) => {
    const p = pdf.addPage([tw + bleed * 2, th + bleed * 2]);
    if(bleed > 0){ p.setBleedBox(0, 0, tw + bleed * 2, th + bleed * 2); p.setTrimBox(bleed, bleed, tw, th); }
    return p;
  };
  const stamp = (p, [tw, th], n, total) => {
    if(!opt.numbering) return;
    const t = `${n} / ${total}`, sz = 9;
    p.drawText(t, { x:bleed + tw / 2 - font.widthOfTextAtSize(t, sz) / 2, y:bleed + Math.min(margin / 2, 14) - sz / 3 + (margin < 8 * MM ? 4 * MM : 0), size:sz, font, color:rgb(.35, .35, .35) });
  };
  const pagesCount = (opt.cover ? 1 : 0) + Math.ceil(images.length / opt.perPage);
  let pageNo = 0;

  if(opt.cover){                                      // portada
    const d = freeSize ? (() => { const f = pageDims(images[0]); return f; })() : pageDims({ w:1, h:1.4 });
    const p = newPage(d); pageNo++;
    const t = safeText(bold, opt.cover.title || "Sin título"), sub = safeText(font, opt.cover.subtitle || "");
    let sz = 34; while(sz > 12 && bold.widthOfTextAtSize(t, sz) > d[0] - margin * 2 - 20) sz -= 2;
    p.drawText(t, { x:bleed + d[0] / 2 - bold.widthOfTextAtSize(t, sz) / 2, y:bleed + d[1] * .58, size:sz, font:bold, color:rgb(.1, .1, .1) });
    if(sub) p.drawText(sub, { x:bleed + d[0] / 2 - font.widthOfTextAtSize(sub, 14) / 2, y:bleed + d[1] * .58 - 30, size:14, font, color:rgb(.3, .3, .3) });
    const date = new Date().toLocaleDateString("es-ES", { year:"numeric", month:"long", day:"numeric" });
    p.drawText(date, { x:bleed + d[0] / 2 - font.widthOfTextAtSize(date, 10) / 2, y:bleed + 40, size:10, font, color:rgb(.45, .45, .45) });
    stamp(p, d, pageNo, pagesCount);
  }

  let embedded = 0;
  const embed = async (img, pw, ph) => {              // pw, ph: tamaño en pt con que se verá
    const w = img.canvas?.width ?? img.w, h = img.canvas?.height ?? img.h;
    const needW = Math.max(1, Math.round(pw / 72 * opt.dpi)), needH = Math.max(1, Math.round(ph / 72 * opt.dpi));
    const shrink = needW < w * .98 || needH < h * .98;
    if(img.jpeg && !shrink) return pdf.embedJpg(img.jpeg);                      // sin volver a codificar
    const src = img.canvas || await createImageBitmap(new Blob([img.jpeg], { type:"image/jpeg" }));
    const c = shrink ? scaled(src, needW, needH, !opt.lossless) : (opt.lossless ? src : scaled(src, w, h, true));
    if(opt.lossless) return pdf.embedPng(new Uint8Array(await (await toBlob(c, "image/png")).arrayBuffer()));
    return pdf.embedJpg(new Uint8Array(await (await toBlob(c, "image/jpeg", opt.quality)).arrayBuffer()));
  };

  for(let i = 0; i < images.length; i += opt.perPage){
    const group = images.slice(i, i + opt.perPage), dims = pageDims(group[0]), [tw, th] = dims;
    const p = newPage(dims); pageNo++;
    const [cols, rows] = gridFor(opt.perPage, tw > th);
    const aw = tw - margin * 2, ah = th - margin * 2, cw = (aw - gap * (cols - 1)) / cols, ch = (ah - gap * (rows - 1)) / rows;
    for(let k = 0; k < group.length; k++){
      const img = group[k], w = img.canvas?.width ?? img.w, h = img.canvas?.height ?? img.h;
      let cx = bleed + margin + (k % cols) * (cw + gap), cy = bleed + margin + (rows - 1 - Math.floor(k / cols)) * (ch + gap), bw = cw, bh = ch;
      const cap = opt.captions && opt.perPage > 1 ? 12 : 0;
      bh -= cap;
      let iw, ih;
      if(freeSize && margin === 0 && bleed > 0){ iw = tw + bleed * 2; ih = th + bleed * 2; cx = 0; cy = 0; }   // el sangrado se rellena con la propia imagen
      else { const s = Math.min(bw / w, bh / h); iw = w * s; ih = h * s; cx += (bw - iw) / 2; cy += cap + (bh - ih) / 2; }
      const e = await embed(img, iw, ih); embedded++;
      p.drawImage(e, { x:cx, y:cy, width:iw, height:ih });
      if(cap){ const t = safeText(font, img.name || ""); let s = 8; while(s > 5 && font.widthOfTextAtSize(t, s) > bw) s -= .5;
        p.drawText(t, { x:cx + (iw - font.widthOfTextAtSize(t, s)) / 2, y:cy - 10, size:s, font, color:rgb(.3, .3, .3) }); }
      opt.onProgress?.(embedded / images.length);
    }
    stamp(p, dims, pageNo, pagesCount);
    await new Promise(r => setTimeout(r, 0));
  }

  const m = opt.meta || {};
  pdf.setTitle(m.title || opt.cover?.title || images[0].name || "Realify"); if(m.author) pdf.setAuthor(m.author); if(m.subject) pdf.setSubject(m.subject);
  if(m.keywords) pdf.setKeywords(String(m.keywords).split(/[,;]/).map(s => s.trim()).filter(Boolean));
  pdf.setProducer("Realify"); pdf.setCreator("Realify"); pdf.setCreationDate(new Date()); pdf.setModificationDate(new Date());
  const bytes = await pdf.save({ useObjectStreams:true });
  return { blob:new Blob([bytes], { type:"application/pdf" }), pages:pdf.getPageCount(), images:embedded };
}
