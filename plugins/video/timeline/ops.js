/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · OPERACIONES DE LA LÍNEA DE TIEMPO (puras, sin DOM)
   Cada operación recibe un proyecto y devuelve OTRO (nunca modifica el original; lo que no cambia se comparte). Si no se puede (solape, tramo vacío…) lanza
   un Error con el motivo en español, y el proyecto queda como estaba. Tiempos en segundos; mínimo de un clip = 1 fotograma.
   Entradas: proyecto y datos de la operación. Salida: proyecto nuevo.
   ═══════════════════════════════════════════════════════════════ */
import { buscarClip, duracionClip, finClip, nuevoId, crearClip } from "../project/modelo.js";

const EPS = 1e-9;
const min = p => 1 / (p.salida.fps || 30);

function cambiarClip(p, idClip, fn){
  const r = buscarClip(p, idClip); if(!r) throw new Error("No existe ese clip");
  const nuevo = fn(r.clip, r.pista);
  const clips = nuevo === null ? r.pista.clips.filter(c => c.id !== idClip) : r.pista.clips.map(c => c.id === idClip ? nuevo : c);
  return { ...p, pistas: p.pistas.map(t => t === r.pista ? { ...t, clips } : t) };
}
function sinSolape(pista, candidatos, ignorar = null){
  const otros = pista.clips.filter(c => !ignorar || !ignorar.includes(c.id)), todos = [...otros, ...candidatos].sort((a, b) => a.inicio - b.inicio);
  for(let i = 1; i < todos.length; i++) if(todos[i].inicio < finClip(todos[i - 1]) - EPS) throw new Error("Los clips no pueden solaparse en la misma pista");
}

/** Divide el clip en el instante t de la línea de tiempo. Los efectos se copian a las dos mitades (con ids nuevos en la segunda). */
export function dividir(p, idClip, t){
  const r = buscarClip(p, idClip); if(!r) throw new Error("No existe ese clip");
  const c = r.clip;
  if(t <= c.inicio + min(p) - EPS || t >= finClip(c) - min(p) + EPS) throw new Error("Corta dentro del clip, a más de un fotograma de los bordes");
  const corte = c.dentro + (t - c.inicio) * c.velocidad, a = { ...c, fuera: corte };
  const b = { ...c, id: nuevoId("c"), inicio: t, dentro: corte, efectos: c.efectos.map(e => ({ ...e, id: nuevoId("e") })) };
  const clips = r.pista.clips.flatMap(x => x.id === idClip ? [a, b] : [x]);
  return { ...p, pistas: p.pistas.map(tr => tr === r.pista ? { ...tr, clips } : tr) };
}

/** Recorta por un borde: `borde` = "inicio" | "fin", `t` = nuevo instante de ese borde en la línea de tiempo. */
export function recortar(p, idClip, borde, t){
  return cambiarClip(p, idClip, (c, pista) => {
    let n;
    if(borde === "inicio"){ const dentro = c.dentro + (t - c.inicio) * c.velocidad; n = { ...c, inicio: t, dentro }; if(dentro < -EPS) throw new Error("No hay más vídeo por delante"); n.dentro = Math.max(0, dentro); }
    else { const fuera = c.dentro + (t - c.inicio) * c.velocidad; n = { ...c, fuera }; const m = p.medios[c.medio]; if(m && m.duracion && fuera > m.duracion + EPS) throw new Error("No hay más vídeo por detrás"); }
    if(duracionClip(n) < min(p) - EPS) throw new Error("El clip no puede durar menos de un fotograma");
    sinSolape(pista, [n], [c.id]); return n;
  });
}

/** Mueve el clip a otro instante (y, si se indica, a otra pista del mismo tipo). */
export function mover(p, idClip, inicio, idPista = null){
  if(inicio < -EPS) throw new Error("El clip no puede empezar antes de 0");
  const r = buscarClip(p, idClip); if(!r) throw new Error("No existe ese clip");
  const destino = idPista ? p.pistas.find(t => t.id === idPista) : r.pista;
  if(!destino) throw new Error("No existe esa pista"); if(destino.tipo !== r.pista.tipo) throw new Error("Ese clip no cabe en una pista de otro tipo");
  const n = { ...r.clip, inicio: Math.max(0, inicio) }; sinSolape(destino, [n], [idClip]);
  return { ...p, pistas: p.pistas.map(t => t === r.pista && t === destino ? { ...t, clips: t.clips.map(c => c.id === idClip ? n : c) } : t === r.pista ? { ...t, clips: t.clips.filter(c => c.id !== idClip) } : t === destino ? { ...t, clips: [...t.clips, n] } : t) };
}

export const eliminar = (p, idClip) => cambiarClip(p, idClip, () => null);

/** Duplica el clip justo detrás (o en `inicio` si se da). */
export function duplicar(p, idClip, inicio = null){
  const r = buscarClip(p, idClip); if(!r) throw new Error("No existe ese clip");
  const n = { ...r.clip, id: nuevoId("c"), inicio: inicio ?? finClip(r.clip), efectos: r.clip.efectos.map(e => ({ ...e, id: nuevoId("e") })) };
  sinSolape(r.pista, [n]); return { ...p, pistas: p.pistas.map(t => t === r.pista ? { ...t, clips: [...t.clips, n] } : t) };
}

/** Cambia la velocidad (0,25×–8×). Mantiene el inicio; si el clip alargado choca con el siguiente, se rechaza. */
export function cambiarVelocidad(p, idClip, v){
  if(!(v >= 0.25 && v <= 8)) throw new Error("La velocidad debe estar entre 0,25× y 8×");
  return cambiarClip(p, idClip, (c, pista) => { const n = { ...c, velocidad: v }; if(duracionClip(n) < min(p) - EPS) throw new Error("Con esa velocidad el clip duraría menos de un fotograma"); sinSolape(pista, [n], [c.id]); return n; });
}

export function ponerEfecto(p, idClip, efecto, params = {}, version = 1){
  return cambiarClip(p, idClip, c => ({ ...c, efectos: [...c.efectos, { id: nuevoId("e"), efecto, version, params: { ...params }, activo: true }] }));
}
export const quitarEfecto = (p, idClip, idEfecto) => cambiarClip(p, idClip, c => ({ ...c, efectos: c.efectos.filter(e => e.id !== idEfecto) }));
export function ajustarEfecto(p, idClip, idEfecto, cambios){
  return cambiarClip(p, idClip, c => { if(!c.efectos.some(e => e.id === idEfecto)) throw new Error("No existe ese efecto"); return { ...c, efectos: c.efectos.map(e => e.id === idEfecto ? { ...e, ...cambios, params: { ...e.params, ...(cambios.params || {}) } } : e) }; });
}
/** Añade un clip nuevo de un medio al final de una pista. */
export function anadirClip(p, idPista, idMedio, { dentro = 0, fuera = null } = {}){
  const t = p.pistas.find(x => x.id === idPista), m = p.medios[idMedio]; if(!t || !m) throw new Error("Pista o medio inexistente");
  const c = crearClip({ medio: idMedio, inicio: t.clips.reduce((x, k) => Math.max(x, finClip(k)), 0), dentro, fuera: fuera ?? m.duracion });
  return { ...p, pistas: p.pistas.map(x => x === t ? { ...x, clips: [...x.clips, c] } : x) };
}
