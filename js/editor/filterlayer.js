/* ═══════════════════════════════════════════════════════════════
   FILTROS COMO CAPA
   Un filtro ya no sobrescribe los píxeles de la capa a la que se
   aplica: deja su resultado en una capa nueva justo encima y anota
   en ella qué lo produjo. Tres cosas salen gratis de ahí:

   · el original sigue intacto debajo, así que arrepentirse no
     depende de que el historial siga teniendo ese paso;
   · la opacidad y el modo de fusión dosifican el efecto después,
     sin volver a calcularlo;
   · enmascarar esa capa aplica el filtro POR ZONAS, que era la
     única manera de tratar distinto una cara o unas manos sin
     recortarlas antes a mano.

   La anotación va en `layer.filters`, el array que el modelo ya
   traía y que hasta ahora nadie escribía: el panel de capas
   pintaba su insignia «fx» contando un array siempre vacío. Ahora
   lleva algo, y por eso la insignia significa algo.

   Sobre el historial: aplicar el filtro es un paso deshacible, como
   cualquier otra capa nueva. Lo que se guarda es la lista de capas
   entera, como en «Combinar visibles», que es el patrón que ya usa el
   proyecto para los pasos que cambian la estructura (ver
   `recordLayers` en core/history.js).
   ═══════════════════════════════════════════════════════════════ */

import { doc, makeLayer, layerIndex } from "../core/doc.js";
import { record } from "../core/history.js";
import { cloneMask } from "./masks.js";
import { emit } from "../core/bus.js";

/* Nombre corto y sin repetir: «Desenfoque gaussiano», y si ya hay
   una, «Desenfoque gaussiano 2». Con varios filtros encadenados, una
   pila de capas llamadas todas igual no se puede leer. */
function uniqueName(base){
  const taken = new Set(doc.layers.map(l => l.name));
  if(!taken.has(base)) return base;
  for(let n = 2; ; n++){
    const candidate = `${base} ${n}`;
    if(!taken.has(candidate)) return candidate;
  }
}

/**
 * Deja `result` en una capa nueva encima de `base`.
 *
 * @param {object}  o.base    capa filtrada; la nueva va justo encima
 * @param {Canvas}  o.result  lienzo con el resultado ya calculado
 * @param {string}  o.title   nombre del filtro, para capa e historial
 * @param {string}  o.filter  identificador estable del filtro
 * @param {object}  o.params  ajustes con que se obtuvo, para reabrirlo
 * @returns {object|null} la capa creada
 */
export function addFilterLayer({ base, result, title, filter, params = {} }){
  if(!doc.open || !base || !result) return null;

  const prevLayers = doc.layers.slice();
  const prevActive = doc.activeId;

  const layer = makeLayer({ name: uniqueName(title) });
  layer.ctx.drawImage(result, 0, 0);
  /* Se hereda la máscara de la capa de origen: si el usuario ya había
     acotado dónde trabajar, el filtro tiene que respetar ese mismo
     recorte, no volver a cubrir la imagen entera. */
  if(base.mask){
    layer.mask = cloneMask(base.mask);
    layer.maskEnabled = base.maskEnabled;
  }
  layer.filters = [{ id: filter, name: title, params: structuredClone(params), amount: 100, enabled: true }];

  const nextLayers = prevLayers.slice();
  nextLayers.splice(layerIndex(base.id) + 1, 0, layer);

  doc.layers = nextLayers.slice();
  doc.activeId = layer.id;

  record(title,
    () => { doc.layers = prevLayers.slice(); doc.activeId = prevActive;
            emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = nextLayers.slice(); doc.activeId = layer.id;
            emit("doc:structure"); emit("doc:change"); });

  emit("doc:structure"); emit("doc:change");
  return layer;
}

/* Capa de efecto «sólo mezcla»: el resultado de una herramienta que no
   se puede recalcular (la IA: caras, borrador mágico, profundidad,
   cielo…). Tiene su porcentaje de aplicación como cualquier capa de
   filtro, que aquí MEZCLA el resultado con la capa de debajo (100 % =
   el resultado, 0 % = el original), sin volver a ejecutar nada; la
   insignia fx no reabre ningún panel. Ver panels.js y filteramount.js. */
export function markMixLayer(layer, name){
  if(!layer) return layer;
  layer.filters = [{ id: "mix:" + name, name, params: {}, amount: 100, enabled: true, mix: true }];
  layer._fxFull = null;
  return layer;
}

