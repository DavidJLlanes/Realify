/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO DE MODELOS (fachada)
   El catálogo está repartido por familia en js/ai/models/ (segmentation, inpaint, enhance, faces, depth, scene, people).
   Este archivo conserva la API de siempre: MODELS (todos juntos) y mb(). Un modelo nuevo se añade en el archivo de su familia
   y se anota en docs/MODELOS.md.
   
   · `local`: el archivo viaja con la app (assets/models) y funciona sin conexión desde la primera vez.
   · `remote`: se descarga de Hugging Face sólo cuando alguien lo pide y se guarda en IndexedDB (ver js/ai/engine/model-store.js).
     La CSP de nginx permite huggingface.co y *.hf.co SÓLO para esto: se bajan pesos, la imagen del usuario nunca sale del equipo.
     Antes de la primera descarga se pide permiso (confirmDownload en runtime.js).
   
   Revisión de los pesos (HF_REV) y `sha256` por modelo: ver js/ai/models/base.js.
   ═══════════════════════════════════════════════════════════════ */

import { SEGMENTATION } from "./models/segmentation.js";
import { INPAINT } from "./models/inpaint.js";
import { ENHANCE } from "./models/enhance.js";
import { FACES } from "./models/faces.js";
import { DEPTH } from "./models/depth.js";
import { SCENE } from "./models/scene.js";
import { PEOPLE } from "./models/people.js";
import { LLM } from "./models/llm.js";
import { VOZ } from "./models/voz.js";
import { CLIP } from "./models/clip.js";
import { FLORENCE } from "./models/florence.js";

export const MODELS = { ...SEGMENTATION, ...INPAINT, ...ENHANCE, ...FACES, ...DEPTH, ...SCENE, ...PEOPLE, ...LLM, ...VOZ, ...CLIP, ...FLORENCE };

export const mb = bytes => Math.round(bytes / 1e6) + " MB";
