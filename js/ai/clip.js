/* ═══════════════════════════════════════════════════════════════
   IA · CLIP (búsqueda por texto)
   Convierte una foto o una frase en un vector de 512 números con CLIP ViT-B/32 (en el equipo) y compara. Las frases en español se
   pasan al inglés palabra a palabra (js/ai/es2en.js) y se envuelven en «a photo of …», como se entrenó el modelo.
   Entradas: lienzo o texto. Salidas: Int8Array(512) del vector (cuantizado: ocupa 512 B en el índice) y semejanza coseno (-1…1).
   Límites: los modelos (89 MB + 64 MB) se descargan al usarlos, con aviso; si se rechaza, embedImage/embedText lanzan error.
   ═══════════════════════════════════════════════════════════════ */
import { runModel } from "./runtime.js";
import { loadClipTokenizer } from "./cliptokenizer.js";
import { toEnglish } from "./es2en.js";

const Q = 127, cuantizar = v => Int8Array.from(v, x => Math.max(-Q, Math.min(Q, Math.round(x * Q * 4))));   // los vectores de CLIP rara vez pasan de ±0,25: ×4 aprovecha el byte

export function recortarCentro(src){
  const S = 224, c = document.createElement("canvas"); c.width = c.height = S;
  const k = Math.max(S / src.width, S / src.height), w = src.width * k, h = src.height * k, x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(src, (S - w) / 2, (S - h) / 2, w, h);
  return x.getImageData(0, 0, S, S).data;
}

export async function embedImage(src){
  const rgba = recortarCentro(src);
  return cuantizar((await runModel("clip", "clip_vision", { rgba }, [rgba.buffer], { title: "Analizando la foto con CLIP" })).v);
}

export async function embedText(texto){
  const tok = await loadClipTokenizer(), en = toEnglish(String(texto)).text || String(texto);
  const ids = Int32Array.from(tok.encode("a photo of " + en));
  return cuantizar((await runModel("clip", "clip_text", { ids }, [], { title: "Entendiendo la frase" })).v);
}

/** Semejanza coseno entre dos vectores cuantizados. */
export function semejanza(a, b){
  let d = 0, na = 0, nb = 0;
  for(let i = 0; i < a.length; i++){ d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}
