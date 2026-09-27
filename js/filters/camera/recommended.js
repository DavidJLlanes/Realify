/* ═══════════════════════════════════════════════════════════════
   AJUSTE RECOMENDADO
   Mide la imagen y propone una cadena de captura para ella. El cálculo
   vive en `ui.js` (`computeRecommendation`); aquí sólo se conecta el
   botón.

   Antes esto orquestaba un servicio local de optimización adversaria
   —trabajos remotos, sondeo, cancelación, dos modelos detectores—, y
   por eso arrastraba un `AbortController`, un botón de detener y un
   hilo de progreso. Ese servicio nunca formó parte del proyecto, así
   que en la práctica la petición siempre fallaba y se caía a este
   mismo cálculo local: toda aquella maquinaria asíncrona no llegaba a
   usarse nunca. Al ser ahora un cálculo inmediato y sin red, no hay
   nada que esperar ni que cancelar.
   ═══════════════════════════════════════════════════════════════ */

export function wireRecommendation(body, { recommend, before, accept, after }){
  const q = selector => body.querySelector(selector);
  const start = q("#cdRec"), info = q("#cdRecInfo");
  let measured = false;

  /* Tocar cualquier control después de medir invalida lo propuesto: el
     texto dejaría de describir lo que hay en pantalla. */
  const changed = () => {
    if(!measured) return;
    info.textContent = "Los ajustes han cambiado. Pulsa Ajuste recomendado para volver a medir.";
    measured = false;
  };
  body.addEventListener("input", changed);
  body.addEventListener("change", changed);
  body.addEventListener("click", event => {
    if(event.target.closest("#cdAll,#cdVary,#cdNewSeed,.csolo")) changed();
  });

  start.addEventListener("click", () => {
    q("#cdRecRow").hidden = false;
    before();
    try{
      const { state, report } = recommend();
      accept({ state });
      /* Lo medido y lo decidido, en una línea: un ajuste que no dice
         de dónde sale no se puede revisar, sólo aceptar a ciegas. */
      info.textContent = "Medido: " + (report || []).join(" · ") +
        ". Revísalo y pulsa Aplicar para conservarlo.";
      measured = true;
    }catch(error){
      info.textContent = `No se pudo calcular el ajuste: ${error.message}`;
      measured = false;
    }finally{
      after();
    }
  });
}
