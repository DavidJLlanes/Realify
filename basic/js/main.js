/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · ARRANQUE
   Punto de entrada de la app: sólo conecta piezas.
   Entradas: la página basic/index.html. Salidas: ninguna.
   Límites: ≤ 40 líneas; aquí no se calcula ni se pinta nada.
   ═══════════════════════════════════════════════════════════════ */
import { iniciarDispositivo } from "./app/device.js";
import { escucharEntradas, guardarCopia, pedirArchivo } from "./app/files.js";
import { crearAcciones } from "./app/acciones.js";
import { cerrar } from "./app/session.js";
import { iniciarTraspaso } from "./app/traspaso.js";
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
/* La interfaz nunca se desplaza: overflow: hidden no impide que el navegador mueva un contenedor por código (p. ej. al enfocar o
   centrar algo), y en el iPhone toda la pantalla quedaba corrida a un lado. Si pasa, se devuelve a su sitio. */
const escribiendo = () => document.activeElement?.matches?.("input, textarea");    // con el teclado, iOS sí debe poder mover la página
for (const el of [escenario, document.documentElement, document.body]) el.addEventListener("scroll", () => { if ((el.scrollLeft || el.scrollTop) && !escribiendo()) el.scrollTo(0, 0); }, { passive: true });
addEventListener("scroll", () => { if ((scrollX || scrollY) && !escribiendo()) scrollTo(0, 0); }, { passive: true });
const guardar = async () => { if (await guardarCopia()) avisar("Copia guardada"); };

iniciarDispositivo();
iniciarRender();
const visor = montarVisor(escenario);
montarBienvenida(escenario, { alAbrir: pedirArchivo });
montarBarraSuperior(escenario, { alCerrar: cerrar, alGuardar: guardar, acciones: crearAcciones({ guardar, avisar }) });
montarPanel(escenario, visor);
montarPestanas(escenario);
montarAtajos({ abrir: pedirArchivo, guardar });
escucharEntradas(document.body);
suscribir(e => (e.procesando ? avisar("Procesando a resolución completa…", { fijo: true }) : ocultarAviso()));
addEventListener("basic:error", e => avisar("No se pudo abrir la foto: " + e.detail));
poner({ pestana: "ajustar" });
registrarSW();
iniciarTraspaso(avisar);
