/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · BASE COMÚN
   Revisión del repositorio de pesos y rutas de origen que usan todas las familias del catálogo.
   Salidas: HF_REV, HF (Hugging Face de ImageToolbox) y LOCAL (assets/models de la propia web).
   ═══════════════════════════════════════════════════════════════ */

/* Revisión del repositorio de pesos. «main» es una rama que su autor puede cambiar: para fijarla, pon aquí el
   hash de un commit de ese repositorio y, por modelo, el campo `sha256` (lo comprueba js/ai/worker.js).
   Ojo: la caché de IndexedDB se indexa por URL, así que cambiar la revisión vuelve a descargar los modelos. */
export const HF_REV = "main";
export const HF = `https://huggingface.co/T8RIN/ImageToolbox-models/resolve/${HF_REV}/`;
export const LOCAL = new URL("../../../assets/models/", import.meta.url).href;
