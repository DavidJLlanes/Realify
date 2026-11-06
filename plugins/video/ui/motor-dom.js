/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MOTOR CON LIENZOS REALES
   Une el motor de fotogramas (puro) con el navegador: lienzos de verdad y los lectores de los archivos abiertos. Lo usan la vista previa y la exportación.
   Entradas: { proyecto():obj, lectorDe(idMedio, ancho)→Promise<lector> }. Salida: motor (render/motor.js). El registro de efectos es el de la aplicación.
   ═══════════════════════════════════════════════════════════════ */
import { crearMotor } from "../render/motor.js";
import { crearRegistroEfectos } from "../effects/registro.js";
import { registrarTodos } from "../effects/lista.js";

export const fabricaDom = {
  lienzo: (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }),
  rellenar(d, color){ const x = d.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, d.width, d.height); },
  dibujar(d, o, x, y, w, h){ const c = d.getContext("2d"); c.imageSmoothingQuality = "high"; c.drawImage(o, x, y, w, h); }
};
let registro = null;
export function efectosDeLaApp(){ if(!registro){ registro = crearRegistroEfectos(); registrarTodos(registro); } return registro; }

export const motorDom = ({ proyecto, lectorDe, cacheMax = 8 }) => crearMotor({ proyecto, abrirLector: lectorDe, efectos: efectosDeLaApp(), fabrica: fabricaDom, cacheMax });
