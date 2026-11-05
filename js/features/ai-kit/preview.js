/* ═══════════════════════════════════════════════════════════════
   AI-KIT · VISTA PREVIA Y RESOLUCIÓN DE TRABAJO
   Las funciones de IA calculan la vista previa a un tamaño reducido (PREVIEW) y el resultado final a una resolución de
   trabajo (WORK) que depende del dispositivo, componiéndolo después con la foto original a su tamaño real.
   Salidas: PREVIEW (lado largo de la vista previa), WORK() (lado largo de trabajo), scaled(canvas, lado).
   ═══════════════════════════════════════════════════════════════ */

export const PREVIEW = 1280;   // lado largo de la vista previa

/* Lo desenfocado no tiene detalle que perder: se calcula a una resolución de trabajo (WORK) y se compone con la foto
   ORIGINAL a su tamaño real. Calcular todo a tamaño completo (una treintena de matrices de la foto entera) llegaba a
   unos 2 GB con 12 MP y el móvil cerraba la pestaña. */
export const WORK = () => (matchMedia("(max-width:900px)").matches || /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.deviceMemory || 8) <= 4) ? 1600 : 2400;

export function scaled(src, side){
  const k = Math.min(1, side / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
