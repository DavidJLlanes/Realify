/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MOTOR · CADENA DE EDICIÓN
   Aplica la receta de ajustes en el orden de revelado, en ocho etapas: estilo (un look prediseñado, con su intensidad) → color (punto negro, balance de blancos, exposición,
   saturación, intensidad) → luces y sombras → contraste y brillo → ruido → definición → nitidez → viñeta. Siempre calidad Premium.
   aplicarReceta calcula la imagen entera en su sitio (resultado final). crearCadena(base) es para la vista previa en vivo: guarda
   el resultado de cada etapa y, al mover un deslizador, sólo recalcula esa etapa y las siguientes.
   Entradas: aplicarReceta(imageData, receta, { rapido }) · crearCadena(imageData) → { render(receta, { rapido }) }.
   Salidas: aplicarReceta devuelve el mismo imageData; render devuelve un ImageData que no se debe modificar.
   Límites: sin DOM. rapido sólo acelera el paso de color (tabla 33³) para la vista previa; el resultado final no lo usa.
   ═══════════════════════════════════════════════════════════════ */
import { pasoColor } from "./color.js";
import { pasoEstilo } from "./estilo.js";
import { pasoContraste, pasoLuces } from "./tono.js";
import { pasoDefinicion, pasoNitidez, pasoRuido } from "./detalle.js";
import { pasoVineta } from "./vineta.js";

export { esNeutra } from "./neutra.js";
export { cargarEstilos } from "./estilo.js";

const ETAPAS = [
  { claves: ["_e", "_k"], activa: a => a._e, aplicar: (d, w, h, a) => pasoEstilo(d, a) },
  { claves: ["negro", "temperatura", "tinte", "exposicion", "saturacion", "intensidad"], aplicar: (d, w, h, a, o) => pasoColor(d, a, o) },
  { claves: ["sombras", "luces", "brillantez"], aplicar: (d, w, h, a) => pasoLuces(d, w, h, a) },
  { claves: ["contraste", "brillo"], aplicar: (d, w, h, a) => pasoContraste(d, w, h, a) },
  { claves: ["ruido"], aplicar: (d, w, h, a) => pasoRuido(d, w, h, a) },
  { claves: ["definicion"], aplicar: (d, w, h, a) => pasoDefinicion(d, w, h, a) },
  { claves: ["nitidez"], aplicar: (d, w, h, a) => pasoNitidez(d, w, h, a) },
  { claves: ["vineta"], aplicar: (d, w, h, a) => pasoVineta(d, w, h, a) },
];
const activa = (e, a) => (e.activa ? e.activa(a) : e.claves.some(k => a[k]));
/* Los valores de la receta que ven las etapas: los ajustes más el estilo (_e = posición + 1, 0 = ninguno; _k = intensidad). */
const valores = r => ({ ...(r.ajustes || {}), _e: r.estilo && r.estilo.n >= 0 ? r.estilo.n + 1 : 0, _k: r.estilo ? r.estilo.k : 100 });

export function aplicarReceta(img, receta, { rapido = false } = {}) {
  const a = valores(receta);
  for (const e of ETAPAS) if (activa(e, a)) e.aplicar(img.data, img.width, img.height, a, { rapido });
  return img;
}

export function crearCadena(base) {
  const cache = [], { width: w, height: h } = base;
  return {
    render(receta, { rapido = false } = {}) {
      const a = valores(receta);
      let previo = base;
      ETAPAS.forEach((e, i) => {
        const clave = e.claves.map(k => a[k] || 0).join(",") + (rapido ? "r" : ""), c = cache[i];
        if (c && c.clave === clave && c.entrada === previo) { previo = c.salida; return; }
        let salida = previo;
        if (activa(e, a)) { salida = new ImageData(new Uint8ClampedArray(previo.data), w, h); e.aplicar(salida.data, w, h, a, { rapido }); }
        cache[i] = { clave, entrada: previo, salida }; previo = salida;
      });
      return previo;
    },
  };
}
