/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · MOTOR DE FOTOGRAMAS (sin DOM propio)
   Para un instante t: por cada pista de vídeo (de abajo arriba) toma el clip que suena, decodifica su fotograma (caché LRU), le pasa los efectos activos del clip en orden y lo dibuja
   encajado («contain», con barras negras) sobre el lienzo de salida. Todo lo que toca el DOM llega por `fabrica` ({ lienzo(w,h), dibujar(destino, origen, x, y, w, h), rellenar(destino, color) }),
   así se prueba en Node con una fabricación falsa. Entradas: { proyecto():obj, abrirLector(idMedio, ancho)→lector, efectos, fabrica, cacheMax }. Salidas: fotograma(t,{ancho,alto}) → lienzo; cerrar().
   Un efecto que falla se salta y se anota en `errores` (el vídeo sigue). Un medio que no se puede abrir deja ese clip en negro.
   ═══════════════════════════════════════════════════════════════ */
import { clipEn, tiempoEnMedio } from "../project/modelo.js";
import { crearCache } from "./cache.js";

export function crearMotor({ proyecto, abrirLector, efectos, fabrica, cacheMax = 8, alLiberar = () => {} }){
  const lectores = new Map(), instancias = new Map(), cache = crearCache(cacheMax, alLiberar), errores = [];
  const lector = (id, ancho) => { const k = id + "@" + ancho; if(!lectores.has(k)) lectores.set(k, abrirLector(id, ancho).catch(e => { lectores.delete(k); errores.push(`medio ${id}: ${e.message || e}`); return null; })); return lectores.get(k); };
  async function aplicarEfectos(clip, lienzo, t, ancho, alto){
    for(const e of clip.efectos || []){
      if(e.activo === false) continue;
      const k = clip.id + "|" + e.id; let inst = instancias.get(k);
      try{
        if(inst === undefined){ inst = await efectos.instanciar(e.efecto, { ancho, alto, fps: proyecto().salida.fps }); instancias.set(k, inst); }
        if(inst) lienzo = (await inst.process(lienzo, e.params || {}, t)) || lienzo;
      }catch(err){ errores.push(`efecto ${e.efecto}: ${err.message || err}`); instancias.set(k, null); }
    }
    return lienzo;
  }
  return {
    errores,
    async fotograma(t, { ancho, alto }){
      const p = proyecto(), salida = fabrica.lienzo(ancho, alto); fabrica.rellenar(salida, "#000");
      for(const pista of p.pistas){
        if(pista.tipo !== "video") continue;
        const clip = clipEn(pista, t); if(!clip) continue;
        const l = await lector(clip.medio, ancho); if(!l) continue;
        const tm = tiempoEnMedio(clip, t), k = `${clip.medio}@${ancho}|${Math.round(tm * (p.medios[clip.medio]?.fps || 30))}`;
        let f = cache.get(k); if(!f){ f = await l.fotograma(tm); if(!f) continue; cache.set(k, f); }
        const lienzo = await aplicarEfectos(clip, f.lienzo, t, ancho, alto), s = Math.min(ancho / lienzo.width, alto / lienzo.height), w = lienzo.width * s, h = lienzo.height * s;
        fabrica.dibujar(salida, lienzo, (ancho - w) / 2, (alto - h) / 2, w, h);
      }
      return salida;
    },
    async cerrar(){
      for(const inst of instancias.values()) try{ inst?.dispose?.(); }catch{}
      instancias.clear(); cache.clear();
      for(const pr of lectores.values()) try{ (await pr)?.cerrar?.(); }catch{}
      lectores.clear();
    }
  };
}
