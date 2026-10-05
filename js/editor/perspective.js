/* ═══════════════════════════════════════════════════════════════
   CORRECCIÓN DE PERSPECTIVA
   El lienzo 2D sólo sabe transformar de forma afín (rota, escala,
   sesga), nunca en perspectiva de verdad. Para corregir un edificio
   que converge hacia arriba hace falta una proyectiva completa, y la
   forma de conseguirla sin WebGL es la de siempre en gráficos por
   computador desde los 80: se subdivide el destino en una malla fina
   de celdas, se calcula dónde cae cada vértice de la malla en la
   imagen de origen mediante la proyectiva exacta, y cada celda —ya
   lo bastante pequeña para que la curvatura no se note— se dibuja
   con dos triángulos afines, que el lienzo sí sabe hacer con
   drawImage y una matriz de transformación.
   ═══════════════════════════════════════════════════════════════ */

/* Mapea el cuadrado unidad [0,1]×[0,1] al cuadrilátero `quad`
   (4 puntos [x,y] en orden: arriba-izq, arriba-der, abajo-der,
   abajo-izq). Es la proyectiva clásica de Heckbert para llevar un
   cuadrado a un cuadrilátero arbitrario, y es exactamente lo que hace
   falta: la esquina que el usuario arrastra a un punto concreto tiene
   que caer justo ahí, no aproximadamente. */
export function unitSquareToQuad(quad){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = quad;

  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a13 = 0, a23 = 0;
  const denom = dx1 * dy2 - dx2 * dy1;
  if(Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9){
    if(Math.abs(denom) > 1e-9){
      a13 = (dx3 * dy2 - dx2 * dy3) / denom;
      a23 = (dx1 * dy3 - dx3 * dy1) / denom;
    }
  }
  const a11 = x1 - x0 + a13 * x1;
  const a21 = x3 - x0 + a23 * x3;
  const a31 = x0;
  const a12 = y1 - y0 + a13 * y1;
  const a22 = y3 - y0 + a23 * y3;
  const a32 = y0;

  return (u, v) => {
    const w = a13 * u + a23 * v + 1;
    return [(a11 * u + a21 * v + a31) / w, (a12 * u + a22 * v + a32) / w];
  };
}

/* La inversa de `unitSquareToQuad`: dado un punto del cuadrilátero,
   dice a qué (u,v) del cuadrado unidad corresponde.

   Hace falta para las guías. Se trazan sobre la foto que se está
   viendo, que ya está deformada por la corrección en curso, pero hay
   que guardarlas en coordenadas de la imagen ORIGINAL: si no, cada
   guía nueva cambiaría la corrección, la corrección movería las guías
   anteriores, y éstas dejarían de señalar el canto del edificio sobre
   el que se dibujaron. Guardándolas en el original, una guía se queda
   pegada a su contenido pase lo que pase con la deformación. */
export function quadToUnitSquare(quad){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = quad;

  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a13 = 0, a23 = 0;
  const denom = dx1 * dy2 - dx2 * dy1;
  if(Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9){
    if(Math.abs(denom) > 1e-9){
      a13 = (dx3 * dy2 - dx2 * dy3) / denom;
      a23 = (dx1 * dy3 - dx3 * dy1) / denom;
    }
  }
  // La misma matriz que arma unitSquareToQuad, por filas
  const M = [
    x1 - x0 + a13 * x1,  x3 - x0 + a23 * x3,  x0,
    y1 - y0 + a13 * y1,  y3 - y0 + a23 * y3,  y0,
    a13,                 a23,                 1
  ];
  const inv = invert3(M);
  if(!inv) return (x, y) => [x, y];
  return (x, y) => {
    const w = inv[6]*x + inv[7]*y + inv[8];
    const k = Math.abs(w) < 1e-12 ? 1e-12 : w;
    return [(inv[0]*x + inv[1]*y + inv[2]) / k, (inv[3]*x + inv[4]*y + inv[5]) / k];
  };
}

/* Inversa de una 3×3 por adjuntos. Devuelve null si es singular, que
   pasa en cuanto el cuadrilátero se aplasta sobre una recta. */
