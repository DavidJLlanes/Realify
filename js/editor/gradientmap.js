/* ═══════════════════════════════════════════════════════════════
   MAPA DE DEGRADADO
   Sustituye cada píxel por un punto de un degradado de dos colores,
   según su propia luminosidad: lo más oscuro de la foto pasa al
   primer color, lo más claro al segundo, y todo lo de en medio se
   reparte por interpolación. Es la base de casi cualquier viraje
   de color en blanco y negro «con tinte».
   ═══════════════════════════════════════════════════════════════ */

import { runAdjust } from "./adjust.js";

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

function hexToRgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildGradientLut(darkHex, lightHex){
  const dark = hexToRgb(darkHex), light = hexToRgb(lightHex);
  const lut = new Array(256);
  for(let i = 0; i < 256; i++){
    const t = i / 255;
    lut[i] = [dark[0] + (light[0] - dark[0]) * t,
              dark[1] + (light[1] - dark[1]) * t,
              dark[2] + (light[2] - dark[2]) * t];
  }
  return lut;
}

export function gradientMap(opts = {}){
  const p = { dark: "#000000", light: "#ffffff", ...opts.init };

  return runAdjust({
    title: "Mapa de degradado",
    asLayer: true, filterId: "gradientMap", filterParams: p,
    compute(data){
      const lut = buildGradientLut(p.dark, p.light);
      for(let i = 0; i < data.length; i += 4){
        const l = Math.round(data[i] * 0.2126 + data[i+1] * 0.7152 + data[i+2] * 0.0722);
        const c = lut[l < 0 ? 0 : l > 255 ? 255 : l];
        data[i] = clamp255(c[0]); data[i+1] = clamp255(c[1]); data[i+2] = clamp255(c[2]);
      }
    },
    buildBody({ preview }){
      const box = document.createElement("div");
      box.innerHTML = `
        <div class="field"><label>Tono oscuro</label><input type="color" id="gmDark" value="${p.dark}"></div>
        <div class="field"><label>Tono claro</label><input type="color" id="gmLight" value="${p.light}"></div>
        <p class="hint" style="margin-top:10px">Lo más oscuro de la foto pasa al primer
          tono, lo más claro al segundo, y las medias luces se reparten entre los dos.
          Para un blanco y negro clásico, deja negro y blanco puros; para un viraje,
          prueba un azul oscuro y un crema claro.</p>`;
      box.querySelector("#gmDark").addEventListener("input", e => { p.dark = e.target.value; preview(); });
      box.querySelector("#gmLight").addEventListener("input", e => { p.light = e.target.value; preview(); });
      return box;
    }
  }, opts);
}
