/* ═══════════════════════════════════════════════════════════════
   AYUDA · ACERCA DE
   Ficha de la aplicación: nombre, versión, qué es y a dónde ir para
   el resto (aviso legal, privacidad, actualizaciones). Se carga bajo
   demanda, como la guía y los textos legales.
   La versión pública (`release`) y la compilación salen de
   version.json y de la página cargada; si no hay red se enseña sólo
   la compilación.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "../kit/dialog.js";
import { loadedVersion } from "../../core/pwa-updates.js";
import { escText as esc } from "../../core/util/html.js";

const CONTACT = "djl@djl.red";
const SITE = "https://realify.es";

/** Versión pública publicada (version.json) o null si no se puede leer. */
async function publicRelease(){
  try{
    const url = new URL("./version.json", document.baseURI);
    url.searchParams.set("about", Date.now());
    const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if(!res.ok) return null;
    const data = await res.json();
    return typeof data.release === "string" ? data.release : null;
  }catch{ return null; }
}

const FEATURES = [
  ["🔒", "Privado por diseño", "Todo se procesa en tu equipo. Sin cuenta, sin analítica y sin subir tus imágenes a ningún servidor."],
  ["📷", "Hecho para fotografía", "Capas, revelado RAW, ajustes y filtros de cámara, IA que se ejecuta en tu dispositivo, panorámicas, HDR y más."],
  ["📲", "Funciona sin conexión", "Se instala como aplicación (PWA) en móvil y escritorio y sigue funcionando sin internet."]
];

function body(release, build){
  const ver = release
    ? `Versión <b>${esc(release)}</b>${build ? ` · compilación ${build}` : ""}`
    : (build ? `Compilación ${build}` : "Versión desconocida");
  return `<div class="about">
    <div class="about-head">
      <img class="about-logo" src="assets/android-96.webp" alt="" width="64" height="64">
      <div>
        <div class="about-name">Realify</div>
        <div class="about-tag">Editor de imágenes en el navegador</div>
        <div class="about-ver" data-about="ver">${ver}</div>
      </div>
    </div>
    <div class="about-feats">
      ${FEATURES.map(([ic, t, d]) => `<div class="about-feat"><span aria-hidden="true">${ic}</span><div><b>${t}</b><small>${d}</small></div></div>`).join("")}
    </div>
    <p class="about-note">El filtro Realify reproduce el recorrido físico de la luz —óptica, sensor, procesador y códec— sobre imágenes generadas, para investigación sobre detectores, trabajo artístico y prueba de defensas propias. Sólo los modelos de IA grandes se descargan de un tercero (Hugging Face), y únicamente si los usas.</p>
    <div class="about-links">
      <button type="button" data-about-go="help.update">Buscar actualización</button>
      <button type="button" data-about-go="help.guide">Guía</button>
      <button type="button" data-about-go="help.legal">Aviso legal</button>
      <button type="button" data-about-go="help.privacy">Privacidad</button>
    </div>
    <div class="about-foot">Un proyecto de David · <a href="${SITE}" target="_blank" rel="noopener">realify.es</a> · <a href="mailto:${CONTACT}">${CONTACT}</a></div>
  </div>`;
}

export function openAbout(){
  const build = loadedVersion();
  return dialog({
    title: "Acerca de Realify",
    cls: "dlg-about",
    body: body(null, build),
    buttons: [{ label: "Cerrar", primary: true }],
    onOpen: (el, { close }) => {
      publicRelease().then(r => {
        const v = el.querySelector('[data-about="ver"]');
        if(r && v) v.innerHTML = `Versión <b>${esc(r)}</b>${build ? ` · compilación ${build}` : ""}`;
      });
      el.addEventListener("click", async e => {
        const cmd = e.target.closest("[data-about-go]")?.dataset.aboutGo;
        if(!cmd) return;
        close(null);
        (await import("../../core/commands.js")).run(cmd);
      });
    }
  });
}
