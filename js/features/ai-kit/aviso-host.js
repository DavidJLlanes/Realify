/* ═══════════════════════════════════════════════════════════════
   AI-KIT · AVISO DE «SÓLO EN ORDENADOR»
   Diálogo con un solo botón para las funciones que un móvil no puede ejecutar (por ejemplo, un modelo de lenguaje de 1,2 GB): dice por qué y qué
   se hace en su lugar. Es el sitio que importa `dialog` para esto, como simple-host.js. Entradas: { titulo, texto }. Salida: promesa que se resuelve al cerrarlo.
   ═══════════════════════════════════════════════════════════════ */
import { dialog } from "../../ui/kit/dialog.js";

export async function avisoSoloOrdenador({ titulo = "Sólo en ordenador", texto }){
  const body = document.createElement("div"), p = document.createElement("p");
  p.textContent = texto; body.appendChild(p);
  await dialog({ title: titulo, body, buttons: [{ label: "Entendido", value: true, primary: true }] });
}
