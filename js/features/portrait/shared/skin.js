/* ═══════════════════════════════════════════════════════════════
   RETRATO · MÁSCARA DE PIEL DEL RECORTE (puro, sin DOM)
   La piel que se puede retocar: lo que el modelo de partes llama cara o piel, dentro del óvalo y del cuello, sin ojos, cejas ni labios.
   Entradas: la parte «partes» de una persona (js/ai/people/analyze.js), las zonas (zones.js) y el recorte. `F` = ancho de la cara en el recorte (para el margen del borde). Salida: Float32Array(W·H) 0-1.
   Sin máscara del modelo (calidad baja o fallo) se usa el óvalo de la malla, que es lo bastante buena para retocar.
   ═══════════════════════════════════════════════════════════════ */
import { multiply, union } from "./raster.js";
import { gauss, smoothstep } from "./blur.js";
import { mascaraParte } from "./partes.js";

export function skinMask(partes, zonas, crop, F = 0){
  const { W, H } = crop, zona = union([zonas.ovalo, zonas.cuello]);
  let piel = zona;
  const modelo = partes && (mascaraParte(partes, "piel", crop) || mascaraParte(partes, "cara", crop));
  if(modelo) piel = multiply(modelo, zona);       // el modelo manda en el contorno (pelo, barba, gafas); la malla evita que se cuele nada lejos de la cara
  const out = new Float32Array(W * H);
  for(let i = 0; i < out.length; i++) out[i] = piel[i] * (1 - zonas.excluir[i]);
  if(F <= 0) return out;
  // sólo piel bien dentro: nada de actuar en el borde (pelo, ropa, fondo), donde un desenfoque o un filtro mezcla lo que no es piel
  const dentro = gauss(out, W, H, Math.max(1, F * 0.012));
  for(let i = 0; i < out.length; i++) out[i] *= smoothstep(0.82, 0.99, dentro[i]);
  return out;
}
