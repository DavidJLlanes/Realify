/* ═══════════════════════════════════════════════════════════════
   ALINEACIÓN SUBPÍXEL DE FOTOS (fase 7 de PENDIENTE.md)
   Alinea varias tomas de la misma escena con la primera (o la que se
   elija) aunque se hayan hecho a pulso:

     1. Puntos clave ORB + emparejado por razón de distancias y
        homografía robusta (RANSAC): da el movimiento grueso, con giro,
        escala y perspectiva.
     2. Afinado ECC (máxima correlación mejorada) con movimiento
        homográfico: lleva el error a una fracción de píxel.
     3. Opcional, flujo óptico denso (Farnebäck) sobre lo ya alineado:
        corrige el movimiento que una homografía no explica (paralaje,
        gente que se mueve poco, respiración de enfoque).

   La imagen se resamplea UNA sola vez (homografía y flujo juntos en un
   único remap, Lanczos); si la homografía es casi la identidad (trípode)
   no se toca ni un píxel, así que no se pierde nitidez.
   Las matrices H son 3×3 (array de 9, por filas) y llevan un punto de la
   foto a su sitio en la referencia, a resolución completa.
   ═══════════════════════════════════════════════════════════════ */

/* ── Matrices 3×3 ────────────────────────────────────────────── */
export const mmul = (a, b) => { const o = new Array(9); for(let i = 0; i < 3; i++) for(let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
export function minv(m){
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if(Math.abs(det) < 1e-14) return null;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}
export const apply = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
export const scaleH = (H, s) => mmul(mmul([1 / s, 0, 0, 0, 1 / s, 0, 0, 0, 1], H), [s, 0, 0, 0, s, 0, 0, 0, 1]);   // H calculada a escala s → resolución completa

/** Desplazamiento máximo (px) que una H produce en las esquinas: sirve
    para decidir si hay que resamplear o basta con copiar. */
export function maxCornerShift(H, w, h){
  let m = 0;
  for(const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]]){ const [u, v] = apply(H, x, y); m = Math.max(m, Math.hypot(u - x, v - y)); }
  return m;
}

/* ── Utilidades de OpenCV ────────────────────────────────────── */
const SIDE = { feat: 1600, ecc: 900, flow: 640 };

