/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · REGISTRO CON RESPALDO (puro, sin DOM)
   Lo comparten decodificadores y codificadores: cada proveedor se registra con un id y una prioridad, y `elegir` prueba en orden hasta dar con uno que sirva (soporta()
   puede ser asíncrono). Si ninguno sirve devuelve null con los motivos, para que la interfaz lo explique en vez de fallar en silencio.
   Entradas: proveedores { id, prioridad, soporta(datos) }. Salidas: { proveedor, motivos:[texto] }.
   ═══════════════════════════════════════════════════════════════ */
export function crearRegistro(){
  const lista = [];
  return {
    registrar(p){ if(lista.some(x => x.id === p.id)) throw new Error("Proveedor repetido: " + p.id); lista.push({ prioridad: 0, ...p }); lista.sort((a, b) => b.prioridad - a.prioridad); },
    ids: () => lista.map(p => p.id),
    async elegir(datos, { excluir = [] } = {}){
      const motivos = [];
      for(const p of lista){
        if(excluir.includes(p.id)) continue;
        try{ if(await p.soporta(datos)) return { proveedor: p, motivos }; motivos.push(`${p.id}: no lo soporta`); }
        catch(e){ motivos.push(`${p.id}: ${e.message || e}`); }
      }
      return { proveedor: null, motivos };
    }
  };
}