export function invert3(m){
  const [a,b,c, d,e,f, g,h,i] = m;
  const A =  (e*i - f*h), B = -(d*i - f*g), C =  (d*h - e*g);
  const det = a*A + b*B + c*C;
  if(Math.abs(det) < 1e-12) return null;
  return [
    A/det,            -(b*i - c*h)/det,   (b*f - c*e)/det,
    B/det,             (a*i - c*g)/det,  -(a*f - c*d)/det,
    C/det,            -(a*h - b*g)/det,   (a*e - b*d)/det
  ];
}

/* Matriz afín [a,b,c,d,e,f] (formato de ctx.transform) que lleva los
   tres puntos de `src` exactamente a los tres de `dst`. Un triángulo
   siempre admite una solución afín exacta —tres puntos determinan el
   plano por completo—, así que no hace falta resolver nada
   aproximado aquí: sólo un sistema 3×3 por Cramer. */
export function solveAffine3(src, dst){
  const [[x0,y0],[x1,y1],[x2,y2]] = src;
  const det = x0 * (y1 - y2) - y0 * (x1 - x2) + (x1 * y2 - x2 * y1);
  if(Math.abs(det) < 1e-9) return null;   // triángulo degenerado (área ~0)

  const solveFor = ([V0, V1, V2]) => [
    (V0 * (y1 - y2) - y0 * (V1 - V2) + (V1 * y2 - V2 * y1)) / det,
    (x0 * (V1 - V2) - V0 * (x1 - x2) + (x1 * V2 - x2 * V1)) / det,
    (x0 * (y1 * V2 - y2 * V1) - y0 * (x1 * V2 - x2 * V1) + V0 * (x1 * y2 - x2 * y1)) / det
  ];
  const [a, c, e] = solveFor(dst.map(p => p[0]));
  const [b, d, f] = solveFor(dst.map(p => p[1]));
  return [a, b, c, d, e, f];
}

/* Aleja cada vértice un pelín de su centroide antes de recortar. Las
   celdas vecinas comparten arista en teoría, pero el antialiasing del
   recorte deja una costura de medio píxel si se recortan al milímetro;
   solaparlas ligeramente la disimula sin tocar la transformación real
   (que sigue usando los vértices exactos). */
function overscan(tri, px){
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  return tri.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
    return [x + dx / len * px, y + dy / len * px];
  });
}

