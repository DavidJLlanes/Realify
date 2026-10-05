/* ═══════════════════════════════════════════════════════════════
   ESCANEAR DOCUMENTO (Premium 👑 · fase 8 de PENDIENTE.md)
   Menú Imagen › Escanear documento…

   Una foto de un papel, una pizarra, un cuadro o una pantalla se
   convierte en una imagen recta y de frente:
     1. OpenCV encuentra el cuadrilátero (js/cv/docquad.js); las cuatro
        esquinas se pueden arrastrar si hace falta afinarlas.
     2. La proporción del papel se deduce de la propia perspectiva
        (método de Zhang y He) o se fija a A4 / Carta.
     3. Se endereza con una homografía a RESOLUCIÓN COMPLETA (Lanczos),
        sin pasar por la vista previa reducida.
   El resultado se abre como una foto nueva. OpenCV (11 MB) se descarga
   sólo la primera vez, avisando antes.
   ═══════════════════════════════════════════════════════════════ */

import { toast, status } from "../ui/toast.js";
import { visibleImage, scaled, openShell } from "./depthtools.js";

let open = false;

const RATIOS = [["auto", "Automática"], ["a4", "A4 (vertical)"], ["a4h", "A4 (horizontal)"], ["letter", "Carta (vertical)"], ["letterh", "Carta (horizontal)"]];
const FIXED = { a4: 210 / 297, a4h: 297 / 210, letter: 215.9 / 279.4, letterh: 279.4 / 215.9 };

/** Aplica el acabado elegido («Aclarar el papel», escala de grises, blanco y negro) a un lienzo, en su sitio (js/cv/docclean.js). */
export async function finishCanvas(canvas, mode){
  if(!mode || mode === "none") return canvas;
  const { cleanDocument } = await import("../cv/docclean.js");
  const x = canvas.getContext("2d", { willReadFrequently: true }), img = x.getImageData(0, 0, canvas.width, canvas.height);
  cleanDocument(img.data, canvas.width, canvas.height, mode);
  x.putImageData(img, 0, 0);
  return canvas;
}

/** Una página completa a partir de una foto: busca el documento, lo endereza (proporción automática o A4/Carta) y le da el acabado. */
export async function scanPage(cv, photo, { ratio = "auto", finish = "none", maxSide = 3200 } = {}){
  const Q = await import("../cv/docquad.js"), W = photo.width, H = photo.height;
  const found = Q.detectDocument(cv, photo);
  const quad = found ? found.quad : [[0, 0], [W, 0], [W, H], [0, H]];
  const r = FIXED[ratio] ?? Q.aspectFromQuad(quad, W, H).ratio, [ow, oh] = Q.outputSize(quad, r, maxSide);
  return { canvas: await finishCanvas(rectify(cv, photo, quad, ow, oh), finish), found: !!found };
}

/** Endereza `source` (canvas) a un rectángulo outW×outH con las 4 esquinas dadas (px de `source`). */
export function rectify(cv, source, quad, outW, outH){
  const x = source.getContext("2d", { willReadFrequently: true });
  const src = cv.matFromImageData(x.getImageData(0, 0, source.width, source.height)), dst = new cv.Mat();
  const a = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flat()), b = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(a, b);
  try{
    cv.warpPerspective(src, dst, M, new cv.Size(outW, outH), cv.INTER_LANCZOS4, cv.BORDER_REPLICATE);
    const out = document.createElement("canvas"); out.width = outW; out.height = outH;
    out.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(dst.data), outW, outH), 0, 0);
    return out;
  }finally{ src.delete(); dst.delete(); a.delete(); b.delete(); M.delete(); }
}

