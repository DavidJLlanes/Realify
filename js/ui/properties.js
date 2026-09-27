/* ═══════════════════════════════════════════════════════════════
   PANEL DE PROPIEDADES
   Fijo, contextual: cambia solo según lo que esté seleccionado, sin
   que haga falta abrir ningún diálogo modal para tocarlo. Una capa de
   ajuste, de texto, con un filtro reeditable o con máscara puede traer
   varias secciones a la vez —una máscara existe con independencia del
   tipo de capa que la lleva—, así que se muestran todas las que
   apliquen, apiladas.

   Cada sección se «monta» una sola vez por capa (mientras la capa
   activa y lo que tiene siga siendo lo mismo, no se vuelve a construir
   el DOM ni se pierde el estado de un arrastre a medias) y devuelve un
   `commit()` que anota UN solo paso de historial con el cambio
   acumulado durante toda la sesión —el mismo criterio de granularidad
   que ya usaban los diálogos modales con su botón Aplicar, sólo que
   aquí el gesto que confirma es dejar de tener la capa seleccionada,
   no pulsar un botón—.
   ═══════════════════════════════════════════════════════════════ */

import { on } from "../core/bus.js";
import { doc, activeLayer, layerIndex } from "../core/doc.js";
import { isAdjustLayer, mountAdjustProperties, adjustTypeName } from "../editor/adjustlayers.js";
import { isFillLayer, isShapeLayer, mountFillProperties, mountShapeProperties,
         fillKindName, SHAPE_KIND_NAME } from "../editor/layercontent.js";
import { blendIfEligible, isBlendIfActive, mountBlendIfEditor } from "../editor/blendif.js";
import { isText } from "../editor/text.js";
import { mountTextProperties } from "../editor/textprops.js";
import { mountMaskProperties } from "../editor/maskadjust.js";
import { filterOf } from "../editor/filterlayer.js";
import { knownFilter, filterLiveCapable, mountFilterEditor, openFilterEditor } from "../editor/filterregistry.js";
import { toast } from "./toast.js";

const body = document.getElementById("propsBody");
const empty = document.getElementById("propsEmpty");

let key;                // qué hay montado ahora mismo (undefined = nada aún)
let sessions = [];       // [{ session, layer, touched() }, ...] de la capa montada
let gen = 0;             // descarta un montaje en vuelo si la capa cambia antes de que termine

function fxEditableEntry(layer){
  if(!layer) return null;
  const entry = filterOf(layer);
  const chained = (layer.filters?.length || 0) > 1;
  if(!entry || !knownFilter(entry.id) || chained) return null;
  if(layer.type === "text" || isAdjustLayer(layer) || layer.type === "group") return null;
  if(layerIndex(layer.id) <= 0) return null;
  return entry;
}

function computeKey(layer){
  if(!layer) return null;
  const fx = fxEditableEntry(layer);
  return [layer.id, layer.type, layer.adjustType || "", fx ? fx.id : "", !!layer.mask, !!layer.blendIf].join("|");
}

/* Envoltorio visual de cada sección: un pequeño título y el cuerpo que
   monte la función correspondiente. `mount(container)` puede ser
   async (la de fx carga el módulo del filtro a demanda) y puede
   devolver `null` si al final no había nada que mostrar. */
/* Cada sesión recuerda de qué capa es y si el usuario llegó a tocar
   alguno de sus mandos. Sin esto, cambiar de capa activa —o deshacer
   el paso que creó la capa, que también la deja de tener activa—
   confirmaba la sesión igualmente: los filtros grababan un paso nuevo
   idéntico al que acababan de crear, cada clic en otra capa sumaba otro
   al historial, y ese paso de más vaciaba la pila de rehacer. Se
   escucha en el propio contenedor para que valga igual para
   deslizadores (input), desplegables y casillas (change) y lienzos que
   se arrastran, como el de Curvas (pointerup). */
const TOUCH_EVENTS = ["input", "change", "pointerup", "keyup"];

async function addSection(layer, title, mount){
  const wrap = document.createElement("div");
  wrap.className = "props-section";
  const h = document.createElement("div");
  h.className = "section-label";
  h.textContent = title;
  wrap.appendChild(h);
  const host = document.createElement("div");
  wrap.appendChild(host);

  let touched = false;
  const touch = () => { touched = true; };
  for(const t of TOUCH_EVENTS) host.addEventListener(t, touch, true);

  const session = await mount(host);
  if(!session){ wrap.remove(); return null; }
  body.appendChild(wrap);
  return { session, layer, touched: () => touched };
}

