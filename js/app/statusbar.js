/* ═══════════════════════════════════════════════════════════════
   APP · barra de estado, píldora de zoom y botón de comparar
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { view } from "../core/view.js";
import { doc, activeLayer } from "../core/doc.js";
import { on } from "../core/bus.js";
import { canUndo } from "../core/history.js";
import { setTool } from "../editor/tools/tools.js";
import { toast } from "../core/toast.js";
import { run } from "../core/commands.js";
import { empty } from "./dom.js";

/* ═══ barra de estado ═══ */
const stZoom = document.getElementById("stZoom");

const stSize = document.getElementById("stSize");

const stLayer = document.getElementById("stLayer");

const stPos  = document.getElementById("stPos");

const zoomPillLvl = document.getElementById("zoomPillLvl");

export function updatePos(p){
  if(!p){ stPos.textContent = "—"; return; }
  stPos.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
}

export function syncStatus(){
  const z = view.zoom * 100;
  const txt = (z < 10 ? z.toFixed(1) : Math.round(z)) + " %";
  stZoom.textContent = txt;
  zoomPillLvl.textContent = txt;
  stSize.textContent = doc.open ? `${doc.w} × ${doc.h}` : "—";
  const l = activeLayer();
  stLayer.textContent = l ? l.name : "—";
}

on("view:change", syncStatus);

on("doc:change", syncStatus);

/* Máscaras por profundidad «vivas»: si la foto de debajo cambia, se recalculan (cargado sólo cuando hay alguna) */
on("doc:change", () => { if(doc.open && doc.layers.some(l => l.depthMask)) import("../features/depthlive.js").then(m => m.schedule()); });

on("doc:structure", syncStatus);

on("doc:active", syncStatus);

const compareFab = document.getElementById("compareFab");

function syncCompareFab(){ compareFab.hidden = !(doc.open && canUndo()); }

compareFab.addEventListener("click", () => setTool("compare"));

on("doc:change", syncCompareFab);

on("doc:structure", syncCompareFab);

on("history:change", syncCompareFab);

on("cmd:done", syncCompareFab);

syncCompareFab();

/* El historial libera capturas de píxeles viejas cuando se pasa del
   techo de memoria: ese paso deja de poder recorrerse. Nadie escuchaba
   el aviso, así que deshacer se quedaba quieto sin decir por qué y
   parecía que la aplicación ignoraba la orden. */
on("history:lost", () => toast("Ese paso ya no puede deshacerse: su copia se liberó para no agotar la memoria"));

document.getElementById("zoomCell").addEventListener("click", () => run("view.fit"));

/* La pantalla de bienvenida se muestra u oculta según si HAY un
   documento activo, punto — sea cual sea el camino por el que se
   llegó a ese estado (abrir, cerrar una pestaña, volver a la última
   que queda…). Centralizarlo aquí evita tener que acordarse de
   tocarlo en cada sitio nuevo que cree o cierre una pestaña. */
on("doc:structure", () => empty.classList.toggle("hide", doc.open));
