/* Avisos efímeros. En escritorio van a la barra de estado, que está
   siempre visible; en móvil no hay barra de estado, así que salen
   como píldora sobre el lienzo. */

const el   = document.getElementById("toast");
const stMsg = document.getElementById("stMsg");
const pill = document.getElementById("msgPill");

let timer = null, pillTimer = null;

export function toast(msg, kind = ""){
  if(!msg) return;
  el.textContent = msg;
  el.className = "show " + kind;
  clearTimeout(timer);
  timer = setTimeout(() => { el.className = kind; }, kind === "err" ? 4200 : 2400);
  status(msg);
}

export function status(msg){
  if(stMsg) stMsg.textContent = msg || "";
  if(pill){
    pill.textContent = msg || "";
    pill.classList.toggle("show", !!msg);
    clearTimeout(pillTimer);
    if(msg) pillTimer = setTimeout(() => pill.classList.remove("show"), 2400);
  }
}

/* Barra de progreso para las operaciones largas (lotes, filtros
   pesados). Sin esto la página parece colgada. */
const bar = document.getElementById("progress");
let progressTimer = null;
export function progress(frac){
  /* Una operación nueva puede empezar durante los 320 ms de salida de la
     anterior. El temporizador viejo no debe poner la barra a cero a mitad
     de la operación nueva. */
  if(progressTimer){ clearTimeout(progressTimer); progressTimer = null; }
  if(frac === null || frac === undefined){
    bar.style.width = "100%";
    bar.classList.add("done");
    progressTimer = setTimeout(() => {
      progressTimer = null;
      bar.style.width = "0";
      bar.classList.remove("done");
    }, 320);
    return;
  }
  bar.classList.remove("done");
  bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + "%";
}
