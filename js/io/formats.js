/* ═══════════════════════════════════════════════════════════════
   FORMATOS DE EXPORTACIÓN QUE EL NAVEGADOR NO GENERA SOLO
     · AVIF: codificador de Squoosh en WebAssembly (js/vendor/avif),
       cargado sólo cuando se usa, desde el gestor de códecs (codecs.js).
     · GIF animado: gifenc (js/vendor/gifenc), paleta por fotograma.
     · PDF: escrito a mano, una imagen JPEG por página (DCTDecode), con
       tamaño de página y margen.
   ═══════════════════════════════════════════════════════════════ */

/** Lienzo → Blob AVIF. `quality` 0-1 (1 = sin pérdidas). `space`: espacio de
    los píxeles del lienzo ("srgb" o "display-p3"), que también se escribe en
    la etiqueta de color del archivo. El códec lo carga js/io/codecs.js. */
export async function avifFromCanvas(canvas, quality = .6, space = "srgb"){
  const { width, height } = canvas;
  // Los píxeles, en el espacio pedido (un lienzo P3 convierte a sRGB al leer si se pide sRGB)
  const data = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height, { colorSpace: space }).data;
  const { encodeAvif8 } = await import("./codecs.js");
  return encodeAvif8(data, width, height, { quality: Math.round(quality * 100), space });
}

/* ── PDF ─────────────────────────────────────────────────────── */
export const PAGE_SIZES = {
  image: null,                       // la página mide lo que la imagen
  a4: [595.28, 841.89], a3: [841.89, 1190.55], a5: [419.53, 595.28],
  letter: [612, 792], legal: [612, 1008], photo10x15: [283.46, 425.2]
};
const jpegBytes = (canvas, q) => new Promise((res, rej) => canvas.toBlob(async b => b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error("JPEG")), "image/jpeg", q));

/** Lienzos → PDF (una página por lienzo). opts: { page, orientation
    ("auto"|"portrait"|"landscape"), margin (pt), quality 0-1, dpi } */
export async function pdfFromCanvases(canvases, { page = "image", orientation = "auto", margin = 0, quality = .9, dpi = 150 } = {}){
  const objs = [];                    // contenido de cada objeto (Uint8Array o string)
  const enc = new TextEncoder();
  const add = content => { objs.push(content); return objs.length; };
  const catalog = add(null), pages = add(null), kids = [];
  for(const cv of canvases){
    // Imagen sobre fondo blanco (el JPEG no tiene alfa)
    const flat = document.createElement("canvas"); flat.width = cv.width; flat.height = cv.height;
    // PDF guarda el JPEG como RGB sin perfil: siempre en sRGB
    const fx = flat.getContext("2d", { colorSpace: "srgb", forceSrgb: true }); fx.fillStyle = "#fff"; fx.fillRect(0, 0, cv.width, cv.height); fx.drawImage(cv, 0, 0);
    const jpg = await jpegBytes(flat, quality);
    let pw, ph;
    if(PAGE_SIZES[page]){
      [pw, ph] = PAGE_SIZES[page];
      const land = orientation === "landscape" || (orientation === "auto" && cv.width > cv.height);
      if(land) [pw, ph] = [ph, pw];
    } else { pw = cv.width * 72 / dpi + margin * 2; ph = cv.height * 72 / dpi + margin * 2; }
    const aw = pw - margin * 2, ah = ph - margin * 2, k = Math.min(aw / cv.width, ah / cv.height);
    const iw = cv.width * k, ih = cv.height * k, ix = (pw - iw) / 2, iy = (ph - ih) / 2;
    const img = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, stream: jpg });
    const draw = enc.encode(`q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${ix.toFixed(2)} ${iy.toFixed(2)} cm /Im0 Do Q`);
    const content = add({ dict: `<< /Length ${draw.length} >>`, stream: draw });
    const pg = add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`);
    kids.push(pg);
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const parts = [enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")], offsets = [];
  let pos = parts[0].length;
  const push = u8 => { parts.push(u8); pos += u8.length; };
  objs.forEach((o, i) => {
    offsets.push(pos);
    if(typeof o === "string") push(enc.encode(`${i + 1} 0 obj\n${o}\nendobj\n`));
    else { push(enc.encode(`${i + 1} 0 obj\n${o.dict}\nstream\n`)); push(o.stream); push(enc.encode("\nendstream\nendobj\n")); }
  });
  const xref = pos;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for(const off of offsets) x += String(off).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(enc.encode(x));
  return new Blob(parts, { type: "application/pdf" });
}

/* ── GIF animado ─────────────────────────────────────────────── */
/** frames: lienzos del mismo tamaño; delay en ms (por fotograma o
    número); loop: 0 = infinito, -1 = una vez. */
export async function gifFromCanvases(frames, { delay = 500, loop = 0, colors = 256, onProgress } = {}){
  const { GIFEncoder, quantize, applyPalette } = await import("../vendor/gifenc/gifenc.esm.js");
  const gif = GIFEncoder();
  const { width, height } = frames[0];
  for(let i = 0; i < frames.length; i++){
    const data = frames[i].getContext("2d", { willReadFrequently: true }).getImageData(0, 0, width, height, { colorSpace: "srgb" }).data;
    const hasAlpha = data.some((v, j) => j % 4 === 3 && v < 128);
    const palette = quantize(data, colors, { format: hasAlpha ? "rgba4444" : "rgb565", oneBitAlpha: hasAlpha });
    const index = applyPalette(data, palette, hasAlpha ? "rgba4444" : "rgb565");
    const ti = hasAlpha ? palette.findIndex(c => c[3] === 0) : -1;
    gif.writeFrame(index, width, height, {
      palette, delay: Array.isArray(delay) ? delay[i] : delay, repeat: loop,
      transparent: ti >= 0, transparentIndex: Math.max(0, ti), dispose: ti >= 0 ? 2 : -1
    });
    onProgress?.((i + 1) / frames.length);
    await new Promise(r => setTimeout(r, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
