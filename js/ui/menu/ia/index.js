/* ═══════════════════════════════════════════════════════════════
   MENÚ IA · ÁRBOL DEL MENÚ «Inteligencia Artificial»
   Junta los 13 submenús (un archivo cada uno) con las funciones nuevas de los manifiestos. Un submenú sin entradas no se muestra.
   Entradas: submenús + MANIFESTS. Salidas: IA_MENU (para MENUS), IA_SUBMENUS (id, label, items: para el cajón) y tabsOf(cmd).
   ═══════════════════════════════════════════════════════════════ */
import { MANIFESTS } from "./manifests.js";
import { SUBMENU as seleccionar } from "./seleccionar.js";
import { SUBMENU as borrar } from "./borrar.js";
import { SUBMENU as retrato } from "./retrato.js";
import { SUBMENU as cuerpo } from "./cuerpo.js";
import { SUBMENU as ropa } from "./ropa.js";
import { SUBMENU as escena } from "./escena.js";
import { SUBMENU as profundidad } from "./profundidad.js";
import { SUBMENU as mejorar } from "./mejorar.js";
import { SUBMENU as encuadre } from "./encuadre.js";
import { SUBMENU as color } from "./color.js";
import { SUBMENU as lote } from "./lote.js";
import { SUBMENU as asistente } from "./asistente.js";
import { SUBMENU as realismo } from "./realismo.js";

/* Orden del menú; cada subarray es un grupo (entre grupos va un separador). */
const GROUPS = [[seleccionar, borrar], [retrato, cuerpo, ropa],
  [escena, profundidad, mejorar, encuadre, color], [lote, asistente], [realismo]];

const entryOf = m => ({
  cmd: m.cmd, ic: m.icon, label: m.label.replace(/…$/, "") + (m.premium ? " Premium 👑…" : "…"),
  premium: !!m.premium, help: m.help || "", short: m.short, tabs: m.tabs || []
});

export const IA_SUBMENUS = GROUPS.flat()
  .map(s => ({ ...s, items: [...s.items, ...MANIFESTS.filter(m => m.submenu === s.id).map(entryOf)] }))
  .filter(s => s.items.length);

const byId = new Map(IA_SUBMENUS.map(s => [s.id, s]));
const rows = [];
for(const g of GROUPS){
  const ss = g.map(s => byId.get(s.id)).filter(Boolean);
  if(!ss.length) continue;
  if(rows.length) rows.push({ sep:true });
  for(const s of ss) rows.push({ label:s.label, submenu:s.items, iaId:s.id, flattenAsHeader:true });
}

export const IA_MENU = { label:"Inteligencia Artificial", items:rows };

/** Pestañas afines de una función nueva (campo `tabs` del manifiesto); vacío para las que ya existían. */
export const tabsOf = cmd => MANIFESTS.find(m => m.cmd === cmd)?.tabs || [];
