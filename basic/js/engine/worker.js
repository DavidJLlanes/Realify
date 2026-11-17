/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · TRABAJADOR DEL RESULTADO FINAL
   Calcula la foto a resolución completa (aplicarReceta) fuera del hilo principal para que la página no se congele mientras se guarda
   o se envía. Se crea con new Worker(url, { type: "module" }); recibe { img: ImageData, receta } y devuelve { img } (o { error }).
   Los motores de color y tono de Realify, aunque sólo hacen cálculo, importan módulos que miran `document` al cargarse: antes de
   importar la cadena se ponen cuatro sustitutos vacíos (no se usan en el cálculo). Si aun así algo falla, quien lo llama recurre al
   hilo principal.
   Entradas: mensaje { img, receta }. Salidas: mensaje { img } | { error }. Límites: sin DOM real; un trabajo cada vez.
   ═══════════════════════════════════════════════════════════════ */
const vacio = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => "" : k === "length" ? 0 : vacio()), apply: () => vacio(), construct: () => vacio(), set: () => true });
self.document = vacio(); self.window = self;
for (const n of ["HTMLCanvasElement", "HTMLElement", "HTMLImageElement", "HTMLVideoElement", "Element", "Node", "Image", "CanvasRenderingContext2D", "ImageBitmapRenderingContext"]) self[n] ||= class {};
self.matchMedia ||= () => ({ matches: false, addEventListener() {}, addListener() {} });
try { self.localStorage; } catch { /* sin almacenamiento */ }
self.localStorage ||= { getItem: () => null, setItem() {}, removeItem() {} };

const cadena = import("./pipeline.js");
self.onmessage = async e => {
  try {
    const { aplicarReceta, cargarEstilos } = await cadena, { img, receta } = e.data;
    if (receta.estilo?.n >= 0) await cargarEstilos();
    aplicarReceta(img, receta, { rapido: false });
    self.postMessage({ img }, [img.data.buffer]);
  } catch (err) { self.postMessage({ error: String(err?.stack || err) }); }
};
