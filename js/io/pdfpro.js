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

/* fontkit (MIT, @pdf-lib/fontkit 1.1.1): sólo se carga cuando se pide una fuente propia */
let fkLoading = null;
export function loadFontkit(){
  if(globalThis.fontkit) return Promise.resolve(globalThis.fontkit);
  if(fkLoading) return fkLoading;
  fkLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../vendor/pdf-lib/fontkit.umd.min.js", import.meta.url).href;
    s.onload = () => globalThis.fontkit ? resolve(globalThis.fontkit) : reject(new Error("fontkit no arrancó"));
    s.onerror = () => reject(new Error("No se pudo cargar el lector de fuentes"));
    document.head.appendChild(s);
  }).finally(() => { if(!globalThis.fontkit) fkLoading = null; });
  return fkLoading;
}

const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

/** Remuestrea en una sola pasada (calidad alta) a w×h, sobre fondo blanco si `flat`. */
function scaled(src, w, h, flat, background = "#fff"){
  const c = mk(w, h), x = c.getContext("2d", { colorSpace:"srgb" });
  if(flat){ x.fillStyle = background; x.fillRect(0, 0, c.width, c.height); }
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));

/** Texto apto para las fuentes estándar del PDF (WinAnsi): lo que no se puede escribir pasa a «?». */
export const safeText = (font, t) => {
  const set = font.getCharacterSet ? new Set(font.getCharacterSet()) : null;           // fuente propia: sólo lo que trae
  return String(t ?? "").split("").map(ch => {
    if(set) return set.has(ch.codePointAt(0)) || ch === " " ? ch : "?";
    try{ font.encodeText(ch); return ch; }catch{ return "?"; }
  }).join("");
};

