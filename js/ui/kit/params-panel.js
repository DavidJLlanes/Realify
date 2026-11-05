/* ═══════════════════════════════════════════════════════════════
   MANDOS DESDE `params` · esquema único de los parámetros de una función de IA
   Cada función declara sus parámetros UNA vez, en su manifiesto (4.2 del plan). De ese esquema salen los mandos del diálogo
   simple y los del editor a pantalla completa, y también lo que valida el asistente (Fase 14) y las pruebas de seguridad
   por perfil (F6.9). Este archivo es sólo DATOS y cálculo (sin DOM): no dibuja nada. Quien dibuja es mountControls (fsshell.js)
   en los editores y simple-panel.js (js/features/ai-kit) en los diálogos simples.

   Un parámetro:  { key, label, type, def, group?, only?, ranges?, …lo propio del tipo }
     type    "range" (min, max, step, unit) · "toggle" · "seg" o "select" (options: [[valor, texto]…]) · "color" · "number"
     group   id del grupo (sección) al que pertenece en un editor; sin grupo → "general"
     only    perfiles que lo tienen (p. ej. ["hombre", "mujer"]); sin `only`, lo tienen todos
     ranges  rango propio por perfil: { nino: [min, max] } (sustituye a min y max para ese perfil)
   Entradas: la lista de parámetros y, si hace falta, el perfil.  Salidas: copias nuevas; nunca se modifica el original.
   ═══════════════════════════════════════════════════════════════ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** ¿Tiene el perfil este parámetro? */
export const appliesTo = (p, profile) => !p.only || !profile || p.only.includes(profile);

/** Parámetros que existen para el perfil, con su rango ya ajustado. */
export function paramsFor(params, profile = null){
  return params.filter(p => appliesTo(p, profile)).map(p => {
    const r = profile && p.ranges && p.ranges[profile];
    return r ? { ...p, min: r[0], max: r[1] } : { ...p };
  });
}

/** Valores por defecto { clave: def } de los parámetros del perfil. */
export function defaultsOf(params, profile = null){
  const out = {};
  for(const p of paramsFor(params, profile)) out[p.key] = p.def !== undefined ? p.def : p.type === "toggle" ? false : p.type === "text" ? "" : p.type === "range" ? (p.min ?? 0) : "";
  return out;
}

/** Valida y recorta valores contra el esquema del perfil.
    Devuelve { values, rejected }: `values` sólo lleva claves que existen para el perfil y dentro de su rango;
    `rejected` lista las claves que no existen para ese perfil (p. ej. «pecho» en un perfil infantil) o no son válidas. */
export function validate(params, values, profile = null){
  const ok = new Map(paramsFor(params, profile).map(p => [p.key, p]));
  const out = {}, rejected = [];
  for(const [k, v] of Object.entries(values || {})){
    const p = ok.get(k);
    if(!p){ rejected.push(k); continue; }
    if(p.type === "range" || p.type === "number"){
      if(typeof v !== "number" || !Number.isFinite(v)){ rejected.push(k); continue; }
      out[k] = clamp(v, p.min ?? -Infinity, p.max ?? Infinity);
    } else if(p.type === "text"){
      if(typeof v !== "string"){ rejected.push(k); continue; }
      out[k] = v.slice(0, p.max || 200);
    } else if(p.type === "toggle"){
      if(typeof v !== "boolean"){ rejected.push(k); continue; }
      out[k] = v;
    } else if(p.type === "seg" || p.type === "select"){
      const opts = typeof p.options === "function" ? p.options() : p.options;
      if(!opts.some(o => String(o[0]) === String(v))){ rejected.push(k); continue; }
      out[k] = v;
    } else out[k] = v;
  }
  return { values: out, rejected };
}

/** Del esquema a las `sections` que entiende mountControls (fsshell.js).
    `groups`: [{ id, label }] en el orden en que se muestran; los parámetros sin grupo van al primero. Los grupos vacíos
    para el perfil no aparecen (un perfil sin parámetros de «pecho» no ve el grupo «Torso» vacío). */
export function toSections(params, groups, profile = null){
  const list = paramsFor(params, profile);
  const first = groups[0]?.id ?? "general";
  const byGroup = new Map(groups.map(g => [g.id, []]));
  for(const p of list){
    const id = p.group && byGroup.has(p.group) ? p.group : first;
    if(!byGroup.has(id)) byGroup.set(id, []);
    const { group, only, ranges, ...prop } = p;
    byGroup.get(id).push(prop);
  }
  return groups.filter(g => byGroup.get(g.id)?.length).map(g => ({ id: g.id, label: g.label, props: byGroup.get(g.id) }));
}
