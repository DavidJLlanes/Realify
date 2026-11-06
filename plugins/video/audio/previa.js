/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · SONIDO DE LA VISTA PREVIA
   Al reproducir, mezcla el proyecto en ventanas de 8 s (a 24 kHz, para no gastar memoria) y las programa una tras otra en un AudioContext, sin huecos. Parar (o buscar) cancela todo.
   Entradas: { proyecto():obj, lectorDe(idMedio), duracion():seg }. Salida: { iniciar(t), parar(), cerrar() }. `iniciar` espera a tener la primera ventana lista y devuelve cuándo
   suena (para alinear el reloj de vídeo). Sin audio en el proyecto no hace nada. Límite: el sonido va con un pequeño retardo de arranque (~una ventana de mezcla).
   ═══════════════════════════════════════════════════════════════ */
import { mezclarVentana } from "./mezclador.js";
import { hayAudio } from "./mezcla.js";

const VENTANA = 8, TASA = 24000;

export function crearSonidoPrevia({ proyecto, lectorDe, duracion }){
  let ctx = null, gen = 0, fuentes = [];
  const parar = () => { gen++; for(const f of fuentes) try{ f.stop(); }catch{} fuentes = []; };
  async function ventana(t, g, cuando){
    const fin = Math.min(duracion(), t + VENTANA); if(fin <= t || g !== gen) return;
    const m = await mezclarVentana({ proyecto: proyecto(), lectorDe, desde: t, hasta: fin, tasa: TASA }); if(g !== gen) return;
    const buf = ctx.createBuffer(2, m.canales[0].length, TASA); buf.copyToChannel(m.canales[0], 0); buf.copyToChannel(m.canales[1], 1);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); const c = Math.max(cuando, ctx.currentTime + 0.02); src.start(c); fuentes.push(src);
    src.onended = () => { fuentes = fuentes.filter(f => f !== src); };
    if(fin < duracion()) setTimeout(() => ventana(fin, g, c + (fin - t)), Math.max(0, (c + (fin - t) - ctx.currentTime - 3) * 1000));   // la siguiente se prepara 3 s antes
  }
  return {
    async iniciar(t){
      parar(); if(!hayAudio(proyecto())) return false; ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); await ctx.resume?.();
      const g = ++gen; await ventana(t, g, 0); return g === gen;
    },
    parar,
    cerrar(){ parar(); try{ ctx?.close(); }catch{} ctx = null; }
  };
}
