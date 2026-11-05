/* ═══════════════════════════════════════════════════════════════
   COLOCAR TEXTO EN LA ZONA LIBRE · MOTOR
   Une la búsqueda de zona (compose/engine/zona-texto.js) con el tamaño del texto. Puro, sin DOM: el ancho del texto se lo da el controlador.
   Entradas: mapa de importancia, luminancia y rejilla (gw×gh), proporción ancho/alto del texto y su alto relativo a la foto. Salida:
   { x, y, w, h (0-1 de la foto), claro } o null.
   ══════════════════════════════════════════════════════════════ */
import { zonaTexto, texturaDe } from "../engine/zona-texto.js";

export function colocarTexto({ imp, lum, gw, gh, prop, altoRel, fotoW, fotoH }){
  const hPx = altoRel * fotoH, wPx = Math.min(fotoW * 0.92, hPx * prop);
  const z = zonaTexto(imp, texturaDe(lum, gw, gh), lum, gw, gh, Math.ceil(wPx / fotoW * gw), Math.ceil(hPx / fotoH * gh));
  if(!z) return null;
  return { x: z.x / gw, y: z.y / gh, w: z.w / gw, h: z.h / gh, claro: z.claro, coste: z.coste };
}
