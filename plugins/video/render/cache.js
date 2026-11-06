/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · CACHÉ LRU DE FOTOGRAMAS (puro, sin DOM)
   Guarda los últimos N fotogramas decodificados para no decodificar dos veces el mismo al pausar, volver atrás o repintar. Al sacar uno llama a `liberar` (cerrar un ImageBitmap, etc.).
   Entradas: capacidad y función liberar. Salida: get/set/clear/tamano. Límite: capacidad en fotogramas (no en bytes).
   ═══════════════════════════════════════════════════════════════ */
export function crearCache(capacidad = 8, liberar = () => {}){
  const m = new Map();
  return {
    get(k){ if(!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
    set(k, v){ if(m.has(k)) liberar(m.get(k)); m.delete(k); m.set(k, v); while(m.size > capacidad){ const [k0, v0] = m.entries().next().value; m.delete(k0); liberar(v0); } },
    clear(){ for(const v of m.values()) liberar(v); m.clear(); },
    tamano: () => m.size
  };
}
