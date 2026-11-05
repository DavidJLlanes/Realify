/* ═══════════════════════════════════════════════════════════════
   AI-KIT · RESULTADO EN CAPA NUEVA
   Todo resultado de IA va a una capa nueva encima de la activa, con un solo paso de deshacer y el porcentaje de aplicación
   («mezcla») cuando el resultado tiene el tamaño de la foto.
   Entradas: lienzo con el resultado y nombre de la capa. Salida: nada (el documento cambia).
   Detrás está resultToLayer de js/ui/kit/fsshell.js: así hay una sola implementación.
   ═══════════════════════════════════════════════════════════════ */

export async function toNewLayer(canvas, name){
  const { resultToLayer } = await import("../../ui/kit/fsshell.js");
  await resultToLayer(canvas, { name, mix: true });
}
