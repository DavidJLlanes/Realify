/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · REGISTRO DE EFECTOS (puro, sin DOM)
   El motor no conoce ningún efecto: los descubre aquí por su manifiesto (docs/VIDEO.md, 6.1). Un manifiesto es { id, version, nombre, params:[…], carga: () => import(módulo) } y el módulo
   exporta crear() → { prepare(ctx), process(frame, params, t), dispose() }. `frame` es un lienzo; process devuelve un lienzo (el mismo u otro). Añadir un efecto = una carpeta en effects/
   y una línea en effects/lista.js; el motor no cambia. Entradas: manifiestos. Salidas: instancias preparadas y cacheadas por clip.
   ═══════════════════════════════════════════════════════════════ */
export function crearRegistroEfectos(){
  const manifiestos = new Map();
  return {
    registrar(m){ if(!m || !m.id || typeof m.carga !== "function") throw new Error("Manifiesto de efecto inválido"); if(manifiestos.has(m.id)) throw new Error("Efecto repetido: " + m.id); manifiestos.set(m.id, m); },
    lista: () => [...manifiestos.values()],
    tiene: id => manifiestos.has(id),
    manifiesto: id => manifiestos.get(id) || null,
    /** Crea y prepara una instancia. Si el efecto no existe (proyecto de otro equipo) devuelve null y el motor lo salta. */
    async instanciar(id, ctx){
      const m = manifiestos.get(id); if(!m) return null;
      const mod = await m.carga(), inst = mod.crear(); await inst.prepare?.(ctx); return inst;
    }
  };
}
