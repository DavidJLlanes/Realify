/* ═══════════════════════════════════════════════════════════════
   SEÑALES DE DISPOSITIVO
   `pointer:coarse` —no el ancho de la ventana— es la señal correcta
   para "probablemente sin la GPU ni la CPU de un escritorio": un
   tablet grande también es táctil y lento, y una ventana estrecha en
   un portátil no lo es en absoluto. Se usa para recortar trabajo por
   fotograma en las herramientas que redibujan píxeles en cada
   `pointermove` —Licuar, Perspectiva, los diálogos de vista previa en
   vivo—, no para decidir layout, que ya tiene su propio criterio de
   ancho en panels.js/dialog.js.
   ═══════════════════════════════════════════════════════════════ */

export const COARSE = matchMedia("(pointer:coarse)").matches;

/* Señal de LAYOUT (no de capacidad): por debajo de este ancho la app
   cambia de disposición por completo —herramientas abajo, paneles en
   hoja, menú aplanado—. Antes vivía redefinida por separado en
   panels.js y en dialog.js con el mismo criterio exacto; centralizada
   aquí para que un cambio de breakpoint no pueda divergir en silencio
   entre los dos sitios. */
export const isMobile = () => matchMedia("(max-width:900px)").matches;

/* Un toque háptico breve, sólo donde tiene sentido: dispositivos con
   puntero impreciso (los que ya usan `COARSE` para todo lo demás). En
   escritorio esto es simplemente un no-op, así que no hace falta que
   cada punto de llamada compruebe nada por su cuenta. Envuelto en
   try/catch porque `navigator.vibrate` puede lanzar en contextos
   restringidos (iframe, permisos) sin que sea motivo de romper nada. */
export function haptic(ms = 8){
  if(!COARSE) return;
  try{ navigator.vibrate?.(ms); }catch{}
}
