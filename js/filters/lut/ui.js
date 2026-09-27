/* Panel de la tabla de color. La lógica pura vive en engine.js: así
   se puede probar en Node sin arrastrar el DOM, igual que hace
   PurePixel. */

import { runAdjust, slider } from "../../editor/adjust.js";
import { toast } from "../../ui/toast.js";
import { parseCube, applyCubeLut } from "./engine.js";

const MAX_BYTES = 40 * 1024 * 1024;   // una 3D de 256³ en texto ronda los 30 MB

/* Tablas ya cargadas en esta sesión, por nombre de archivo: la capa
   sólo guarda el nombre, así que reabrir el filtro o recalcularlo al
   X % sólo es posible mientras la tabla siga en memoria. */
const CACHE = new Map();

export async function openLut(opts = {}){
  /* `lut` queda FUERA de lo que se anota en la capa: los parámetros
     se serializan al guardar el proyecto, y una tabla 3D de 33³ son
     107.000 números que engordarían el archivo sin aportar nada.
     Con el nombre y la intensidad basta para saber qué se aplicó. */
  const state = { intensity: 100, name: "", ...opts.init };
  let lut = state.name ? CACHE.get(state.name) || null : null;
  if(opts.render && !lut) throw new Error("La tabla de color no está cargada en esta sesión");

  return runAdjust({
    title: "Tabla de color (LUT)",
    asLayer: true, filterId: "lut",
    filterParams: state,
    compute(data){
      if(lut) applyCubeLut(data, lut, state.intensity);
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <p class="hint" style="margin-top:0">Carga un archivo <b>.cube</b> de los que usa
          cualquier programa de etalonaje. Se aplica sobre la capa activa y el resultado
          va a una capa nueva.</p>
        <div class="field">
          <label for="lutFile">Archivo</label>
          <input type="file" id="lutFile" accept=".cube,text/plain" class="grow">
        </div>
        <p class="hint mono" id="lutInfo" style="margin:6px 0 10px">${lut ? `${state.name} · ${lut.dim}D de ${lut.size}${lut.dim === 3 ? "³" : ""}` : state.name ? `${state.name} no está cargada en esta sesión: vuelve a elegir el archivo.` : "Ninguna tabla cargada."}</p>`;

      const info = box.querySelector("#lutInfo");
      box.appendChild(slider("Intensidad", 0, 100, Math.round(state.intensity),
        v => { state.intensity = v; preview(); }, "%"));

      box.querySelector("#lutFile").addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if(!file) return;
        if(file.size > MAX_BYTES){
          info.textContent = "El archivo es demasiado grande para ser una tabla de color.";
          return;
        }
        try{
          lut = parseCube(await file.text());
          state.name = file.name;
          CACHE.set(file.name, lut);
          info.textContent = `${file.name} · ${lut.dim}D de ${lut.size}` +
            (lut.dim === 3 ? `³ (${lut.size ** 3} entradas)` : ` entradas`);
          preview();
        }catch(error){
          lut = null;
          info.textContent = `No se pudo leer: ${error.message}`;
          toast("La tabla de color no es válida", "err");
          preview();
        }
      });
      return box;
    }
  }, opts);
}
