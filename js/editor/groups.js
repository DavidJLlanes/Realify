/* ═══════════════════════════════════════════════════════════════
   GRUPOS DE CAPAS
   Un grupo es una capa más (type:"group", ver core/doc.js) sin
   contenido propio: agrupa por convención de vecindad, no por
   estructura de árbol en el array —los miembros llevan `groupId` y
   el grupo se sitúa, de abajo a arriba, justo encima del más alto de
   ellos—. editor/layertree.js es quien reconstruye la jerarquía real
   a partir de ese campo para componer o exportar; este módulo sólo se
   ocupa de mantener esa convención al crear, deshacer, mover, borrar
   o duplicar grupos, para que el panel de capas siga viéndose como
   una carpeta contigua y no como miembros sueltos con una cabecera
   flotando en cualquier sitio.
   ═══════════════════════════════════════════════════════════════ */

import { doc, makeLayer, layerIndex } from "../core/doc.js";
import { buildLayerTree, compositeTree } from "./layertree.js";
import { record } from "../core/history.js";
import { emit } from "../core/bus.js";

let groupSeq = 0;

/* El propio id más todos sus descendientes (recursivo, para grupos
   anidados): el «bloque» que se mueve, borra o duplica junto. */
export function subtreeIds(id){
  const out = new Set([id]);
  const walk = pid => {
    for(const l of doc.layers) if(l.groupId === pid){
      out.add(l.id);
      if(l.type === "group") walk(l.id);
    }
  };
  walk(id);
  return out;
}

function findNode(nodes, id){
  for(const n of nodes){
    if(n.layer.id === id) return n;
    if(n.children){ const f = findNode(n.children, id); if(f) return f; }
  }
  return null;
}

/* Agrupa las capas dadas (pueden estar en niveles distintos, incluso
   ser grupos ya existentes —eso anida—) en un grupo nuevo. El grupo
   nace en el nivel y la posición de la más alta de ellas; el resto se
   saca de donde estuviera y se reinserta junto a ella, en su mismo
   orden relativo original. */
export function groupLayers(ids){
  if(!doc.open) return null;
  const selected = doc.layers.filter(l => ids.includes(l.id));
  if(!selected.length) return null;

  const before = doc.layers.slice();
  const beforeActive = doc.activeId;
  // Agrupar MUTA `groupId` sobre las propias capas seleccionadas —no
  // son copias—, así que `before` (un slice del array) comparte esos
  // mismos objetos con `after` y no basta por sí solo para deshacer:
  // hace falta guardar también el valor de `groupId` de cada una
  // ANTES de tocarlo, y reaplicarlo a mano al deshacer.
  const beforeGroupIds = new Map(doc.layers.map(l => [l.id, l.groupId]));

  const topMost = selected.reduce((a, b) => layerIndex(a.id) > layerIndex(b.id) ? a : b);
  const parentGroupId = topMost.groupId ?? null;
  const insertAt = layerIndex(topMost.id);

  const header = makeLayer({ name: "Grupo " + (++groupSeq), type: "group" });
  header.groupId = parentGroupId;

  const selectedIds = new Set(selected.map(l => l.id));
  const orderedSelected = doc.layers.filter(l => selectedIds.has(l.id));
  orderedSelected.forEach(l => { l.groupId = header.id; });

  const restBefore = doc.layers.slice(0, insertAt).filter(l => !selectedIds.has(l.id));
  const restAfter  = doc.layers.slice(insertAt).filter(l => !selectedIds.has(l.id));
  doc.layers = [...restBefore, ...orderedSelected, header, ...restAfter];
  doc.activeId = header.id;

  const after = doc.layers.slice();
  const afterGroupIds = new Map(doc.layers.map(l => [l.id, l.groupId]));
  record("Agrupar capas",
    () => {
      doc.layers = before; doc.activeId = beforeActive;
      for(const l of doc.layers) if(beforeGroupIds.has(l.id)) l.groupId = beforeGroupIds.get(l.id);
      emit("doc:structure"); emit("doc:change");
    },
    () => {
      doc.layers = after; doc.activeId = header.id;
      for(const l of doc.layers) if(afterGroupIds.has(l.id)) l.groupId = afterGroupIds.get(l.id);
      emit("doc:structure"); emit("doc:change");
    });
  emit("doc:structure"); emit("doc:change");
  return header;
}

