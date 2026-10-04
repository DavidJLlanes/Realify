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
  const { cv } = lib, Q = await import("../cv/docquad.js"), { docSizeLimit } = await import("../core/device.js");
  open = true;
  status("Buscando el documento…"); await new Promise(r => setTimeout(r, 30));
  let found = null; try{ found = Q.detectDocument(cv, src); }catch(e){ console.error(e); } status("");

  const W = src.width, H = src.height, small = scaled(src, 1400), k = small.width / W;
  let quad = found ? found.quad : [[W * 0.1, H * 0.1], [W * 0.9, H * 0.1], [W * 0.9, H * 0.9], [W * 0.1, H * 0.9]];
  const S = { ratio: "auto", view: "photo" };
  const ratioNow = () => FIXED[S.ratio] ?? Q.aspectFromQuad(quad, W, H).ratio;

  const view = document.createElement("canvas"), vx = view.getContext("2d");
  let busy = 0;
  const render = () => {
    const id = ++busy;
    requestAnimationFrame(() => {
      if(id !== busy || sh.closed) return;
      if(S.view === "result"){
        const qs = quad.map(p => [p[0] * k, p[1] * k]), [ow, oh] = Q.outputSize(qs, ratioNow(), 1100);
        const r = rectify(cv, small, qs, ow, oh); view.width = ow; view.height = oh; vx.drawImage(r, 0, 0);
      } else { view.width = small.width; view.height = small.height; vx.drawImage(small, 0, 0); }
      sh.setView(view, false);
      sh.redraw();
    });
  };

  const close = () => { open = false; sh.close(); };
  const { sh, mountControls } = await openShell({
    title: "Escanear documento", subtitle: found ? "Premium 👑 · arrastra las esquinas si hace falta" : "Premium 👑 · no he encontrado el documento: coloca las esquinas",
    applyLabel: "Escanear", onCancel: close,
    onApply: async () => {
      sh.setBusy("Enderezando a resolución completa…"); await new Promise(r => setTimeout(r, 30));
      try{
        const [lim] = [docSizeLimit(1e5, 1e5)[0]];
        const [ow, oh] = Q.outputSize(quad, ratioNow(), lim), out = rectify(cv, src, quad, ow, oh);
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
  mountControls(sh, {
    sections: [{ id: "d", label: "Documento", props: [
      { key: "ratio", label: "Proporción", type: "select", options: RATIOS },
      { key: "view", label: "Ver", type: "seg", options: [["photo", "Foto"], ["result", "Resultado"]] }
    ] }],
    get: key => S[key], set: (key, v) => { S[key] = v; render(); }
  });
  render();
}
