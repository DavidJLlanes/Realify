/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE PHOTO LENS · REVELADO
   Siete ajustes aplicados con el lienzo 2D y arrays tipados, sin GPU:
   calidez → tono (contraste, sombras, luces) → saturación y
   vibrancia → claridad. En ese orden y no en otro: el tono se corrige
   sobre la luminancia y se reparte a los tres canales con la misma
   proporción, para que aclarar una sombra no cambie su color; la
   saturación va después, sobre el color ya asentado; y la claridad
   —contraste local— va la última porque trabaja comparando cada píxel
   con su entorno desenfocado, y ese entorno debe ser el de la imagen
   ya revelada, no el de la original.

   Todo lo que se puede tabular se tabula: las curvas de calidez y de
   tono son tablas de 256 entradas construidas una vez por llamada, y
   el bucle por píxel sólo indexa y multiplica. Es lo que permite
   arrastrar el deslizador de intensidad y ver la foto seguir al dedo.
   ═══════════════════════════════════════════════════════════════ */

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* Curva de tono sobre la luminancia, en una tabla de 256 entradas.
   El contraste es una sigmoide que pasa exactamente por 0, ½ y 1 —así
   ni los negros ni los blancos se mueven y el gris medio se queda en
   su sitio—, y su inversa exacta para el contraste negativo. Sombras
   y luces son dos campanas centradas en ¼ y ¾, que aclaran tirando
   hacia el blanco y oscurecen tirando hacia el negro en vez de sumar
   sin más (sumar aplasta las luces contra el techo). */
function toneLut(contrast, shadows, highlights){
  const lut = new Float32Array(256);
  const c = contrast / 100, s = shadows / 100, h = highlights / 100;
  const k = 1 + Math.abs(c) * 2.6;
  const norm = Math.tanh(k * 0.5);
  const bell = (x, m, w) => Math.exp(-((x - m) * (x - m)) / (2 * w * w));

  for(let i = 0; i < 256; i++){
    let y = i / 255;
    if(c > 0)      y = 0.5 + 0.5 * Math.tanh(k * (y - 0.5)) / norm;
    else if(c < 0) y = 0.5 + Math.atanh(clamp01(y) * 2 * norm - norm) / k;
    y = clamp01(y);

    const ds = s * bell(y, 0.25, 0.20) * 0.40;
    y = ds >= 0 ? y + (1 - y) * ds : y * (1 + ds);
    const dh = h * bell(y, 0.75, 0.20) * 0.40;
    y = dh >= 0 ? y + (1 - y) * dh : y * (1 + dh);
    lut[i] = clamp01(y);
  }
  // Nunca decreciente: dos campanas opuestas pueden hacer retroceder
  // la curva un instante, y eso en la imagen es una banda.
  for(let i = 1; i < 256; i++) if(lut[i] < lut[i - 1]) lut[i] = lut[i - 1];
  return lut;
}

/* Calidez: ganancia cruzada rojo/azul, con un toque de verde en
   sentido contrario para que el gris se mantenga gris y no vire a
   magenta al calentar ni a cian al enfriar. */
function warmthGains(warmth){
  const t = warmth / 100;
  return { r: 1 + t * 0.26, g: 1 - Math.abs(t) * 0.03, b: 1 - t * 0.26 };
}

/* Radio de la claridad, proporcional a la imagen: un contraste local
   de 3 px en una foto de 4000 realza el grano, no la estructura. */
const clarityRadius = (w, h) => Math.max(3, Math.round(Math.min(w, h) * 0.014));

/* ¿Todo a cero? Entonces la salida es la entrada y no hay que tocar
   ni un píxel. */
export function isNeutral(adj){
  return Object.values(adj).every(v => Math.abs(v) < 0.5);
}

/* Revela `src` en `dst` (mismo tamaño) con los ajustes dados en
   -100..100. Devuelve los milisegundos que ha tardado. */