/* Deshace un grupo: sus miembros pasan al nivel del propio grupo (el
   de fuera) conservando su orden, y la cabecera desaparece. Los
   miembros NO se tocan más allá de su `groupId`: siguen exactamente
   donde estaban unos respecto a otros. */
export function ungroupLayers(groupId){
  const header = doc.layers.find(l => l.id === groupId && l.type === "group");
  if(!header) return false;

  const before = doc.layers.slice();
  const beforeActive = doc.activeId;
  // Mismo motivo que en groupLayers: `groupId` se muta sobre las
  // propias capas, así que hace falta su propio mapa de antes/después
  // aparte del array (ver comentario allí).
  const beforeGroupIds = new Map(doc.layers.map(l => [l.id, l.groupId]));

  const parentGroupId = header.groupId;
  for(const l of doc.layers) if(l.groupId === header.id) l.groupId = parentGroupId;
  doc.layers = doc.layers.filter(l => l.id !== header.id);
  if(!doc.layers.find(l => l.id === doc.activeId)){
    doc.activeId = doc.layers[doc.layers.length - 1]?.id ?? null;
  }

  const after = doc.layers.slice();
  const afterActive = doc.activeId;
  const afterGroupIds = new Map(doc.layers.map(l => [l.id, l.groupId]));
  record("Desagrupar",
    () => {
      doc.layers = before; doc.activeId = beforeActive;
      for(const l of doc.layers) if(beforeGroupIds.has(l.id)) l.groupId = beforeGroupIds.get(l.id);
      emit("doc:structure"); emit("doc:change");
    },
    () => {
      doc.layers = after; doc.activeId = afterActive;
      for(const l of doc.layers) if(afterGroupIds.has(l.id)) l.groupId = afterGroupIds.get(l.id);
      emit("doc:structure"); emit("doc:change");
    });
  emit("doc:structure"); emit("doc:change");
  return true;
}

/* Borra el grupo Y su contenido entero (miembros y subgrupos), como
   una sola operación de historial. Sin esto, borrar sólo la cabecera
   por la vía genérica de doc.js dejaría a sus miembros huérfanos. */
