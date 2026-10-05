/* ═══════════════════════════════════════════════════════════════
   REVISIÓN DE LIENZOS (v252)
   Un contador por lienzo que sube cada vez que algo lo modifica: todas las escrituras de un contexto 2D pasan por unos pocos métodos
   (dibujar, rellenar, borrar, poner píxeles) y por el cambio de tamaño, así que envolver esos métodos del prototipo basta para saber, sin
   releer un solo píxel, si el contenido de un lienzo es el mismo que la última vez. Lo usa el compositor de coma flotante en GPU para
   conservar la textura de cada capa entre fotogramas en vez de subirla de nuevo cada vez.

   Se instala una sola vez (al importar). Un lienzo que nunca se ha escrito tras la instalación devuelve 0; el que se escribió antes no tiene
   historia que importe porque quien lo usa lo lee por primera vez después. Las escrituras que no pasan por el contexto 2D (p. ej. un
   `transferFromImageBitmap`) no se detectan: la app no las usa en lienzos de capa.
   ═══════════════════════════════════════════════════════════════ */

const REV = new WeakMap();
let installed = false;

const bump = c => { if(c) REV.set(c, (REV.get(c) || 0) + 1); };

/** Revisión actual del lienzo (número entero creciente), o null si el sistema no está instalado en este navegador. */
export const canvasRev = c => installed ? (REV.get(c) || 0) : null;

export function installCanvasRev(){
  if(installed || typeof CanvasRenderingContext2D === "undefined") return installed;
  const P = CanvasRenderingContext2D.prototype;
  for(const m of ["clearRect", "fillRect", "strokeRect", "fill", "stroke", "fillText", "strokeText", "drawImage", "putImageData", "reset"]){
    const orig = P[m];
    if(typeof orig !== "function") continue;
    P[m] = function(...args){ bump(this.canvas); return orig.apply(this, args); };
  }
  // cambiar el tamaño borra el lienzo
  for(const prop of ["width", "height"]){
    const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, prop);
    if(!d || !d.set) continue;
    Object.defineProperty(HTMLCanvasElement.prototype, prop, { ...d, set(v){ bump(this); d.set.call(this, v); } });
  }
  installed = true;
  return true;
}
installCanvasRev();