/** RGB(A) del lienzo → CMYK de 8 bits (DeviceCMYK) sobre `background`: conversión matemática SIN perfil de color (K = 1 − máx(R,G,B)); aproximada, no sustituye al perfil de la imprenta. */
export function rgbaToCmyk(rgba, background = [255, 255, 255]){
  const n = rgba.length >> 2, out = new Uint8Array(n * 4);
  for(let i = 0, o = 0; i < n; i++, o += 4){
    const a = rgba[i * 4 + 3] / 255;
    const r = (rgba[i * 4] * a + background[0] * (1 - a)) / 255, g = (rgba[i * 4 + 1] * a + background[1] * (1 - a)) / 255, b = (rgba[i * 4 + 2] * a + background[2] * (1 - a)) / 255;
    const k = 1 - Math.max(r, g, b), d = 1 - k || 1;
    out[o] = Math.round((1 - r - k) / d * 255); out[o + 1] = Math.round((1 - g - k) / d * 255); out[o + 2] = Math.round((1 - b - k) / d * 255); out[o + 3] = Math.round(k * 255);
  }
  return out;
}
const hexToRgb = h => { const t = String(h || "#ffffff").replace("#", ""), n = parseInt(t.length === 3 ? t.split("").map(c => c + c).join("") : t, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Condiciones de impresión registradas (ICC) que se declaran en la intención de salida de un PDF/X. */
export const PDFX_CONDITIONS = { FOGRA39: "Coated FOGRA39 (ISO 12647-2:2004)", "CGATS TR 001": "U.S. Web Coated (SWOP) v2", FOGRA29: "Coated FOGRA29 (ISO 12647-2:2004)" };

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
  const opt = { page:"a4", orientation:"auto", perPage:1, marginMm:10, bleedMm:0, gapMm:4, dpi:300, quality:.92, lossless:false, background:"#ffffff", cropMarks:false, font:null, pdfx:null, ...o };
  const pdf = await PDFDocument.create();
  /* Fuente propia (TTF/OTF, con fontkit): se incrusta con subconjunto y sirve para portada, numeración y nombres. PDF/X exige fuentes incrustadas:
     sin fuente propia no hay Helvetica estándar y esos textos se omiten. */
  let font = null, bold = null, textOK = true;
  if(opt.font){
    pdf.registerFontkit(await loadFontkit());
    font = bold = await pdf.embedFont(opt.font, { subset:true });
  } else if(opt.pdfx){ textOK = false; }
  else { font = await pdf.embedFont(StandardFonts.Helvetica); bold = await pdf.embedFont(StandardFonts.HelveticaBold); }
  const margin = opt.marginMm * MM, bleed = opt.bleedMm * MM, gap = opt.gapMm * MM;
  /* Marcas de recorte: el papel crece `slug` por cada lado fuera del sangrado, y en esa franja se dibujan las marcas. `off` = distancia del papel al recorte. */
  const slug = opt.cropMarks ? 7 * MM + bleed : 0, off = bleed + slug, bg = hexToRgb(opt.background);
  const K = opt.pdfx ? PDFLib.cmyk(0, 0, 0, 1) : rgb(0, 0, 0);
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
    const p = pdf.addPage([tw + off * 2, th + off * 2]);
    if(bleed > 0 || slug > 0 || opt.pdfx){ p.setBleedBox(slug, slug, tw + bleed * 2, th + bleed * 2); p.setTrimBox(off, off, tw, th); }
    if(slug > 0){                                     // marcas de recorte en las cuatro esquinas, fuera del sangrado
      const gapM = bleed + 1.5 * MM, len = 5 * MM, w = .25;
      for(const [cx, cy, sx, sy] of [[off, off, -1, -1], [off + tw, off, 1, -1], [off, off + th, -1, 1], [off + tw, off + th, 1, 1]]){
        p.drawLine({ start:{ x:cx + sx * gapM, y:cy }, end:{ x:cx + sx * (gapM + len), y:cy }, thickness:w, color:K });
        p.drawLine({ start:{ x:cx, y:cy + sy * gapM }, end:{ x:cx, y:cy + sy * (gapM + len) }, thickness:w, color:K });
      }
    }
    return p;
  };
  const stamp = (p, [tw, th], n, total) => {
    if(!opt.numbering || !textOK) return;
    const t = `${n} / ${total}`, sz = 9;
    p.drawText(t, { x:off + tw / 2 - font.widthOfTextAtSize(t, sz) / 2, y:off + Math.min(margin / 2, 14) - sz / 3 + (margin < 8 * MM ? 4 * MM : 0), size:sz, font, color:opt.pdfx ? PDFLib.cmyk(0, 0, 0, .65) : rgb(.35, .35, .35) });
  };
  const pagesCount = (opt.cover ? 1 : 0) + Math.ceil(images.length / opt.perPage);
  let pageNo = 0;

  if(opt.cover && textOK){                            // portada
    const d = freeSize ? (() => { const f = pageDims(images[0]); return f; })() : pageDims({ w:1, h:1.4 });
    const p = newPage(d); pageNo++;
    const t = safeText(bold, opt.cover.title || "Sin título"), sub = safeText(font, opt.cover.subtitle || "");
    let sz = 34; while(sz > 12 && bold.widthOfTextAtSize(t, sz) > d[0] - margin * 2 - 20) sz -= 2;
    p.drawText(t, { x:off + d[0] / 2 - bold.widthOfTextAtSize(t, sz) / 2, y:off + d[1] * .58, size:sz, font:bold, color:opt.pdfx ? PDFLib.cmyk(0, 0, 0, .9) : rgb(.1, .1, .1) });
    if(sub) p.drawText(sub, { x:off + d[0] / 2 - font.widthOfTextAtSize(sub, 14) / 2, y:off + d[1] * .58 - 30, size:14, font, color:opt.pdfx ? PDFLib.cmyk(0, 0, 0, .7) : rgb(.3, .3, .3) });
    const date = new Date().toLocaleDateString("es-ES", { year:"numeric", month:"long", day:"numeric" });
    p.drawText(date, { x:off + d[0] / 2 - font.widthOfTextAtSize(date, 10) / 2, y:off + 40, size:10, font, color:opt.pdfx ? PDFLib.cmyk(0, 0, 0, .55) : rgb(.45, .45, .45) });
    stamp(p, d, pageNo, pagesCount);
  }

  let embedded = 0;
  // perfil ICC de la imprenta (opcional): las imágenes se convierten con su tabla B2A y el perfil se incrusta como intención de salida
  const iccConv = opt.pdfx && opt.pdfx.icc ? (await import("./icccmyk.js")).cmykConverter(opt.pdfx.icc) : null;
  /* PDF/X: la imagen se guarda como DeviceCMYK (Flate) en vez de JPEG RGB. Devuelve algo que `drawImg` sabe colocar. */
  const cmykImage = c => {
    const rgba = c.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, c.width, c.height, { colorSpace:"srgb" }).data;
    const stream = pdf.context.flateStream(iccConv ? iccConv.apply(rgba, bg) : rgbaToCmyk(rgba, bg), { Type:"XObject", Subtype:"Image", Width:c.width, Height:c.height, ColorSpace:"DeviceCMYK", BitsPerComponent:8 });
    return { cmykRef:pdf.context.register(stream) };
  };
  const drawImg = (p, e, x, y, width, height) => {
    if(!e.cmykRef) return p.drawImage(e, { x, y, width, height });
    const name = p.node.newXObject("Im", e.cmykRef), { pushGraphicsState, concatTransformationMatrix, drawObject, popGraphicsState } = PDFLib;
    p.pushOperators(pushGraphicsState(), concatTransformationMatrix(width, 0, 0, height, x, y), drawObject(name), popGraphicsState());
  };
  const embed = async (img, pw, ph) => {              // pw, ph: tamaño en pt con que se verá
    const w = img.canvas?.width ?? img.w, h = img.canvas?.height ?? img.h;
    const needW = Math.max(1, Math.round(pw / 72 * opt.dpi)), needH = Math.max(1, Math.round(ph / 72 * opt.dpi));
    const shrink = needW < w * .98 || needH < h * .98;
    if(img.jpeg && !shrink && !opt.pdfx) return pdf.embedJpg(img.jpeg);         // sin volver a codificar (en PDF/X siempre a CMYK)
    const src = img.canvas || await createImageBitmap(new Blob([img.jpeg], { type:"image/jpeg" }));
    if(opt.pdfx) return cmykImage(scaled(src, shrink ? needW : w, shrink ? needH : h, true, opt.background));
    const c = shrink ? scaled(src, needW, needH, !opt.lossless, opt.background) : (opt.lossless ? src : scaled(src, w, h, true, opt.background));
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
      let cx = off + margin + (k % cols) * (cw + gap), cy = off + margin + (rows - 1 - Math.floor(k / cols)) * (ch + gap), bw = cw, bh = ch;
      const cap = opt.captions && opt.perPage > 1 ? 12 : 0;
      bh -= cap;
      let iw, ih;
      if(freeSize && margin === 0 && bleed > 0){ iw = tw + bleed * 2; ih = th + bleed * 2; cx = slug; cy = slug; }   // el sangrado se rellena con la propia imagen
      else { const s = Math.min(bw / w, bh / h); iw = w * s; ih = h * s; cx += (bw - iw) / 2; cy += cap + (bh - ih) / 2; }
      const e = await embed(img, iw, ih); embedded++;
      drawImg(p, e, cx, cy, iw, ih);
      if(cap && textOK){ const t = safeText(font, img.name || ""); let s = 8; while(s > 5 && font.widthOfTextAtSize(t, s) > bw) s -= .5;
        p.drawText(t, { x:cx + (iw - font.widthOfTextAtSize(t, s)) / 2, y:cy - 10, size:s, font, color:rgb(.3, .3, .3) }); }
      opt.onProgress?.(embedded / images.length);
    }
    stamp(p, dims, pageNo, pagesCount);
    await new Promise(r => setTimeout(r, 0));
  }

  const m = opt.meta || {};
  pdf.setTitle(m.title || opt.cover?.title || images[0].name || "Realify"); if(m.author) pdf.setAuthor(m.author); if(m.subject) pdf.setSubject(m.subject);
  if(m.keywords) pdf.setKeywords(String(m.keywords).split(/[,;]/).map(s => s.trim()).filter(Boolean));
  if(opt.xmp){                                   // paquete XMP del original (filtrado) en el catálogo, como en un PDF de Acrobat
    const { PDFName } = PDFLib, xb = new TextEncoder().encode(opt.xmp), st = pdf.context.stream(xb, { Type:"Metadata", Subtype:"XML" });
    pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(st));
  }
  pdf.setProducer("Realify"); pdf.setCreator("Realify"); pdf.setCreationDate(new Date()); pdf.setModificationDate(new Date());
  if(opt.pdfx){
    /* PDF/X-3:2002 (sin verificar con un preflight): intención de salida registrada, Trapped, GTS_PDFXVersion, ID del documento, sin flujos de objetos y cabecera 1.4 */
    const { PDFName, PDFString, PDFHexString } = PDFLib, cond = PDFX_CONDITIONS[opt.pdfx.condition] ? opt.pdfx.condition : "FOGRA39", ctx = pdf.context;
    const oi = iccConv
      ? ctx.obj({ Type:"OutputIntent", S:"GTS_PDFX", OutputConditionIdentifier:PDFString.of((iccConv.desc || "Custom").slice(0, 60)), Info:PDFString.of(iccConv.desc || "Perfil de la imprenta"),
          DestOutputProfile:ctx.register(ctx.flateStream(opt.pdfx.icc, { N:4, Alternate:"DeviceCMYK" })) })
      : ctx.obj({ Type:"OutputIntent", S:"GTS_PDFX", OutputConditionIdentifier:PDFString.of(cond), Info:PDFString.of(PDFX_CONDITIONS[cond]), RegistryName:PDFString.of("http://www.color.org") });
    pdf.catalog.set(PDFName.of("OutputIntents"), ctx.obj([oi]));
    const info = ctx.lookup(ctx.trailerInfo.Info);
    info.set(PDFName.of("GTS_PDFXVersion"), PDFString.of("PDF/X-3:2002")); info.set(PDFName.of("Trapped"), PDFName.of("False"));
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
    ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(id), PDFHexString.of(id)]);
  }
  let bytes = await pdf.save({ useObjectStreams:!opt.pdfx });
  if(opt.pdfx && bytes[5] === 0x31 && bytes[7] === 0x37) { bytes = Uint8Array.from(bytes); bytes[7] = 0x34; }          // %PDF-1.7 → %PDF-1.4
  return { blob:new Blob([bytes], { type:"application/pdf" }), pages:pdf.getPageCount(), images:embedded, pdfx:!!opt.pdfx, textSkipped:!textOK };
}
