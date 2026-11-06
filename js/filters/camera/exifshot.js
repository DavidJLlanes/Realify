/* ═══════════════════════════════════════════════════════════════
   EXIF COHERENTE CON LA SIMULACIÓN · DATOS DE DISPARO Y TAMAÑO
   Complementa a exifmatch.js (que elige cuerpo y objetivo). Aquí se traduce lo que pide la cadena de Realify a los datos de disparo que un fotógrafo vería en el EXIF:
     · ISO: cuanto más ruido de sensor, más ISO (hasta el tope del cuerpo);
     · focal: más distorsión de barril y viñeteo piden un angular; poca, una focal larga;
     · apertura: un desenfoque de fondo marcado pide diafragma abierto; mucha pérdida de nitidez (difracción), cerrado;
     · velocidad: un arrastre de movimiento marcado pide una velocidad lenta (y el ISO baja lo mismo, para que el triángulo de exposición siga cerrando).
   Y para el tamaño: los tamaños de archivo reales del cuerpo (completo, M y S, siempre 3:2) y un aviso si la imagen no cuadra.
   Entradas: stages del filtro y el cuerpo. Salidas: pistas { ruido, focalPos, abierto, cerrado, lento }, lista de tamaños y texto de aviso. Puro: sin DOM. No inventa fecha ni lugar de captura.
   ═══════════════════════════════════════════════════════════════ */
const N = v => Math.max(0, Math.min(1, (v ?? 0) / 100));
const on = (stages, id) => stages?.[id]?.on ? stages[id].p : null;

export function shotHints(stages){
  const sensor = on(stages, "sensor"), prnu = on(stages, "prnu"), dist = on(stages, "distort"), vig = on(stages, "vignette"), dof = on(stages, "dof"), soft = on(stages, "soft"), mot = on(stages, "motion");
  const ruido = sensor || prnu ? Math.min(1, ((sensor ? (N(sensor.shot) + N(sensor.read)) / 2 : 0) * 0.8 + (prnu ? N(prnu.amt) : 0) * 0.2) * 1.6) : null;
  const flaw = (dist ? N(dist.amt) : 0) * 0.7 + (vig ? N(vig.amt) : 0) * 0.3;
  return {
    ruido,
    focalPos: dist || vig ? 1 - Math.min(1, flaw * 1.4) : null,     // 0 = angular, 1 = tele
    abierto: !!dof && N(dof.bokeh) > 0.25,
    cerrado: !!soft && N(soft.amt) > 0.5 && !(dof && N(dof.bokeh) > 0.25),
    lento: mot ? N(mot.amt) : 0
  };
}

/** Tamaños de JPEG que da el cuerpo: completo, M (~56 % de los píxeles) y S (~25 %), todos 3:2 como el sensor. */
export function cameraSizes(body){
  const [w, h] = body.px, par = n => Math.round(n / 2) * 2;
  return [["L", 1], ["M", 0.56], ["S", 0.25]].map(([n, k]) => { const f = Math.sqrt(k); return { n, w: par(w * f), h: par(h * f) }; });
}

/** Aviso si la imagen no es un tamaño que ese cuerpo escribiría (proporción distinta de 3:2 o tamaño lejano a L/M/S). null si cuadra. */
export function sizeNote(body, w, h){
  if(!body || !w || !h) return null;
  const sizes = cameraSizes(body), largo = Math.max(w, h), corto = Math.min(w, h);
  const near = sizes.find(s => Math.abs(s.w - largo) / s.w < 0.03 && Math.abs(s.h - corto) / s.h < 0.03);
  if(near) return null;
  const cerca = sizes.reduce((a, b) => Math.abs(Math.log(b.w * b.h / (w * h))) < Math.abs(Math.log(a.w * a.h / (w * h))) ? b : a);
  const tres2 = Math.abs(largo / corto - 1.5) < 0.03;
  return tres2 ? `Tamaño: ${w}×${h}. Esta cámara escribe ${sizes.map(s => `${s.w}×${s.h} (${s.n})`).join(", ")}.`
               : `Tamaño: ${w}×${h} no es 3:2 como el sensor de esta cámara. Para que cuadre, recorta a 3:2 (p. ej. ${cerca.w}×${cerca.h}).`;
}
