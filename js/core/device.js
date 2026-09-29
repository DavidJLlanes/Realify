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

/* Android: su navegador sólo abre directamente la GALERÍA (el selector
   de fotos del sistema) cuando el selector de archivos pide únicamente
   imágenes (`image/*`); con cualquier extensión añadida (.psd, .tif,
   RAW…) muestra en su lugar «Cámara / Archivos». Ver io/open.js. */
export const isAndroid = () => navigator.userAgentData?.platform === "Android" || /Android/i.test(navigator.userAgent || "");
/* Teléfono (Android o iPhone), no tableta ni ordenador: táctil y con el
   lado corto de la pantalla de teléfono (un iPhone Pro Max tiene 430 px,
   un iPad mini 744). Se mira la pantalla, no la ventana, para que no
   cambie al girar. */
export const isPhone = () => {
  const ua = navigator.userAgent || "";
  if(/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return false;
  return matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) <= 600;
};
/* Selector de fotos: en Android, sólo `image/*` (galería directa). */
export const galleryAccept = full => isAndroid() ? "image/*" : full;

/* Tamaño máximo de un documento recién abierto. En un móvil, 24 MP por
   trece etapas de shader es pedir un cuelgue (y Safari de iPhone ni
   siquiera dibuja lienzos de más de ~16,7 MP): se limita el lado mayor
   a 2400 px; en escritorio, a 8192. Devuelve [ancho, alto, reducida].
   La usan al abrir imágenes (io/open.js) y al pasar un RAW revelado
   al editor (raw/index.js). */
export function docSizeLimit(w, h){
  const coarse = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
  const LIM = coarse ? 2400 : 8192;
  const m = Math.max(w, h);
  if(m <= LIM) return [w, h, false];
  const s = LIM / m;
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), true];
}

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
