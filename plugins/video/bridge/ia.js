/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · PUENTE · IA
   Recorte del sujeto fotograma a fotograma con el modelo de retratos (MODNet, el mismo de «Eliminar fondo»; se descarga la primera vez y avisa del tamaño). Carga bajo demanda.
   Entradas: lienzo (el fotograma). Salida: { alfa: Float32Array n×n en 0..1, n } con el fotograma estirado a un cuadrado, como lo ve el modelo. Sin refinado de borde (va en el efecto).
   ═══════════════════════════════════════════════════════════════ */
export async function alfaDelFotograma(lienzo, id = "modnet"){
  const [{ MODELS }, { runModel }] = await Promise.all([import("../../../js/ai/models.js"), import("../../../js/ai/runtime.js")]);
  const n = MODELS[id].input, c = Object.assign(document.createElement("canvas"), { width: n, height: n }), x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(lienzo, 0, 0, n, n);
  const r = await runModel("matte", id, { rgba: x.getImageData(0, 0, n, n).data, size: n }, [], { quiet: true }), alfa = new Float32Array(r.mask.length);
  for(let i = 0; i < alfa.length; i++) alfa[i] = r.mask[i] / 255;
  return { alfa, n };
}
export const modeloDisponible = id => import("../../../js/ai/runtime.js").then(m => m.isModelCached(id));
