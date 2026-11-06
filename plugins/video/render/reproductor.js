/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · REPRODUCTOR DE PREVISUALIZACIÓN (sin DOM propio)
   Reloj → fotograma. Al reproducir calcula t con el reloj (no con el número de fotogramas), así que si renderizar un fotograma tarda más que su duración, SALTA fotogramas y no se retrasa.
   Nunca hay dos renders a la vez: mientras uno corre, sólo se recuerda el último instante pedido. Entradas: { motor, duracion():seg, pintar(lienzo, t), ancho, alto, ahora(), programar(fn) }.
   Salida: { play, pause, alternar, buscar(t), tiempo(), reproduciendo(), cerrar() }. `ahora` y `programar` se inyectan (performance.now y requestAnimationFrame en el navegador).
   ═══════════════════════════════════════════════════════════════ */
export function crearReproductor({ motor, duracion, pintar, ancho, alto, ahora, programar, alCambiar = () => {} }){
  let t = 0, reproduciendo = false, t0 = 0, desde = 0, ocupado = false, pendiente = null, muerto = false;
  async function dibujar(x){
    if(ocupado){ pendiente = x; return; }
    ocupado = true;
    try{ const l = await motor.fotograma(x, { ancho, alto }); if(!muerto) pintar(l, x); }catch(e){ /* el motor ya anota sus errores */ }
    ocupado = false;
    if(pendiente !== null){ const p = pendiente; pendiente = null; await dibujar(p); }
  }
  function bucle(){
    if(!reproduciendo || muerto) return;
    const d = duracion(); t = Math.min(d, desde + (ahora() - t0) / 1000);
    if(t >= d){ reproduciendo = false; alCambiar(); }
    dibujar(Math.min(t, Math.max(0, d - 1e-3))); alCambiar();
    if(reproduciendo) programar(bucle);
  }
  return {
    play(){ if(reproduciendo || muerto) return; if(t >= duracion() - 1e-3) t = 0; desde = t; t0 = ahora(); reproduciendo = true; alCambiar(); programar(bucle); },
    pause(){ reproduciendo = false; alCambiar(); },
    alternar(){ reproduciendo ? this.pause() : this.play(); },
    buscar(x){ t = Math.max(0, Math.min(x, duracion())); desde = t; t0 = ahora(); alCambiar(); return dibujar(Math.min(t, Math.max(0, duracion() - 1e-3))); },
    tiempo: () => t, reproduciendo: () => reproduciendo,
    cerrar(){ muerto = true; reproduciendo = false; }
  };
}
