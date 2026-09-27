/* ═══════════════════════════════════════════════════════════════
   BUS DE EVENTOS
   Los módulos no se importan entre sí para hablarse: publican y
   escuchan. Así el panel de capas no necesita saber que existe el
   filtro Realify, ni al revés, y se pueden añadir piezas nuevas sin
   tocar las viejas.
   ═══════════════════════════════════════════════════════════════ */

const listeners = new Map();

export function on(event, fn){
  if(!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn){
  const set = listeners.get(event);
  if(set) set.delete(fn);
}

export function emit(event, payload){
  const set = listeners.get(event);
  if(!set) return;
  // Copia antes de recorrer: un manejador puede darse de baja a sí
  // mismo, y modificar el Set mientras se itera se salta al siguiente.
  for(const fn of [...set]){
    try{ fn(payload); }
    catch(err){ console.error(`[bus] fallo en «${event}»:`, err); }
  }
}

/* Agrupa ráfagas de eventos en uno solo por fotograma. Arrastrar un
   deslizador lanza decenas de «doc:change» por segundo y repintar en
   todos es tirar trabajo a la basura. */
export function onFrame(event, fn){
  let queued = false, last = null;
  return on(event, payload => {
    last = payload;
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(last); });
  });
}
