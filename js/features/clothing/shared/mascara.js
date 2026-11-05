/* ═══════════════════════════════════════════════════════════════
   ROPA · MÁSCARA DE LA PRENDA (puro, sin DOM)
   Une las partes de ropa que da el modelo de personas (camiseta/chaqueta, vestido, falda, pantalón, cinturón, bufanda) en una máscara a la
   escala de trabajo y la ajusta a los bordes reales de la tela con un filtro guiado por la luminancia (así la manga sigue el contorno
   de verdad y no el de 128 px del modelo). Entradas: persona.partes, recorte { x,y,w,h,k,W,H }, luminancia Y (Float32), qué prenda.
   Salida: Float32Array 0-1 (null si el modelo no vio esa prenda).
   ═══════════════════════════════════════════════════════════════ */
import { mascaraParte } from "../../portrait/shared/partes.js";
import { union } from "../../portrait/shared/raster.js";

export const PRENDAS = { todo: ["ropa"], arriba: ["ropaArriba", "bufanda"], vestido: ["vestido"], falda: ["falda"], pantalon: ["pantalon"], cinturon: ["cinturon"] };

export function mascaraPrenda(partes, crop, Y, que = "todo"){
  const lista = (PRENDAS[que] || PRENDAS.todo).map(n => mascaraParte(partes, n, crop, Y ? { Y, radio: Math.max(2, Math.round(Math.min(crop.W, crop.H) / 150)) } : null)).filter(Boolean);
  if(!lista.length) return null;
  const m = lista.length > 1 ? union(lista) : lista[0];
  let area = 0; for(let i = 0; i < m.length; i++) if(m[i] > 0.5) area++;
  return area > 16 ? m : null;
}

/** Tamaño típico de la prenda (raíz de su área, px): las escalas de las arrugas se miden con él. */
export function tamano(m){ let a = 0; for(let i = 0; i < m.length; i++) a += m[i]; return Math.max(8, Math.sqrt(a)); }