function grayMat(cv, canvas, side){
  const s = Math.min(1, side / Math.max(canvas.width, canvas.height)), w = Math.max(8, Math.round(canvas.width * s)), h = Math.max(8, Math.round(canvas.height * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(canvas, 0, 0, w, h);
  const rgba = cv.matFromImageData(x.getImageData(0, 0, w, h)), g = new cv.Mat();
  cv.cvtColor(rgba, g, cv.COLOR_RGBA2GRAY); rgba.delete();
  return { g, s: w / canvas.width };
}

const matFrom3x3 = (cv, H) => cv.matFromArray(3, 3, cv.CV_32F, H);
const arrOf = m => Array.from(m.data64F && m.data64F.length ? m.data64F : m.data32F);

/** Homografía robusta con puntos ORB (imagen → referencia), o null. */
function featureHomography(cv, ref, img){
  const orb = new cv.ORB(5000), mask = new cv.Mat();
  const k1 = new cv.KeyPointVector(), k2 = new cv.KeyPointVector(), d1 = new cv.Mat(), d2 = new cv.Mat();
  const bf = new cv.BFMatcher(cv.NORM_HAMMING, false), knn = new cv.DMatchVectorVector();
  const del = [orb, mask, k1, k2, d1, d2, bf, knn];
  try{
    orb.detectAndCompute(img, mask, k1, d1);
    orb.detectAndCompute(ref, mask, k2, d2);
    if(k1.size() < 12 || k2.size() < 12) return null;
    bf.knnMatch(d1, d2, knn, 2);
    const A = [], B = [];
    for(let i = 0; i < knn.size(); i++){
      const m = knn.get(i); if(m.size() < 2) continue;
      const a = m.get(0), b = m.get(1);
      if(a.distance < 0.75 * b.distance){
        const p = k1.get(a.queryIdx).pt, q = k2.get(a.trainIdx).pt;
        A.push(p.x, p.y); B.push(q.x, q.y);
      }
    }
    const n = A.length / 2; if(n < 12) return null;
    const src = cv.matFromArray(n, 1, cv.CV_32FC2, A), dst = cv.matFromArray(n, 1, cv.CV_32FC2, B), inl = new cv.Mat();
    del.push(src, dst, inl);
    const Hm = cv.findHomography(src, dst, cv.RANSAC, 3, inl); del.push(Hm);
    if(!Hm || Hm.empty()) return null;
    let k = 0; for(let i = 0; i < inl.rows; i++) if(inl.data[i]) k++;
    return { H: arrOf(Hm), inliers: k, matches: n };
  }catch(e){ return null; }
  finally{ for(const o of del) try{ o.delete(); }catch{} }
}

/** Afinado ECC: devuelve la corrección W (referencia → imagen ya alineada) y la correlación. */
function eccRefine(cv, ref, aligned){
  const W = cv.Mat.eye(3, 3, cv.CV_32F), crit = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, 80, 1e-6), mask = new cv.Mat();
  try{
    const cc = cv.findTransformECC(ref, aligned, W, cv.MOTION_HOMOGRAPHY, crit, mask, 5);
    return { W: Array.from(W.data32F), cc };
  }catch(e){ return null; }
  finally{ W.delete(); mask.delete(); }
}

/** Homografía robusta entre dos fotos que sólo se solapan en parte (panorámicas): lleva un punto de `img` a su sitio en `ref`, a resolución completa
    de cada una (pueden medir distinto). Devuelve { H, inliers } o null si no hay puntos suficientes en común. */
export function pairHomography(cv, ref, img, { minInliers = 18 } = {}){
  const r = grayMat(cv, ref, SIDE.feat), i = grayMat(cv, img, SIDE.feat);
  try{
    const fh = featureHomography(cv, r.g, i.g);
    if(!fh || fh.inliers < minInliers) return null;
    // H va de la escala de `img` a la de `ref`: ref⁻¹ · H · img
    const H = mmul(mmul([1 / r.s, 0, 0, 0, 1 / r.s, 0, 0, 0, 1], fh.H), [i.s, 0, 0, 0, i.s, 0, 0, 0, 1]);
    return { H, inliers: fh.inliers, matches: fh.matches };
  } finally { r.g.delete(); i.g.delete(); }
}

/** Compone la imagen en el sistema de la referencia a la escala de análisis. */
function warpSmall(cv, g, H, w, h){
  const out = new cv.Mat(), M = matFrom3x3(cv, H);
  cv.warpPerspective(g, out, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  M.delete(); return out;
}

/**
 * Alineador incremental: fija la referencia una vez y alinea las fotos de
 * una en una (así no hace falta tener todas decodificadas a la vez).
 * @param opts.flow corregir además el movimiento fino con flujo óptico
 * `align(canvas)` → { H, inliers, cc, flow?, ok } — H a resolución completa
 */
export function createAligner(cv, refCanvas, { flow = false } = {}){
  const W0 = refCanvas.width, H0 = refCanvas.height;
  const refF = grayMat(cv, refCanvas, SIDE.feat), refE = grayMat(cv, refCanvas, SIDE.ecc), refL = flow ? grayMat(cv, refCanvas, SIDE.flow) : null;
  const ID = () => [1, 0, 0, 0, 1, 0, 0, 0, 1], S = s => [s, 0, 0, 0, s, 0, 0, 0, 1], Sinv = s => [1 / s, 0, 0, 0, 1 / s, 0, 0, 0, 1];
  return {
    identity: () => ({ H: ID(), inliers: Infinity, cc: 1, ok: true }),
    async align(c){
      if(c.width !== W0 || c.height !== H0) return { H: ID(), inliers: 0, cc: 0, ok: false, why: "tamaño distinto" };
      const imgF = grayMat(cv, c, SIDE.feat), imgE = grayMat(cv, c, SIDE.ecc);
      let H = ID(), inliers = 0, ok = true, cc = 0;
      try{
        const fh = featureHomography(cv, refF.g, imgF.g);
        // Los puntos salen a la escala de ORB; H a resolución completa
        if(fh && fh.inliers >= 12){ H = scaleH(fh.H, refF.s); inliers = fh.inliers; } else ok = false;
        // ECC a su escala, sobre la imagen ya llevada con H
        const warped = warpSmall(cv, imgE.g, mmul(mmul(S(refE.s), H), Sinv(refE.s)), refE.g.cols, refE.g.rows);
        const r = eccRefine(cv, refE.g, warped);
        warped.delete();
        if(r && Number.isFinite(r.cc) && r.cc > 0.5){
          const Winv = minv(r.W);
          // W (referencia → imagen alineada, a escala ECC) → resolución completa: H_total = (S⁻¹ W⁻¹ S) · H
          if(Winv){ H = mmul(scaleH(Winv, refE.s), H); cc = r.cc; ok = true; }
        }
        const res = { H, inliers, cc, ok };
        if(flow && ok){
          // Flujo sobre lo ya alineado, a escala pequeña
          const imgL = grayMat(cv, c, SIDE.flow), al = warpSmall(cv, imgL.g, mmul(mmul(S(refL.s), H), Sinv(refL.s)), refL.g.cols, refL.g.rows), fl = new cv.Mat();
          cv.calcOpticalFlowFarneback(refL.g, al, fl, 0.5, 4, 21, 3, 7, 1.5, 0);
          res.flow = { data: new Float32Array(fl.data32F), w: fl.cols, h: fl.rows, s: refL.s };
          fl.delete(); al.delete(); imgL.g.delete();
        }
        return res;
      }finally{ imgF.g.delete(); imgE.g.delete(); }
    },
    dispose(){ refF.g.delete(); refE.g.delete(); refL?.g.delete(); }
  };
}

/** Alinea todas las `canvases` con la de índice `ref` (para pruebas y usos sencillos). */
export async function estimateAlignment(cv, canvases, { ref = 0, flow = false, onProgress = null } = {}){
  const al = createAligner(cv, canvases[ref], { flow }), out = [];
  try{
    for(let i = 0; i < canvases.length; i++){
      onProgress?.(i / canvases.length, `Alineando ${i + 1} de ${canvases.length}…`);
      await new Promise(r => setTimeout(r, 0));
      out.push(i === ref ? al.identity() : await al.align(canvases[i]));
    }
  }finally{ al.dispose(); }
  onProgress?.(1, "Alineadas");
  return out;
}

/**
 * Lleva `canvas` al sistema de la referencia (tamaño W×H) a resolución completa.
 * Devuelve { data: Uint8Array RGBA, copied } — alfa 0 donde la foto no llega.
 */
export async function warpToReference(cv, canvas, al, { onProgress = null } = {}){
  const W = canvas.width, H = canvas.height;
  const src = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H);
  const alpha = al.H && al.ok !== false;
  const near = !alpha || (maxCornerShift(al.H, W, H) < 0.02 && !al.flow);
  if(near){
    const d = new Uint8Array(src.data.buffer.slice(0)); for(let i = 3; i < d.length; i += 4) d[i] = 255;
    return { data: d, copied: true };
  }
  const srcM = cv.matFromImageData(src), Hinv = minv(al.H);
  const out = new Uint8Array(W * H * 4);
  try{
    if(!al.flow){
      const dst = new cv.Mat(), M = matFrom3x3(cv, al.H);
      // Se fuerza alfa opaco en la fuente: los bordes fuera de la foto salen con alfa 0
      cv.warpPerspective(srcM, dst, M, new cv.Size(W, H), cv.INTER_LANCZOS4, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
      out.set(dst.data); dst.delete(); M.delete();
    } else {
      // Homografía + flujo en un solo remap, por bandas para no gastar memoria
      const { data: fd, w: fw, h: fh, s } = al.flow, band = Math.max(64, Math.floor(3e6 / W));
      for(let y0 = 0; y0 < H; y0 += band){
        const rows = Math.min(band, H - y0), map = new Float32Array(W * rows * 2);
        for(let y = 0; y < rows; y++){
          const Y = y0 + y, gy = Math.min(fh - 1, Math.max(0, Y * s - 0.5)), yy0 = gy | 0, yy1 = Math.min(fh - 1, yy0 + 1), ty = gy - yy0;
          for(let x = 0; x < W; x++){
            const gx = Math.min(fw - 1, Math.max(0, x * s - 0.5)), xx0 = gx | 0, xx1 = Math.min(fw - 1, xx0 + 1), tx = gx - xx0;
            const i00 = (yy0 * fw + xx0) * 2, i10 = (yy0 * fw + xx1) * 2, i01 = (yy1 * fw + xx0) * 2, i11 = (yy1 * fw + xx1) * 2;
            const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
            // El flujo se midió en escala de análisis: pasar a píxeles completos
            const px = x + (fd[i00] * w00 + fd[i10] * w10 + fd[i01] * w01 + fd[i11] * w11) / s, py = Y + (fd[i00 + 1] * w00 + fd[i10 + 1] * w10 + fd[i01 + 1] * w01 + fd[i11 + 1] * w11) / s;
            const w = Hinv[6] * px + Hinv[7] * py + Hinv[8], o = (y * W + x) * 2;
            map[o] = (Hinv[0] * px + Hinv[1] * py + Hinv[2]) / w; map[o + 1] = (Hinv[3] * px + Hinv[4] * py + Hinv[5]) / w;
          }
        }
        const mm = new cv.Mat(rows, W, cv.CV_32FC2), dst = new cv.Mat(); mm.data32F.set(map);
        cv.remap(srcM, dst, mm, new cv.Mat(), cv.INTER_LANCZOS4, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 0));
        out.set(dst.data, y0 * W * 4); dst.delete(); mm.delete();
        onProgress?.((y0 + rows) / H); await new Promise(r => setTimeout(r, 0));
      }
    }
  }finally{ srcM.delete(); }
  return { data: out, copied: false };
}