export function applyLens(src, dst, adj){
  const t0 = performance.now();
  const w = src.width, h = src.height;
  if(dst.width !== w || dst.height !== h){ dst.width = w; dst.height = h; }
  const sctx = src.getContext("2d", { willReadFrequently: true });
  const dctx = dst.getContext("2d", { willReadFrequently: true });

  if(isNeutral(adj)){
    dctx.save(); dctx.globalCompositeOperation = "copy";
    dctx.drawImage(src, 0, 0); dctx.restore();
    return performance.now() - t0;
  }

  const img = sctx.getImageData(0, 0, w, h);
  const d = img.data;

  const gain = warmthGains(adj.warmth || 0);
  const tone = toneLut(adj.contrast || 0, adj.shadows || 0, adj.highlights || 0);
  const satF = 1 + (adj.sat || 0) / 100;
  const vib  = (adj.vibrance || 0) / 100;
  const doTone = Math.abs(adj.contrast) + Math.abs(adj.shadows) + Math.abs(adj.highlights) > 0.5;
  const doWarm = Math.abs(adj.warmth) > 0.5;
  const doSat  = Math.abs(adj.sat) > 0.5 || Math.abs(vib) > 0.005;

  for(let i = 0; i < d.length; i += 4){
    let r = d[i], g = d[i + 1], b = d[i + 2];

    if(doWarm){
      r = r * gain.r; g = g * gain.g; b = b * gain.b;
      if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;
    }

    if(doTone){
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if(y > 0.5){
        const ny = tone[y > 255 ? 255 : y | 0] * 255;
        const f = ny / y;
        r *= f; g *= f; b *= f;
        if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;
      }
    }

    if(doSat){
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const sCur = mx > 0 ? (mx - mn) / mx : 0;
      /* Vibrancia: empuja más lo que está apagado y casi nada lo que ya
         está saturado, y protege los tonos de piel —naranjas con el
         rojo por delante del verde y éste del azul— para que una cara
         no se ponga como un tomate al subirla. */
      let skin = 0;
      if(r > g && g > b && r - b > 40 && mx > 60){
        skin = Math.min(1, (r - b) / 120) * 0.65;
      }
      const vibF = 1 + vib * (1 - sCur) * (1 - skin);
      const k = satF * vibF;
      r = y + (r - y) * k; g = y + (g - y) * k; b = y + (b - y) * k;
      if(r < 0) r = 0; if(g < 0) g = 0; if(b < 0) b = 0;
      if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;
    }

    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }

  dctx.putImageData(img, 0, 0);

  const clarity = (adj.clarity || 0) / 100;
  if(Math.abs(clarity) > 0.005 && "filter" in dctx){
    applyClarity(dctx, img, w, h, clarity);
  }
  return performance.now() - t0;
}

/* Contraste local: la diferencia entre cada píxel y su entorno
   desenfocado, sumada con signo positivo (más claridad) o restada
   (menos: un suavizado que respeta los bordes grandes). El desenfoque
   lo hace el propio lienzo con `filter: blur()`, que va por GPU, y el
   resto es un bucle sobre la luminancia. */
function applyClarity(dctx, img, w, h, clarity){
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  tctx.filter = `blur(${clarityRadius(w, h)}px)`;
  tctx.drawImage(dctx.canvas, 0, 0);
  tctx.filter = "none";
  const blur = tctx.getImageData(0, 0, w, h).data;

  const d = img.data;
  const amt = clarity > 0 ? clarity * 0.9 : clarity * 0.6;
  for(let i = 0; i < d.length; i += 4){
    const y  = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const yb = 0.2126 * blur[i] + 0.7152 * blur[i + 1] + 0.0722 * blur[i + 2];
    if(y < 0.5) continue;
    const ny = y + (y - yb) * amt;
    const f = (ny < 0 ? 0 : ny) / y;
    let r = d[i] * f, g = d[i + 1] * f, b = d[i + 2] * f;
    if(r > 255) r = 255; if(g > 255) g = 255; if(b > 255) b = 255;
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  dctx.putImageData(img, 0, 0);
}
