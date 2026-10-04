/* ═══════════════════════════════════════════════════════════════
   DETECTAR UN DOCUMENTO EN UNA FOTO (fase 8 de PENDIENTE.md)
   · detectDocument (OpenCV): el cuadrilátero más grande y más
     rectangular de la foto, por dos caminos —bordes de Canny y umbral
     de Otsu (papel claro sobre fondo oscuro, o al revés)— y el mejor
     de los dos.
   · aspectFromQuad (puro, sin DOM): proporción real ancho/alto del
     rectángulo fotografiado, deshaciendo la perspectiva con el método
     de Zhang y He (pizarras y documentos): píxeles cuadrados y punto
     principal en el centro de la foto. Con una vista casi frontal o
     datos que no cuadran, cae a la media de los lados.
   Esquinas siempre en orden: arriba-izquierda, arriba-derecha,
   abajo-derecha, abajo-izquierda.
   ═══════════════════════════════════════════════════════════════ */

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ordena 4 puntos como TL, TR, BR, BL. */
export function orderCorners(p){
  const s = p.map(q => q[0] + q[1]), df = p.map(q => q[0] - q[1]);
  const tl = p[s.indexOf(Math.min(...s))], br = p[s.indexOf(Math.max(...s))], tr = p[df.indexOf(Math.max(...df))], bl = p[df.indexOf(Math.min(...df))];
  return [tl, tr, br, bl];
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Proporción ancho/alto del rectángulo real a partir de sus 4 esquinas en la foto.
 * @param q  [TL, TR, BR, BL] en píxeles;  W,H tamaño de la foto
 * @returns { ratio, method: "zhang" | "lados" }
 */
export function aspectFromQuad(q, W, H){
  const [tl, tr, br, bl] = q;
  const edge = () => { const w = (d2(tl, tr) + d2(bl, br)) / 2, h = (d2(tl, bl) + d2(tr, br)) / 2; return { ratio: w / Math.max(1e-9, h), method: "lados" }; };
  const m1 = [tl[0], tl[1], 1], m2 = [tr[0], tr[1], 1], m3 = [bl[0], bl[1], 1], m4 = [br[0], br[1], 1], u0 = W / 2, v0 = H / 2;
  const den2 = dot(cross(m2, m4), m3), den3 = dot(cross(m3, m4), m2);
  if(Math.abs(den2) < 1e-9 || Math.abs(den3) < 1e-9) return edge();
  const k2 = dot(cross(m1, m4), m3) / den2, k3 = dot(cross(m1, m4), m2) / den3;
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 - 1], n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 - 1];
  // Casi frontal (los lados opuestos casi paralelos): n2z, n3z ≈ 0 y la focal no se puede deducir
  if(Math.abs(n2[2]) < 1e-3 || Math.abs(n3[2]) < 1e-3) return edge();
  const a = [n2[0] - u0 * n2[2], n2[1] - v0 * n2[2]], b = [n3[0] - u0 * n3[2], n3[1] - v0 * n3[2]];
  let f2 = -(a[0] * b[0] + a[1] * b[1]) / (n2[2] * n3[2]);
  if(!(f2 > 0) || !Number.isFinite(f2)) return edge();
  // Una focal fuera de lo plausible (0,4–4 veces el lado mayor) viene de esquinas poco precisas:
  // se usa una focal típica de móvil (≈ el lado mayor) en vez de fiarse de ella
  const fmax = Math.max(W, H);
  if(f2 < (0.4 * fmax) ** 2 || f2 > (4 * fmax) ** 2) f2 = fmax * fmax;
  const num = (a[0] * a[0] + a[1] * a[1]) / f2 + n2[2] * n2[2], dn = (b[0] * b[0] + b[1] * b[1]) / f2 + n3[2] * n3[2];
  const r = Math.sqrt(num / dn);
  if(!Number.isFinite(r) || r < 0.2 || r > 5) return edge();
  return { ratio: r, method: "zhang" };
}

