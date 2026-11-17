/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ACCIONES DEL MENÚ «···»
   La lista de opciones del menú: abrir otra foto, guardar copia, volver al original y las dos de traspaso (abrir la foto en Realify y
   cambiar de app). Cada opción es { texto, icono, ver?(estado), alTocar }.
   Entradas: crearAcciones({ guardar, avisar }). Salidas: la lista para ui/topbar.js.
   Límites: sólo declara; el trabajo está en app/files.js, app/session.js y app/traspaso.js.
   ═══════════════════════════════════════════════════════════════ */
import { pedirArchivo } from "./files.js";
import { volverAlOriginal } from "./session.js";
import { enviarARealify, irARealify } from "./traspaso.js";

export const crearAcciones = ({ guardar, avisar }) => [
  { texto: "Abrir otra foto", icono: "abrir", alTocar: pedirArchivo },
  { texto: "Guardar copia", icono: "guardar", alTocar: guardar },
  { texto: "Volver al original", icono: "original", ver: e => e.sucio, alTocar: volverAlOriginal },
  { texto: "Abrir en Realify", icono: "enviar", ver: e => !!e.foto, alTocar: () => enviarARealify(avisar) },
  { texto: "Cambiar a Realify", icono: "cambiar", alTocar: irARealify },
];
