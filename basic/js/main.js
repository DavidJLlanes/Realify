/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ARRANQUE
   Punto de entrada de la app: sólo conecta piezas.
   Entradas: la página basic/index.html. Salidas: ninguna.
   Límites: ≤ 40 líneas; aquí no se calcula ni se pinta nada.
   ═══════════════════════════════════════════════════════════════ */
import { iniciarDispositivo } from "./app/device.js";
import { escucharEntradas, guardarCopia, pedirArchivo } from "./app/files.js";
import { cerrar, volverAlOriginal } from "./app/session.js";
import { registrarSW } from "./app/pwa.js";
import { iniciarRender } from "./app/render.js";
import { avisar, ocultarAviso } from "./ui/aviso.js";
import { montarAtajos } from "./ui/atajos.js";
import { montarBienvenida } from "./ui/bienvenida.js";
import { montarPanel } from "./ui/panel.js";
import { montarPestanas } from "./ui/tabbar.js";
import { montarBarraSuperior } from "./ui/topbar.js";
import { montarVisor } from "./ui/viewport.js";
import { poner, suscribir } from "./app/store.js";

const escenario = document.getElementById("stage");
const guardar = async () => { if (await guardarCopia()) avisar("Copia guardada"); };

iniciarDispositivo();
iniciarRender();
const visor = montarVisor(escenario);
montarBienvenida(escenario, { alAbrir: pedirArchivo });
montarBarraSuperior(escenario, { alCerrar: cerrar, alGuardar: guardar, acciones: [
  { texto: "Abrir otra foto", icono: "abrir", alTocar: pedirArchivo },
  { texto: "Guardar copia", icono: "guardar", alTocar: guardar },
  { texto: "Volver al original", icono: "original", ver: e => e.sucio, alTocar: volverAlOriginal },
] });
montarPanel(escenario, visor);
montarPestanas(escenario);
montarAtajos({ abrir: pedirArchivo, guardar });
escucharEntradas(document.body);
suscribir(e => (e.procesando ? avisar("Procesando a resolución completa…", { fijo: true }) : ocultarAviso()));
addEventListener("basic:error", e => avisar("No se pudo abrir la foto: " + e.detail));
poner({ pestana: "ajustar" });
registrarSW();
