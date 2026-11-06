/* ═══════════════════════════════════════════════════════════════
   IA · CATÁLOGO · CLIP ViT-B/32 (buscar fotos por texto)
   Dos modelos ONNX cuantizados a 8 bits de Xenova/clip-vit-base-patch32 (OpenAI CLIP, MIT): el de imagen y el de texto,
   que dan un vector de 512 números cada uno; la semejanza es su producto escalar normalizado. Los dos son remotos
   (descarga al usarlos, avisando del tamaño). El texto se convierte en identificadores con js/ai/cliptokenizer.js
   (mismo vocabulario BPE de CLIP que ya usa «Seleccionar por texto»).
   Imagen: pixel_values [1, 3, 224, 224], recorte central tras reducir el lado corto a 224, media [0.4815, 0.4578, 0.4082]
   y desviación [0.2686, 0.2613, 0.2758]. Texto: input_ids [1, n] (n ≤ 77). Salidas: image_embeds / text_embeds [1, 512].
   ═══════════════════════════════════════════════════════════════ */

const REV = "6b7c523703ae26e39be4b03774966f8571c7f523";
const BASE = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/" + REV + "/onnx/";

export const CLIP = {
  clip_vision: {
    url: BASE + "vision_model_quantized.onnx", size: 89117001, rev: REV,
    sha256: "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299",
    label: "CLIP ViT-B/32 · imagen (int8)", license: "MIT"
  },
  clip_text: {
    url: BASE + "text_model_quantized.onnx", size: 64504507, rev: REV,
    sha256: "73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a",
    label: "CLIP ViT-B/32 · texto (int8)", license: "MIT"
  }
};