/* Lo que produjo una capa, si lo produjo un filtro. Sirve para
   reabrir el diálogo con los ajustes que se usaron en vez de con los
   de fábrica. */
export const filterOf = layer =>
  layer?.filters?.length ? layer.filters[layer.filters.length - 1] : null;

/* La capa de la que se calculó el filtro: la de justo debajo. Es la
   convención de `addFilterLayer` y no se guarda ningún id porque, si
   el usuario reordena, lo que espera es que el filtro se recalcule
   sobre lo que ahora tenga debajo. */
export function filterBase(layer){
  const i = layerIndex(layer.id);
  return i > 0 ? doc.layers[i - 1] : null;
}

/* Porcentaje de aplicación del filtro (0..100). Distinto de la
   opacidad: no funde el resultado con el original, sino que vuelve a
   calcular el filtro con sus valores escalados. Ver filteramount.js. */
export const filterAmount = layer => {
  const f = filterOf(layer);
  const a = f ? f.amount : undefined;
  return Number.isFinite(a) ? Math.max(0, Math.min(100, a)) : 100;
};

const copyInto = (layer, canvas) => {
  const x = layer.ctx;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "copy";
  x.drawImage(canvas, 0, 0);
  x.restore();
  layer.thumbDirty = true;
};
const snapshotOf = layer => {
  const c = document.createElement("canvas");
  c.width = layer.canvas.width; c.height = layer.canvas.height;
  c.getContext("2d").drawImage(layer.canvas, 0, 0);
  return c;
};

/**
 * Sustituye el contenido de una capa de filtro ya existente por un
 * resultado nuevo y anota los parámetros con que se obtuvo. Es lo que
 * hace «Guardar cambios» al reabrir un filtro desde su insignia fx:
 * misma capa, mismos máscara/opacidad/fusión, un paso de historial.
 * El porcentaje de aplicación vuelve a 100: los parámetros nuevos son
 * los que el usuario acaba de ver en pantalla.
 *
 * Sólo tiene sentido cuando la capa lleva UN filtro (la insignia «fx»
 * deja de ser reeditable con el diálogo completo en cuanto se encadena
 * un segundo): con más de uno, recalcular la vista previa de este
 * diálogo tendría que conocer el resto de la cadena, y ningún panel de
 * filtro sabe hacer eso todavía. Con la cadena se ajusta cada entrada
 * por separado con su interruptor y su porcentaje — ver
 * editor/filterchain.js. panels.js es quien no ofrece este camino
 * cuando `layer.filters.length > 1`. */
export function replaceFilterLayer({ layer, result, title, filter, params = {} }){
  if(!doc.open || !layer || !result) return null;
  const before = snapshotOf(layer);
  const prevFilters = structuredClone(layer.filters || []);
  const after = result;
  const nextFilters = prevFilters.slice();
  const entry = { id: filter, name: title, params: structuredClone(params), amount: 100, enabled: true };
  if(nextFilters.length) nextFilters[nextFilters.length - 1] = entry; else nextFilters.push(entry);

  const put = (snap, filters) => {
    copyInto(layer, snap);
    layer.filters = structuredClone(filters);
    layer._fxFull = null;
    emit("doc:structure"); emit("doc:change");
  };
  put(after, nextFilters);
  record(title, () => put(before, prevFilters), () => put(after, nextFilters));
  return layer;
}

/**
 * Una sola puerta para los dos casos: si `edit` es una capa de filtro,
 * se sustituye su contenido (sólo tiene sentido con un único filtro,
 * ver `replaceFilterLayer`); si no, se crea una capa nueva encima de
 * `base`, una por efecto. Todos los filtros terminan aquí.
 */
export function commitFilter({ base, edit = null, result, title, filter, params = {} }){
  if(edit) return replaceFilterLayer({ layer: edit, result, title, filter, params });
  /* Cada filtro, su propia capa. Antes, al aplicar un segundo filtro
     sobre una capa que ya era de filtro, se ENCADENABA dentro de ella
     (ver `appendFilterToLayer`): quedaban dos efectos compartiendo una
     sola capa, con una lista de filas dentro de la fila de capa y sin
     manera de moverlos, enmascararlos ni dosificarlos por separado.
     Una capa por efecto es lo que se espera: cada una con su opacidad,
     su máscara, su modo de fusión y su propio porcentaje de
     aplicación, y se pueden reordenar arrastrando como cualquier otra. */
  return addFilterLayer({ base, result, title, filter, params });
}