/* Único punto de confirmación: se llama al dejar de estar montada esta
   sesión —normalmente porque la capa activa cambió—, nunca durante.
   Cada `commit()` decide por sí mismo si de verdad hay algo que
   anotar (si no se tocó ningún mando, no deja un paso de historial
   vacío en el Ctrl+Z). */
async function commitAll(){
  const toCommit = sessions;
  sessions = [];
  for(const { session, layer, touched } of toCommit){
    try{
      // Sólo se confirma lo que el usuario cambió de verdad en el panel,
      // y sólo si la capa sigue en el documento: si se ha ido (p. ej.
      // al deshacer su creación), grabar algo sobre ella metería un paso
      // huérfano en el historial y borraría lo que se podía rehacer.
      if(touched() && doc.layers.includes(layer)) await session.commit();
      else if(session.cancel) await session.cancel();
    }
    catch(err){ console.error("[propiedades] fallo al confirmar", err); }
  }
}

/* «doc:structure» y «doc:active» pueden llegar los dos por el mismo
   gesto —crear una capa y activarla es un `addLayer` más un
   `setActive`—, y como esta función es async (espera a `commitAll`
   antes de decidir nada), una segunda llamada puede arrancar antes de
   que la primera haya actualizado `key`: las dos verían la clave
   vieja y montarían la sección por duplicado. Encadenarlas en una
   única promesa en vuelo hace que la segunda espere a que la primera
   termine de verdad antes de mirar `key`. */
let inFlight = Promise.resolve();
export function renderProperties(){
  inFlight = inFlight.then(renderPropertiesNow, err => { console.error("[propiedades]", err); return renderPropertiesNow(); });
  return inFlight;
}

async function renderPropertiesNow(){
  const layer = activeLayer();
  const nextKey = computeKey(layer);
  if(nextKey === key) return;   // misma capa, mismo contenido relevante: no tocar lo montado

  await commitAll();
  key = nextKey;
  body.innerHTML = "";
  const myGen = ++gen;

  if(!layer){ empty.hidden = false; return; }

  const wants = isAdjustLayer(layer) || isText(layer) || isFillLayer(layer) || isShapeLayer(layer) ||
                !!fxEditableEntry(layer) || !!layer.mask || !!layer.blendIf;
  if(!wants){ empty.hidden = false; return; }
  empty.hidden = true;

  const pending = [];

  if(isAdjustLayer(layer)){
    pending.push(addSection(layer, adjustTypeName(layer.adjustType), async host =>
      mountAdjustProperties(layer, host)));
  }
  if(isText(layer)){
    pending.push(addSection(layer, "Texto", async host => mountTextProperties(layer, host)));
  }
  if(isFillLayer(layer)){
    pending.push(addSection(layer, fillKindName(layer.fill?.kind), async host =>
      mountFillProperties(layer, host)));
  }
  if(isShapeLayer(layer)){
    pending.push(addSection(layer, SHAPE_KIND_NAME[layer.shape?.kind] || "Forma", async host =>
      mountShapeProperties(layer, host)));
  }
  const fx = fxEditableEntry(layer);
  if(fx){
    pending.push(addSection(layer, fx.name || fx.id, async host => {
      if(!filterLiveCapable(fx.id)){
        const btn = document.createElement("button");
        btn.textContent = "Editar « " + (fx.name || fx.id) + " »…";
        btn.addEventListener("click", () => {
          openFilterEditor(layer, fx).catch(err => {
            console.error(err);
            toast("No se pudo reabrir el filtro: " + err.message, "err");
          });
        });
        host.appendChild(btn);
        const hint = document.createElement("p");
        hint.className = "hint";
        hint.style.marginTop = "8px";
        hint.textContent = "Este filtro todavía se edita en su propio diálogo.";
        host.appendChild(hint);
        return { commit(){} };
      }
      return mountFilterEditor(layer, fx, host);
    }));
  }
  if(layer.mask){
    pending.push(addSection(layer, "Máscara", async host => mountMaskProperties(layer, host)));
  }
  if(layer.blendIf){
    pending.push(addSection(layer, "Fusionar si", async host => mountBlendIfEditor(layer, host)));
  }

  const results = await Promise.all(pending);
  if(myGen !== gen) return;   // la capa activa cambió mientras cargaba algún módulo de filtro
  sessions = results.filter(Boolean);
  if(!body.children.length) empty.hidden = false;
}

export function initProperties(){
  renderProperties();
  on("doc:active", renderProperties);
  on("doc:structure", renderProperties);
}