export async function openDocScan(){
  if(open) return;
  const src = await visibleImage(); if(!src) return;
  const { loadOpenCv } = await import("../cv/opencv.js");
  const lib = await loadOpenCv(); if(!lib) return;
  const { cleanDocument, FINISHES } = await import("../cv/docclean.js");
  const { cv } = lib, Q = await import("../cv/docquad.js"), { docSizeLimit } = await import("../core/device.js");
  open = true;
  status("Buscando el documento…"); await new Promise(r => setTimeout(r, 30));
  let found = null; try{ found = Q.detectDocument(cv, src); }catch(e){ console.error(e); } status("");

  const W = src.width, H = src.height, small = scaled(src, 1400), k = small.width / W;
  let quad = found ? found.quad : [[W * 0.1, H * 0.1], [W * 0.9, H * 0.1], [W * 0.9, H * 0.9], [W * 0.1, H * 0.9]];
  const S = { ratio: "auto", view: "photo", finish: "paper", out: "photo" };
  const extra = [];                       // páginas añadidas: { name, canvas (ya enderezada y con el acabado), thumb }
  const ratioNow = () => FIXED[S.ratio] ?? Q.aspectFromQuad(quad, W, H).ratio;

  const view = document.createElement("canvas"), vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      if(S.view === "result"){
        const qs = quad.map(p => [p[0] * k, p[1] * k]), [ow, oh] = Q.outputSize(qs, ratioNow(), 1100);
        const r = rectify(cv, small, qs, ow, oh); finishSync(r, S.finish); view.width = ow; view.height = oh; vx.drawImage(r, 0, 0);
      } else { view.width = small.width; view.height = small.height; vx.drawImage(small, 0, 0); }
      sh.setView(view, false);
      sh.redraw();
    });
  };

  /* Vista previa: el acabado se aplica en el momento (la imagen es pequeña) */
  const finishSync = (canvas, mode) => { if(mode === "none") return; const x = canvas.getContext("2d", { willReadFrequently: true }), img = x.getImageData(0, 0, canvas.width, canvas.height); cleanDocument(img.data, canvas.width, canvas.height, mode); x.putImageData(img, 0, 0); };
  const close = () => { open = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Escanear documento", subtitle: found ? "Premium 👑 · arrastra las esquinas si hace falta" : "Premium 👑 · no he encontrado el documento: coloca las esquinas",
    applyLabel: "Escanear", onCancel: close,
    onApply: async () => {
      sh.setBusy("Enderezando a resolución completa…"); await new Promise(r => setTimeout(r, 30));
      try{
        const [lim] = [docSizeLimit(1e5, 1e5)[0]];
        const [ow, oh] = Q.outputSize(quad, ratioNow(), lim), out = await finishCanvas(rectify(cv, src, quad, ow, oh), S.finish);
        if(extra.length && S.out === "pdf"){
          // Varias páginas → un PDF (la primera es la foto abierta; el resto, las añadidas), una página por foto
          sh.setBusy("Creando el PDF…");
          const { buildPdf } = await import("../io/pdfpro.js"), { download } = await import("../io/export.js");
          const { blob, pages } = await buildPdf([{ canvas: out, name: "Página 1" }, ...extra.map((p, i) => ({ canvas: p.canvas, name: `Página ${i + 2}` }))], { page: "image", marginMm: 0, dpi: 200, quality: .9, lossless: S.finish === "bw", meta: { title: "Documento escaneado" } });
          download(blob, "documento-" + new Date().toISOString().slice(0, 10) + ".pdf");
          close();
          toast(`PDF de ${pages} páginas guardado`, "ok");
          return;
        }
        close();
        const { resultToLayer } = await import("../ui/fsshell.js");
        await resultToLayer(out, { name: "Documento", docName: "Documento", newDocument: true });
        toast(`Documento enderezado · ${out.width} × ${out.height}`, "ok");
      }catch(err){ console.error(err); sh.setBusy(""); toast("No se pudo enderezar: " + (err.message || err), "err"); }
    }
  });
  sh.setOriginal(null);
  sh.setOverlay((cx, t) => {
    if(S.view !== "photo") return;
    const P = quad.map(p => [t.ox + p[0] * k * t.k, t.oy + p[1] * k * t.k]);
    cx.save();
    cx.fillStyle = "rgba(0,0,0,.35)"; cx.beginPath(); cx.rect(t.ox, t.oy, small.width * t.k, small.height * t.k); cx.moveTo(P[0][0], P[0][1]);
    for(const p of [P[3], P[2], P[1]]) cx.lineTo(p[0], p[1]); cx.closePath(); cx.fill("evenodd");
    cx.strokeStyle = "#e8a33d"; cx.lineWidth = 2 * t.dpr; cx.beginPath(); P.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); cx.stroke();
    cx.fillStyle = "#fff"; cx.strokeStyle = "#e8a33d";
    for(const p of P){ cx.beginPath(); cx.arc(p[0], p[1], 9 * t.dpr, 0, 7); cx.fill(); cx.stroke(); }
    cx.restore();
  });
  let drag = -1;
  sh.setInteract((type, p) => {
    if(S.view !== "photo") return false;
    if(type === "down"){
      let best = -1, bd = 30 / p.k;                     // 30 px de pantalla
      quad.forEach((q, i) => { const d = Math.hypot(q[0] * k - p.x, q[1] * k - p.y); if(d < bd){ bd = d; best = i; } });
      drag = best; return best >= 0;
    }
    if(type === "move" && drag >= 0 && p){ quad[drag] = [Math.min(W, Math.max(0, p.x / k)), Math.min(H, Math.max(0, p.y / k))]; sh.redraw(); }
    if(type === "up" || type === "cancel") drag = -1;
    return false;
  });
  /* Más páginas: otras fotos (se detecta y endereza cada documento solo, con el mismo acabado) */
  const addPages = async () => {
    const { pickFiles, decodePhoto } = await import("../ui/fsshell.js"), files = await pickFiles({ gallery: true });
    if(!files.length) return;
    sh.setBusy("Escaneando las páginas…");
    try{
      for(let i = 0; i < files.length; i++){
        sh.setBusy(`Escaneando la página ${extra.length + 2}…`); await new Promise(r => setTimeout(r, 20));
        const photo = await decodePhoto(files[i], docSizeLimit(1e5, 1e5)[0]);
        const r = await scanPage(cv, photo, { ratio: S.ratio, finish: S.finish, maxSide: 2800 });
        const t = scaled(r.canvas, 120);
        extra.push({ name: files[i].name, canvas: r.canvas, found: r.found, thumb: t.toDataURL("image/jpeg", .7) });
        if(!r.found) toast(`En «${files[i].name}» no se encontró el documento: se ha usado la foto entera`);
      }
      S.out = "pdf"; ctl.refresh(); sh.setSubtitle(`${extra.length + 1} páginas · Premium 👑`);
    }catch(err){ toast("No se pudo escanear: " + (err.message || err), "err"); }
    finally{ sh.setBusy(""); }
  };
  const ctl = mountControls(sh, {
    sections: [{ id: "d", label: "Documento", props: [
      { key: "ratio", label: "Proporción", type: "select", options: RATIOS },
      { key: "finish", label: "Acabado", type: "select", options: FINISHES },
      { key: "view", label: "Ver", type: "seg", options: [["photo", "Foto"], ["result", "Resultado"]] }
    ] }, { id: "p", label: "Varias páginas", note: () => extra.length ? `${extra.length + 1} páginas: ${extra.map(p => p.name).join(", ")}` : "Añade más fotos para hacer un PDF de varias páginas.", props: [
      { key: "addPages", label: "Añadir páginas…", type: "button", run: () => addPages() },
      { key: "out", label: "Resultado", type: "seg", options: [["photo", "Sólo esta página"], ["pdf", "PDF de todas"]], when: () => extra.length > 0 },
      { key: "clearPages", label: "Quitar las páginas añadidas", type: "button", when: () => extra.length > 0, run: () => { extra.length = 0; S.out = "photo"; ctl.refresh(); sh.setSubtitle("Premium 👑 · arrastra las esquinas si hace falta"); } }
    ] }],
    get: key => S[key], set: (key, v) => { S[key] = v; render(); }
  });
  render();
}