/** Tamaño de salida: conserva la resolución del lado mayor de la foto y aplica la proporción. */
export function outputSize(q, ratio, maxSide){
  const w0 = Math.max(d2(q[0], q[1]), d2(q[3], q[2])), h0 = Math.max(d2(q[0], q[3]), d2(q[1], q[2]));
  let w, h;
  if(w0 / h0 >= ratio){ w = w0; h = w0 / ratio; } else { h = h0; w = h0 * ratio; }
  const s = Math.min(1, maxSide / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/**
 * @param cv      OpenCV
 * @param source  canvas con la foto
 * @returns { quad: [TL,TR,BR,BL] en px de `source`, score } o null
 */
export function detectDocument(cv, source){
  const k = Math.min(1, 900 / Math.max(source.width, source.height)), w = Math.round(source.width * k), h = Math.round(source.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingQuality = "high"; x.drawImage(source, 0, 0, w, h);
  const rgba = cv.matFromImageData(x.getImageData(0, 0, w, h)), gray = new cv.Mat(), blur = new cv.Mat();
  const garbage = [rgba, gray, blur];
  const cands = [];
  const scan = bin => {
    const contours = new cv.MatVector(), hier = new cv.Mat(); garbage.push(contours, hier);
    cv.findContours(bin, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for(let i = 0; i < contours.size(); i++){
      const cnt = contours.get(i), area = cv.contourArea(cnt);
      if(area < 0.12 * w * h || area > 0.985 * w * h){ cnt.delete(); continue; }
      const hull = new cv.Mat(); cv.convexHull(cnt, hull, false, true);
      const peri = cv.arcLength(hull, true);
      for(const eps of [0.02, 0.035, 0.05]){
        const ap = new cv.Mat(); cv.approxPolyDP(hull, ap, eps * peri, true);
        if(ap.rows === 4 && cv.isContourConvex(ap)){
          const pts = []; for(let j = 0; j < 4; j++) pts.push([ap.data32S[j * 2], ap.data32S[j * 2 + 1]]);
          const q = orderCorners(pts), qa = Math.abs((q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[3][0] - q[0][0]) * (q[1][1] - q[0][1])) / 2 + Math.abs((q[1][0] - q[2][0]) * (q[3][1] - q[2][1]) - (q[3][0] - q[2][0]) * (q[1][1] - q[2][1])) / 2;
          // Rectangularidad: ángulos cerca de 90° puntúan más (con perspectiva se admiten desvíos)
          let dev = 0; for(let j = 0; j < 4; j++){ const a = q[j], b = q[(j + 1) % 4], d = q[(j + 3) % 4], v1 = [b[0] - a[0], b[1] - a[1]], v2 = [d[0] - a[0], d[1] - a[1]]; dev += Math.abs(Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) + 1e-9)) - Math.PI / 2); }
          cands.push({ quad: q, score: (qa / (w * h)) * Math.max(0.2, 1 - dev / 3) });
          ap.delete(); break;
        }
        ap.delete();
      }
      hull.delete(); cnt.delete();
    }
  };
  try{
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(7, 7), 0);
    // Camino 1: bordes (cerrados para unir huecos)
    const edges = new cv.Mat(), kern = cv.Mat.ones(3, 3, cv.CV_8U); garbage.push(edges, kern);
    cv.Canny(blur, edges, 30, 100); cv.dilate(edges, edges, kern, new cv.Point(-1, -1), 2); scan(edges);
    // Camino 2: Otsu (papel claro) y su inverso (papel oscuro sobre fondo claro)
    for(const inv of [false, true]){
      const bin = new cv.Mat(); garbage.push(bin);
      cv.threshold(blur, bin, 0, 255, (inv ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY) + cv.THRESH_OTSU);
      cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kern, new cv.Point(-1, -1), 3);
      scan(bin);
    }
  }finally{ for(const g of garbage) try{ g.delete(); }catch{} }
  if(!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  return { quad: best.quad.map(p => [p[0] / k, p[1] / k]), score: best.score };
}