function drawTriangleAffine(ctx, image, srcTri, dstTri){
  const m = solveAffine3(srcTri, dstTri);
  if(!m) return;
  const clipTri = overscan(dstTri, 0.75);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clipTri[0][0], clipTri[0][1]);
  ctx.lineTo(clipTri[1][0], clipTri[1][1]);
  ctx.lineTo(clipTri[2][0], clipTri[2][1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(...m);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/* Dibuja en `ctx` (de tamaño outW×outH) el contenido de `image` que
   cae dentro de `quad` (en coordenadas de píxel de `image`),
   estirado para llenar el rectángulo de salida. Es la operación
   completa: para cada celda de la malla de salida se calcula su
   posición real en el origen mediante la proyectiva, y se dibuja con
   dos triángulos afines. */
export function warpQuadToCanvas(ctx, image, quad, outW, outH, cols = 28, rows = 28){
  const toSrc = unitSquareToQuad(quad);
  ctx.clearRect(0, 0, outW, outH);

  // Vértices de la malla, calculados una vez y reutilizados por las
  // celdas vecinas en vez de recalcularse en cada triángulo.
  const src = [], dst = [];
  for(let j = 0; j <= rows; j++){
    for(let i = 0; i <= cols; i++){
      const u = i / cols, v = j / rows;
      src.push(toSrc(u, v));
      dst.push([u * outW, v * outH]);
    }
  }
  const at = (i, j) => j * (cols + 1) + i;

  for(let j = 0; j < rows; j++){
    for(let i = 0; i < cols; i++){
      const s00 = src[at(i,j)],   s10 = src[at(i+1,j)];
      const s01 = src[at(i,j+1)], s11 = src[at(i+1,j+1)];
      const d00 = dst[at(i,j)],   d10 = dst[at(i+1,j)];
      const d01 = dst[at(i,j+1)], d11 = dst[at(i+1,j+1)];
      drawTriangleAffine(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangleAffine(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

/* La operación INVERSA de la anterior, y la que de verdad hace falta
   para una herramienta que se maneja con la mano.

   `warpQuadToCanvas` trata el cuadrilátero como la zona de ORIGEN que
   hay que estirar hasta llenar el rectángulo de salida. Eso es la
   convención del «recorte en perspectiva» de Photoshop: uno dibuja un
   cuadrilátero sobre lo que debería ser rectangular y al aplicar se
   endereza. Tiene sentido, pero se maneja al revés de lo que pide el
   cuerpo: arrastrar un tirador a la derecha mueve el contenido a la
   izquierda, y mientras se arrastra no pasa nada en pantalla.

   Aquí el cuadrilátero es el DESTINO: la imagen entera se estira para
   caber en él, así que la esquina que se arrastra es la esquina de la
   foto y va detrás del dedo. Es lo que hace Snapseed, y es lo que
   permite ver la deformación mientras se hace. */
export function warpRectToQuad(ctx, image, quad, outW, outH, cols = 24, rows = 24){
  const toDst = unitSquareToQuad(quad);
  ctx.clearRect(0, 0, outW, outH);

  const iw = image.width, ih = image.height;
  const src = [], dst = [];
  for(let j = 0; j <= rows; j++){
    for(let i = 0; i <= cols; i++){
      const u = i / cols, v = j / rows;
      src.push([u * iw, v * ih]);
      dst.push(toDst(u, v));
    }
  }
  const at = (i, j) => j * (cols + 1) + i;

  for(let j = 0; j < rows; j++){
    for(let i = 0; i < cols; i++){
      const s00 = src[at(i,j)],   s10 = src[at(i+1,j)];
      const s01 = src[at(i,j+1)], s11 = src[at(i+1,j+1)];
      const d00 = dst[at(i,j)],   d10 = dst[at(i+1,j)];
      const d01 = dst[at(i,j+1)], d11 = dst[at(i+1,j+1)];
      drawTriangleAffine(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangleAffine(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

/* La misma deformación que `warpRectToQuad`, pero sobre el origen de 16 bits de una capa (RGB `Uint16Array`; el alfa sale del lienzo original
   `alphaCanvas`): para cada píxel del destino se calcula con la inversa de la proyectiva dónde cae en el origen y se interpola en bilineal en coma
   flotante, con el alfa premultiplicado y el borde del cuadrilátero suavizado. Devuelve el lienzo —el redondeo de los 16 bits (core/hisrc.js)— y el
   origen nuevo, o null si es demasiado grande. */
export function warpHiToQuad(hs, alphaCanvas, quad, outW, outH, hiToCanvas8){
  const iw = hs.w, ih = hs.h;
  if(outW * outH > 24e6 || iw * ih > 24e6) return null;
  const toUV = quadToUnitSquare(quad), a8 = alphaCanvas.getContext("2d").getImageData(0, 0, iw, ih).data, src = hs.data, dither = !!hs.dither;
  const hi = new Uint16Array(outW * outH * 3), img = new ImageData(outW, outH), d = img.data;
  for(let y = 0; y < outH; y++) for(let x = 0; x < outW; x++){
    const [u, v] = toUV(x + 0.5, y + 0.5), px = u * iw, py = v * ih;
    const cov = Math.min(1, Math.max(0, Math.min(px, iw - px, py, ih - py) + 0.5));      // borde antialias: ~1 píxel de origen
    if(!(cov > 0)) continue;
    const sx = Math.min(iw - 1, Math.max(0, px - 0.5)), sy = Math.min(ih - 1, Math.max(0, py - 0.5));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(iw - 1, x0 + 1), y1 = Math.min(ih - 1, y0 + 1), fx = sx - x0, fy = sy - y0;
    let R = 0, G = 0, B = 0, A = 0;
    for(let k = 0; k < 4; k++){
      const xx = k & 1 ? x1 : x0, yy = k & 2 ? y1 : y0, w = (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy);
      if(!w) continue;
      const q = yy * iw + xx, al = a8[q * 4 + 3] * w; if(!al) continue;
      R += src[q * 3] * al; G += src[q * 3 + 1] * al; B += src[q * 3 + 2] * al; A += al;
    }
    const o = y * outW + x, al8 = Math.round(A * cov);
    if(!al8) continue;
    hi[o * 3] = Math.min(65535, Math.round(R / A)); hi[o * 3 + 1] = Math.min(65535, Math.round(G / A)); hi[o * 3 + 2] = Math.min(65535, Math.round(B / A));
    d[o * 4] = hiToCanvas8(hi[o * 3], x, y, 0, dither); d[o * 4 + 1] = hiToCanvas8(hi[o * 3 + 1], x, y, 1, dither); d[o * 4 + 2] = hiToCanvas8(hi[o * 3 + 2], x, y, 2, dither); d[o * 4 + 3] = al8;
  }
  const c = document.createElement("canvas"); c.width = outW; c.height = outH; c.getContext("2d").putImageData(img, 0, 0);
  return { canvas: c, hiSrc: { data: hi, w: outW, h: outH, dither, x: 0, y: 0, canvasW: outW, canvasH: outH } };
}

/* ═══════════════════════════════════════════════════════════════
   ENDEREZADO A PARTIR DE LÍNEAS GUÍA

   El usuario traza sobre la foto lo que SABE que está recto: el
   horizonte, el canto de un edificio, el marco de una puerta. De ahí
   se deduce la corrección, que es mucho más fiable que ajustar
   esquinas a ojo.

   La geometría es la clásica de rectificación proyectiva. Dos rectas
   que en la realidad son paralelas se cortan en la foto en un punto de
   fuga. Si se juntan el punto de fuga de las verticales y el de las
   horizontales, la recta que pasa por los dos es la «línea del
   horizonte» de ese plano, y la homografía que manda esa recta al
   infinito devuelve el paralelismo a las dos familias a la vez. Todo
   se hace en coordenadas homogéneas, donde cortar dos rectas y unir
   dos puntos son la misma operación: un producto vectorial.
   ═══════════════════════════════════════════════════════════════ */

const cross = (a, b) => [
  a[1]*b[2] - a[2]*b[1],
  a[2]*b[0] - a[0]*b[2],
  a[0]*b[1] - a[1]*b[0]
];

/* Normaliza un vector homogéneo a norma 1 y con signo estable, para
   poder promediar varios sin que se cancelen entre ellos. */
function unit(v){
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  const s = (v[0] || v[1] || v[2]) < 0 ? -1 : 1;
  return [v[0]/n*s, v[1]/n*s, v[2]/n*s];
}

/* Punto de fuga de una familia de rectas: se cortan todas con todas y
   se promedia. Con dos rectas es el corte directo; con más, promediar
   reparte el error de haber trazado las líneas con el pulso en vez de
   con tiralíneas. Las parejas casi paralelas se descartan: su corte se
   va al infinito y contamina la media. */
export function vanishingPoint(lines){
  if(!lines || lines.length < 2) return null;
  const ls = lines.map(L => cross([L.x1, L.y1, 1], [L.x2, L.y2, 1]));
  let acc = [0, 0, 0], n = 0;
  for(let i = 0; i < ls.length; i++){
    for(let j = i + 1; j < ls.length; j++){
      const p = cross(ls[i], ls[j]);
      if(Math.hypot(p[0], p[1], p[2]) < 1e-9) continue;   // rectas iguales
      const u = unit(p);
      acc = [acc[0] + u[0], acc[1] + u[1], acc[2] + u[2]];
      n++;
    }
  }
  return n ? unit(acc) : null;
}

/* Producto de dos matrices 3×3 dadas como arrays de 9. */
export function mul3(A, B){
  const C = new Array(9);
  for(let r = 0; r < 3; r++)
    for(let c = 0; c < 3; c++)
      C[r*3+c] = A[r*3]*B[c] + A[r*3+1]*B[3+c] + A[r*3+2]*B[6+c];
  return C;
}

export function applyH(H, x, y){
  const w = H[6]*x + H[7]*y + H[8];
  const k = Math.abs(w) < 1e-12 ? 1e-12 * Math.sign(w || 1) : w;
  return [(H[0]*x + H[1]*y + H[2]) / k, (H[3]*x + H[4]*y + H[5]) / k];
}

const IDENT = [1,0,0, 0,1,0, 0,0,1];

/* Homografía que endereza según las guías dadas.

   `vLines` son las que deben quedar verticales y `hLines` las que
   deben quedar horizontales, en píxeles de la imagen.

   Dos fases:
   1. Quitar la convergencia proyectiva real allí donde hay dato para
      ella —punto de fuga—, que sólo existe con dos guías o más en una
      misma familia. Con una sola familia con 2+ se corrige sólo esa;
      con las dos, el plano entero de una vez (línea del horizonte por
      los dos puntos de fuga).
   2. Fijar la orientación final con un ajuste lineal que usa TODAS las
      guías de cada familia a la vez —no sólo la primera—, cada familia
      resuelta por mínimos cuadrados contra su propia fila de la matriz.
      Con las dos familias presentes se resuelven por separado, lo que
      permite que una vertical y una horizontal trazadas a mano, casi
      pero no del todo a 90° entre sí, queden las DOS exactas en vez de
      repartir el error entre ambas. Con una sola familia no hay base
      para ese sesgo, así que el ajuste es un giro puro —la fila que
      falta es la perpendicular de la que sí se calculó. */
export function homographyFromGuides(vLines, hLines, W, H){
  const v = vLines || [], h = hLines || [];
  if(!v.length && !h.length) return IDENT.slice();

  // Trabajar centrado en el medio de la imagen y a escala 1 evita que
  // los puntos de fuga lejanos den números enormes y pierdan precisión.
  const s = 2 / Math.max(W, H);
  const toN = L => ({ x1:(L.x1 - W/2)*s, y1:(L.y1 - H/2)*s,
                      x2:(L.x2 - W/2)*s, y2:(L.y2 - H/2)*s });
  const vN = v.map(toN), hN = h.map(toN);

  const Vv = vanishingPoint(vN);
  const Vh = vanishingPoint(hN);

  let rect = IDENT.slice();

  if(Vv || Vh){
    // Recta del horizonte: por los dos puntos de fuga si hay dos; si
    // sólo hay uno, se une con la dirección al infinito de la otra
    // familia, que deja esa otra familia como estaba.
    let l = null;
    if(Vv && Vh)      l = cross(Vh, Vv);
    else if(Vv)       l = cross(Vv, [1, 0, 0]);
    else              l = cross(Vh, [0, 1, 0]);
    l = unit(l);

    // Si la recta ya está prácticamente en el infinito (l3 domina), no
    // hay convergencia que quitar y forzarlo sólo mete ruido.
    if(Math.abs(l[2]) > 1e-6 && Math.hypot(l[0], l[1]) / Math.abs(l[2]) > 1e-4){
      rect = [1, 0, 0,
              0, 1, 0,
              l[0]/l[2], l[1]/l[2], 1];
    }
  }

  // Dirección (vector unitario) de cada guía ya sin la convergencia.
  const dirAfter = L => {
    const a = applyH(rect, L.x1, L.y1), b = applyH(rect, L.x2, L.y2);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return [Math.cos(ang), Math.sin(ang)];
  };
  const vDirs = vN.map(dirAfter);
  const hDirs = hN.map(dirAfter);

  let rowV, rowH;
  if(vDirs.length && hDirs.length){
    rowV = bestPerpRow(vDirs, [1, 0]);
    rowH = bestPerpRow(hDirs, [0, 1]);
  } else if(vDirs.length){
    rowV = bestPerpRow(vDirs, [1, 0]);
    rowH = [-rowV[1], rowV[0]];
  } else {
    rowH = bestPerpRow(hDirs, [0, 1]);
    rowV = [rowH[1], -rowH[0]];
  }

  // Filas casi paralelas entre sí (guías v y h casi paralelas en el
  // trazo real, algo que no debería pasar sobre un objeto ortogonal):
  // no hay ajuste fiable con esos datos, mejor no tocar nada más.
  const det = rowV[0]*rowH[1] - rowV[1]*rowH[0];
  const M = Math.abs(det) > 1e-4
    ? [rowV[0], rowV[1], 0,  rowH[0], rowH[1], 0,  0, 0, 1]
    : IDENT.slice();

  const Hn = mul3(M, rect);

  // Volver de las coordenadas normalizadas a píxeles
  const T  = [1/s, 0, W/2,  0, 1/s, H/2,  0, 0, 1];   // normalizado → píxel
  const Ti = [s, 0, -W/2*s, 0, s, -H/2*s, 0, 0, 1];   // píxel → normalizado
  return mul3(T, mul3(Hn, Ti));
}

/* Fila de 2 componentes, de norma 1, lo más perpendicular posible a
   todas las direcciones de `dirs` a la vez —mínimos cuadrados—: hace
   que `row · d` sea lo más cercano a cero para cada `d` de la lista,
   que es justo lo que hace falta para anular la componente que le
   toca a esa familia (X para las que deben quedar verticales, Y para
   las que deben quedar horizontales). Es el autovector del autovalor
   menor de la matriz de dispersión Σ(d⊗d): con una sola dirección es
   exactamente su perpendicular —el ajuste queda exacto para esa guía—;
   con varias, el mejor compromiso conjunto. Sin ninguna dirección se
   devuelve `def` (la fila identidad) sin tocar nada. */
function bestPerpRow(dirs, def){
  if(!dirs.length) return def;
  let a = 0, b = 0, c = 0;   // matriz simétrica [[a,b],[b,c]] = Σ d⊗d
  for(const [dx, dy] of dirs){ a += dx*dx; b += dx*dy; c += dy*dy; }
  const tr = a + c, diff = a - c;
  const disc = Math.sqrt(Math.max(0, diff*diff + 4*b*b));
  const lambdaMin = (tr - disc) / 2;
  let row = Math.abs(b) > 1e-9 ? [lambdaMin - c, b]
          : (a <= c ? [1, 0] : [0, 1]);
  const len = Math.hypot(row[0], row[1]) || 1;
  row = [row[0]/len, row[1]/len];
  // El autovector tiene signo ambiguo: quedarse con el que más se
  // parezca a la fila identidad, para no voltear la imagen del revés.
  if(row[0]*def[0] + row[1]*def[1] < 0) row = [-row[0], -row[1]];
  return row;
}

/* Pasa las cuatro esquinas de la imagen por la homografía y encaja el
   resultado dentro del marco, sin deformar: escala igual en los dos
   ejes y lo centra. Sin esto, una corrección fuerte manda la foto
   fuera de la pantalla o la deja del tamaño de un sello. */
export function quadFromHomography(H, W, h){
  const pts = [[0,0],[W,0],[W,h],[0,h]].map(([x, y]) => applyH(H, x, y));
  if(pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1])))
    return [[0,0],[W,0],[W,h],[0,h]];

  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  if(!(bw > 1e-6) || !(bh > 1e-6)) return [[0,0],[W,0],[W,h],[0,h]];

  const k = Math.min(W / bw, h / bh);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return pts.map(([x, y]) => [W/2 + (x - cx) * k, h/2 + (y - cy) * k]);
}

/* Escala mínima, alrededor del centro del marco, que hace que el
   cuadrilátero cubra el marco entero: es el «rellenar» que quita las
   cuñas transparentes que deja cualquier corrección. Se busca por
   bisección porque «cubrir» no tiene fórmula cerrada cómoda con un
   cuadrilátero cualquiera. */
export function fillScaleFor(quad, W, H){
  const scaled = k => quad.map(([x, y]) => [W/2 + (x - W/2)*k, H/2 + (y - H/2)*k]);
  const covers = k => {
    const q = scaled(k);
    // El marco está cubierto si sus cuatro esquinas caen dentro del
    // cuadrilátero (que es convexo salvo que se retuerza a propósito).
    return [[0,0],[W,0],[W,H],[0,H]].every(p => inQuad(p, q));
  };
  if(covers(1)) return 1;
  let lo = 1, hi = 8;
  if(!covers(hi)) return hi;
  for(let i = 0; i < 30; i++){
    const mid = (lo + hi) / 2;
    if(covers(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

function inQuad(p, q){
  let signo = 0;
  for(let i = 0; i < 4; i++){
    const a = q[i], b = q[(i+1) % 4];
    const cr = (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
    if(Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if(signo === 0) signo = s;
    else if(s !== signo) return false;
  }
  return true;
}

/* Tamaño de salida razonable para un cuadrilátero: la media de sus
   dos anchos y sus dos altos, medidos en línea recta. Así el
   resultado no sale absurdamente estirado si el usuario traza un
   cuadrilátero muy asimétrico. */
export function quadOutputSize(quad){
  const [tl, tr, br, bl] = quad;
  const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const w = Math.round((dist(tl,tr) + dist(bl,br)) / 2);
  const h = Math.round((dist(tl,bl) + dist(tr,br)) / 2);
  return [Math.max(8, w), Math.max(8, h)];
}

/* ═══════════════════════════════════════════════════════════════
   DEFORMAR POR MALLA (herramienta Transformación libre, modo Deformar)

   Aquí el destino no es un cuadrilátero de 4 puntos sino una rejilla
   de (cols+1)×(rows+1) puntos de control que el usuario arrastra uno
   a uno — el «Warp» de Photoshop, en su versión más simple: en vez de
   una curva de Bézier entre puntos de control (lo que hace Photoshop
   de verdad), aquí la rejilla se interpola BILINEALMENTE entre
   controles vecinos y esa interpolación se subdivide otra vez en una
   malla más fina para que el resultado no se vea a facetas. Es menos
   suave que una spline cúbica, pero para doblar, curvar o drapear una
   capa —el uso real del 95 % de las veces— el resultado es limpio y
   el código es una fracción de complicado. */

/* Bilinear entre los cuatro puntos de control de la celda (gi,gj) de
   `grid` (un array de (cols+1)×(rows+1) puntos), en la posición
   fraccionaria (fu,fv) dentro de esa celda, 0..1. */
function bilerpCell(grid, gcols, gi, gj, fu, fv){
  const at = (i, j) => grid[j * (gcols + 1) + i];
  const p00 = at(gi, gj),     p10 = at(gi+1, gj);
  const p01 = at(gi, gj+1),   p11 = at(gi+1, gj+1);
  const top    = [p00[0] + (p10[0]-p00[0])*fu, p00[1] + (p10[1]-p00[1])*fu];
  const bottom = [p01[0] + (p11[0]-p01[0])*fu, p01[1] + (p11[1]-p01[1])*fu];
  return [top[0] + (bottom[0]-top[0])*fv, top[1] + (bottom[1]-top[1])*fv];
}

/* Dibuja en `ctx` (outW×outH) el contenido de `image` deformado según
   `grid` — sus puntos de control, de (cols+1)×(rows+1), en el mismo
   orden fila a fila que produce `makeWarpGrid`—. `subdiv` es cuántas
   celdas de render hay por cada celda de control: con 1 se ve la
   rejilla de control tal cual (a facetas en los doblados fuertes);
   con 3 o 4 ya se ve curvo de verdad sin que el coste suba demasiado. */
export function warpRectToMesh(ctx, image, grid, cols, rows, outW, outH, subdiv = 4){
  ctx.clearRect(0, 0, outW, outH);
  const iw = image.width, ih = image.height;
  const rc = cols * subdiv, rr = rows * subdiv;

  const src = [], dst = [];
  for(let j = 0; j <= rr; j++){
    const v = j / rr, gj = Math.min(rows - 1, Math.floor(v * rows)), fv = v * rows - gj;
    for(let i = 0; i <= rc; i++){
      const u = i / rc, gi = Math.min(cols - 1, Math.floor(u * cols)), fu = u * cols - gi;
      src.push([u * iw, v * ih]);
      dst.push(bilerpCell(grid, cols, gi, gj, fu, fv));
    }
  }
  const at = (i, j) => j * (rc + 1) + i;
  for(let j = 0; j < rr; j++){
    for(let i = 0; i < rc; i++){
      const s00 = src[at(i,j)],   s10 = src[at(i+1,j)];
      const s01 = src[at(i,j+1)], s11 = src[at(i+1,j+1)];
      const d00 = dst[at(i,j)],   d10 = dst[at(i+1,j)];
      const d01 = dst[at(i,j+1)], d11 = dst[at(i+1,j+1)];
      drawTriangleAffine(ctx, image, [s00, s10, s11], [d00, d10, d11]);
      drawTriangleAffine(ctx, image, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

/* Rejilla de control neutra —cada punto en su sitio, sin deformar—
   para un rectángulo de `w`×`h` empezando en `(x0,y0)`. Fila a fila,
   de arriba-izquierda a abajo-derecha: el mismo orden que espera
   `warpRectToMesh` y que pinta `drawWarpOverlay`. */
export function makeWarpGrid(x0, y0, w, h, cols, rows){
  const grid = [];
  for(let j = 0; j <= rows; j++)
    for(let i = 0; i <= cols; i++)
      grid.push([x0 + w * i / cols, y0 + h * j / rows]);
  return grid;
}
