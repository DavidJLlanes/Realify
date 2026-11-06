/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · RENDERIZAR AL CLIP O AL PROYECTO COMPLETO (sin DOM propio)
   Recorre los fotogramas de [desde, hasta) a `fps`, los pide al motor a la resolución de salida y los entrega al codificador. Informa del progreso, se puede cancelar con una señal (AbortSignal)
   y cierra siempre el codificador si falla o se cancela. Entradas: { motor, codificador:{ anadir(lienzo, t, duracion), cerrar(), cancelar() }, ancho, alto, fps, desde, hasta, alProgreso(n,total), senal }.
   Salida: lo que devuelva codificador.cerrar() (un Blob). Lanza Error con `cancelado:true` si se cancela.
   ═══════════════════════════════════════════════════════════════ */
export async function renderizar({ motor, codificador, ancho, alto, fps, desde = 0, hasta, alProgreso = () => {}, senal = null }){
  const total = Math.max(1, Math.round((hasta - desde) * fps));
  try{
    for(let n = 0; n < total; n++){
      if(senal?.aborted) throw Object.assign(new Error("Exportación cancelada"), { cancelado: true });
      const lienzo = await motor.fotograma(desde + n / fps, { ancho, alto });
      await codificador.anadir(lienzo, n / fps, 1 / fps); alProgreso(n + 1, total);
    }
    return await codificador.cerrar();
  }catch(e){ try{ await codificador.cancelar?.(); }catch{} throw e; }
}
