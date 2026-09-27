/* Diálogos de análisis. Todos miden sobre el documento compuesto y
   aplanado, que es exactamente lo que se va a exportar. */

import { doc } from "../core/doc.js";
import { flatten } from "../editor/layertree.js";
import { dialog } from "../ui/dialog.js";
import { toast, status } from "../ui/toast.js";
import { measureAll, METRICS } from "./metrics.js";
import { runAll as runForensics, FORENSICS } from "./forensics.js";
import { spectrum, FN } from "./fft.js";

const col = v => v >= 0.70 ? "var(--ok)" : v >= 0.40 ? "var(--warn)" : "var(--bad)";

function bar(name, value, frac, note){
  return `<div class="metric">
    <div class="mlabel"><span>${name}</span><span class="mv">${value}</span></div>
    <div class="mbar"><i style="width:${Math.round(frac * 100)}%;background:${col(frac)}"></i></div>
    <p class="mnote">${note}</p>
  </div>`;
}

/* JPEG ya se ha aplicado al aceptar Realify. Medir una recompresión
   adicional introducía señales que el documento todavía no tenía. */
async function measurementCanvas(){
  return flatten();
}

export async function openMetrics(){
  if(!doc.open){ toast("No hay documento"); return; }
  status("Midiendo…");
  const view = await measurementCanvas();
  const res = measureAll(view);
  status("");

  const note = res.score >= 70
    ? "Los cinco indicios que esta herramienta sabe medir están en su sitio. No es una garantía frente a un detector concreto."
    : res.score >= 40
      ? "Parcial. Mira qué barra va corta y sube esa etapa del filtro."
      : "Faltan rasgos de captura. Aplica el filtro Realify y revisa el ruido de sensor y la micro-deformación.";

  dialog({
    title:"Plausibilidad", wide:true,
    body:
      `<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px">
         <span style="font-size:30px;font-family:var(--mono);color:${col(res.score/100)}">${res.score}</span>
         <small class="hint" style="margin:0">${note}</small>
       </div>` +
      METRICS.map(m => bar(m.name, m.fmt(res[m.k]), res[m.k].v, m.note)).join("") +
      `<div class="callout-note">Este panel mide justo los cinco rasgos que el filtro
         fabrica, así que por construcción tiende a darte la razón. La comprobación
         independiente está en «Segunda opinión».</div>`,
    buttons:[{ label:"Cerrar", primary:true }]
  });
}

export async function openForensics(){
  if(!doc.open){ toast("No hay documento"); return; }
  status("Segunda opinión…");
  const view = await measurementCanvas();

  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<p class="hint">Medidas locales de mosaico, recompresión y cuantización.
      Describen indicios del documento actual: no son detectores entrenados
      de IA ni permiten confirmar su origen fotográfico.</p>
     <div id="fList"></div>
     <canvas id="elaMap" style="width:100%;display:none;margin-top:6px;
       border:1px solid var(--line-soft);background:#0c1014"></canvas>
     <p class="mnote" id="elaCap" style="display:none">Mapa ELA: cuanto más uniforme,
       más coherente es el historial de compresión de toda la imagen.</p>`;

  const dlg = dialog({
    title:"Segunda opinión", wide:true, body: wrap,
    buttons:[{ label:"Cerrar", primary:true }]
  });

  const res = await runForensics(view, wrap.querySelector("#elaMap"));
  status("");
  wrap.querySelector("#fList").innerHTML = FORENSICS.map(f => {
    const d = res[f.k];
    return bar(f.name, f.fmt(d), d.v,
      `<b style="color:var(--tx)">${d.verdict}</b> · ${f.want}
       <span style="color:var(--tx-off)">(${f.sub})</span>`);
  }).join("");
  if(wrap.querySelector("#elaMap").style.display === "block")
    wrap.querySelector("#elaCap").style.display = "block";
  await dlg;
}

export async function openSpectrum(){
  if(!doc.open){ toast("No hay documento"); return; }
  const view = await measurementCanvas();

  const wrap = document.createElement("div");
  wrap.innerHTML =
    `<p class="hint">El espectro muestra periodicidades y distribución de frecuencias.
      Pueden proceder de generación, compresión, remuestreo o del propio contenido.
      Su presencia o ausencia no determina por sí sola si una imagen es de IA.</p>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
       <figure style="margin:0">
         <canvas id="spA" width="${FN}" height="${FN}"
           style="width:100%;background:#0c1014;border:1px solid var(--line-soft);
                  image-rendering:pixelated"></canvas>
         <figcaption class="mnote" style="text-align:center">Documento actual</figcaption>
       </figure>
       <figure style="margin:0">
         <canvas id="spB" width="${FN}" height="${FN}"
           style="width:100%;background:#0c1014;border:1px solid var(--line-soft);
                  image-rendering:pixelated"></canvas>
         <figcaption class="mnote" style="text-align:center">Recorte al 200 %</figcaption>
       </figure>
     </div>
     <p class="mnote">Recorte central de ${FN} px sin escalar: escalar promediaría
       justo las frecuencias donde vive la rejilla.</p>`;

  const dlg = dialog({
    title:"Espectro de frecuencia", wide:true, body: wrap,
    buttons:[{ label:"Cerrar", primary:true }]
  });

  requestAnimationFrame(() => {
    spectrum(view, view.width, view.height, wrap.querySelector("#spA"));
    // Segunda vista sobre un recorte más pequeño: la rejilla, si está,
    // se ve mejor cuanto menos promediado haya de por medio.
    const half = document.createElement("canvas");
    const s = Math.min(FN, view.width, view.height);
    half.width = s; half.height = s;
    half.getContext("2d").drawImage(view,
      (view.width - s) >> 1, (view.height - s) >> 1, s, s, 0, 0, s, s);
    spectrum(half, s, s, wrap.querySelector("#spB"));
  });
  await dlg;
}