export function removeGroupAndContents(groupId){
  const header = doc.layers.find(l => l.id === groupId && l.type === "group");
  if(!header) return false;

  const doomed = subtreeIds(header.id);
  const remaining = doc.layers.filter(l => !doomed.has(l.id));
  if(!remaining.length) return false;   // siempre tiene que quedar una capa

  const before = doc.layers.slice();
  const beforeActive = doc.activeId;
  doc.layers = remaining;
  doc.activeId = doc.layers[doc.layers.length - 1].id;

  const after = doc.layers.slice();
  const afterActive = doc.activeId;
  record("Eliminar grupo",
    () => { doc.layers = before; doc.activeId = beforeActive; emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = after;  doc.activeId = afterActive;  emit("doc:structure"); emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
  return true;
}

/* Duplica un grupo entero —con sus subgrupos, máscaras, estilos y
   ajustes propios de cada miembro— justo encima del original. Recorre
   el árbol real (no el array plano) para poder clonar cada cabecera
   ANTES que sus hijos: un hijo necesita el id NUEVO de su grupo para
   poder apuntar a él. */
export function duplicateGroup(groupId){
  const header = doc.layers.find(l => l.id === groupId && l.type === "group");
  if(!header) return null;
  const tree = buildLayerTree(doc.layers);
  const node = findNode(tree, header.id);
  if(!node) return null;

  const cloneOne = (l, newGroupId) => {
    const c = makeLayer({ name: l.name, type: l.type });
    c.visible = l.visible; c.opacity = l.opacity; c.blend = l.blend; c.locked = l.locked;
    c.groupId = newGroupId;
    c.clipped = l.clipped;
    c.collapsed = l.collapsed;
    c.styles = l.styles ? JSON.parse(JSON.stringify(l.styles)) : null;
    c.filters = (l.filters || []).map(f => ({ ...f, params: { ...f.params } }));
    c.smart = l.smart;
    c.dodgeBurn = l.dodgeBurn;
    c.smartTransform = l.smartTransform ? JSON.parse(JSON.stringify(l.smartTransform)) : null;
    c.smartBox = l.smartBox ? { ...l.smartBox } : null;
    if(l.smart && l.smartSource){
      const sc = document.createElement("canvas");
      sc.width = l.smartSource.width; sc.height = l.smartSource.height;
      sc.getContext("2d").drawImage(l.smartSource, 0, 0);
      c.smartSource = sc;
    }
    if(l.type !== "group") c.ctx.drawImage(l.canvas, 0, 0);
    if(l.adjustType){ c.adjustType = l.adjustType; c.adjustParams = JSON.parse(JSON.stringify(l.adjustParams || {})); }
    if(l.text) c.text = JSON.parse(JSON.stringify(l.text));
    if(l.mask){
      const mc = document.createElement("canvas");
      mc.width = l.mask.canvas.width; mc.height = l.mask.canvas.height;
      mc.getContext("2d").drawImage(l.mask.canvas, 0, 0);
      c.mask = { canvas: mc, ctx: mc.getContext("2d", { willReadFrequently:true, colorSpace:"srgb" }) };
    }
    c.maskEnabled = l.maskEnabled;
    return c;
  };

  const flatClones = [];
  const cloneTree = (n, newParentGroupId) => {
    const clone = cloneOne(n.layer, newParentGroupId);
    if(n.children){
      for(const child of n.children) cloneTree(child, clone.id);
    }
    flatClones.push(clone);
    return clone;
  };

  const before = doc.layers.slice();
  const beforeActive = doc.activeId;
  const newHeader = cloneTree(node, header.groupId);
  const insertAt = layerIndex(header.id) + 1;
  doc.layers.splice(insertAt, 0, ...flatClones);
  doc.activeId = newHeader.id;

  const after = doc.layers.slice();
  record("Duplicar grupo",
    () => { doc.layers = before; doc.activeId = beforeActive; emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = after;  doc.activeId = newHeader.id; emit("doc:structure"); emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
  return newHeader;
}

/* Sube o baja una capa o un grupo ENTERO (con todo su contenido) un
   puesto respecto a sus hermanas del mismo nivel —nunca cruza el
   borde de su grupo, para no descuadrar la convención de contigüidad
   de la que depende el panel—. Sustituye a doc.js#moveLayer para
   cualquier documento que tenga grupos; para uno sin ninguno, el
   resultado es idéntico a un intercambio simple. */
export function moveLayerOrGroup(id, delta){
  const target = doc.layers.find(l => l.id === id);
  if(!target) return false;
  const siblings = doc.layers.filter(l => l.groupId === target.groupId);
  const i = siblings.findIndex(l => l.id === id);
  const j = i + delta;
  if(j < 0 || j >= siblings.length) return false;
  const other = siblings[j];

  const idsA = subtreeIds(target.id), idsB = subtreeIds(other.id);
  const idxA = [], idxB = [];
  doc.layers.forEach((l, k) => { if(idsA.has(l.id)) idxA.push(k); else if(idsB.has(l.id)) idxB.push(k); });
  const lo = Math.min(...idxA, ...idxB), hi = Math.max(...idxA, ...idxB);
  const blockA = idxA.map(k => doc.layers[k]);
  const blockB = idxB.map(k => doc.layers[k]);
  // De abajo a arriba: moverse "hacia arriba" (delta>0) pone el
  // vecino que estaba encima a quedar debajo del bloque que se mueve.
  const newOrder = delta > 0 ? [...blockB, ...blockA] : [...blockA, ...blockB];

  const before = doc.layers.slice();
  doc.layers.splice(lo, hi - lo + 1, ...newOrder);

  const after = doc.layers.slice();
  record("Reordenar capas",
    () => { doc.layers = before; emit("doc:structure"); emit("doc:change"); },
    () => { doc.layers = after;  emit("doc:structure"); emit("doc:change"); });
  emit("doc:structure"); emit("doc:change");
  return true;
}

/* «Recortar a la capa de abajo»: alterna `clipped` en una capa. */
export function toggleClip(id){
  const l = doc.layers.find(x => x.id === id);
  if(!l) return null;
  const before = l.clipped;
  l.clipped = !before;
  record(l.clipped ? "Recortar a la capa de abajo" : "Quitar recorte",
    () => { l.clipped = before;  emit("doc:change"); },
    () => { l.clipped = !before; emit("doc:change"); });
  emit("doc:change");
  return l.clipped;
}

/* Plegar/desplegar en el panel: puro estado de interfaz, no entra en
   el historial de deshacer —igual que hacerlo con el resto de
   secciones plegables de la app—. */
export function toggleCollapsed(id){
  const l = doc.layers.find(x => x.id === id && x.type === "group");
  if(!l) return;
  l.collapsed = !l.collapsed;
  emit("doc:structure");
}
