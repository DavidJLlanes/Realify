/* ═══════════════════════════════════════════════════════════════
   AVISO DE COMPATIBILIDAD
   Tras arrancar, comprueba lo que el editor necesita de verdad y que
   algunos navegadores bloquean sin decir nada:

     · Lectura del lienzo: Firefox con la protección estricta contra
       rastreo o «resistFingerprinting» (y LibreWolf, Mullvad, Tor…)
       devuelve los píxeles en blanco o con ruido. Un editor de fotos
       vive de leer píxeles: los filtros no harían nada y lo exportado
       saldría vacío o alterado.
     · WebGL2: lo usan Realify, el revelador y parte de la IA. Firefox
       lo desactiva con algunos drivers de tarjeta gráfica.
     · Almacenamiento: sin él no se recuerdan los ajustes ni se guardan
       los modelos de IA descargados (hay que bajarlos cada vez).

   Si algo falla, una barra (igual en móvil y escritorio) dice qué pasa
   y cómo arreglarlo, con «Copiar diagnóstico» (js/boot-guard.js). Los
   fallos graves se avisan siempre; los leves, una vez por sesión.
   ═══════════════════════════════════════════════════════════════ */

const isFirefox = () => /firefox|librewolf|waterfox/i.test(navigator.userAgent || "");

/* Pinta colores conocidos y los lee: deben volver exactos */
function canvasReadback(){
  try{
    const c = document.createElement("canvas"); c.width = 8; c.height = 8;
    const x = c.getContext("2d", { willReadFrequently: true });
    const cols = [[10, 200, 30], [250, 5, 120], [60, 60, 60], [0, 128, 255]];
    cols.forEach(([r, g, b], i) => { x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect((i % 2) * 4, (i >> 1) * 4, 4, 4); });
    const d = x.getImageData(0, 0, 8, 8).data;
    let bad = 0, white = 0;
    for(let i = 0; i < 64; i++){
      const px = i % 8, py = i >> 3, [r, g, b] = cols[(px >= 4 ? 1 : 0) + (py >= 4 ? 2 : 0)], j = i * 4;
      if(Math.abs(d[j] - r) > 1 || Math.abs(d[j + 1] - g) > 1 || Math.abs(d[j + 2] - b) > 1) bad++;
      if(d[j] === 255 && d[j + 1] === 255 && d[j + 2] === 255) white++;
    }
    if(!bad) return "ok";
    return white > 56 ? "blocked" : "noisy";
  }catch{ return "blocked"; }
}

function webgl2(){
  try{ return !!document.createElement("canvas").getContext("webgl2"); }catch{ return false; }
}

function storage(){
  try{ localStorage.setItem("realify.probe", "1"); localStorage.removeItem("realify.probe"); return true; }catch{ return false; }
}

/* Lista de problemas encontrados: { level: "grave"|"leve", title, text, steps[] } */
export function checkCompat(){
  const ff = isFirefox(), out = [];
  const cv = canvasReadback();
  if(cv !== "ok") out.push({ level: "grave",
    title: cv === "blocked" ? "El navegador está bloqueando la lectura de imágenes" : "El navegador está alterando los píxeles de las imágenes",
    text: "Es una protección contra el rastreo («huella digital» del lienzo). En un editor de fotos impide que funcionen los filtros y que se exporte bien.",
    steps: ff ? ["Pulsa el escudo que hay a la izquierda de la dirección (realify.es) y desactiva la «Protección contra rastreo» para esta web; después recarga.",
                 "Si Firefox te ha preguntado si permites «extraer datos de imagen del canvas», responde «Permitir» (y marca «Recordar»).",
                 "Con «resistFingerprinting» activado (about:config) o en LibreWolf/Mullvad, añade realify.es a las excepciones o usa otro navegador para editar."]
               : ["Desactiva para realify.es la protección contra huellas digitales o el «canvas blocker» de tu navegador o extensión, y recarga."] });
  if(!webgl2()) out.push({ level: "leve",
    title: "WebGL2 no está disponible",
    text: "Algunas funciones (Realify, el revelador, parte de la IA) necesitan la aceleración gráfica.",
    steps: ff ? ["Ajustes de Firefox › General › Rendimiento: activa «Usar aceleración por hardware cuando esté disponible» y reinicia Firefox.",
                 "Actualiza el driver de la tarjeta gráfica: Firefox desactiva WebGL con algunos drivers antiguos.",
                 "En about:config, «webgl.disabled» debe estar en false."]
               : ["Activa la aceleración por hardware en los ajustes del navegador y actualiza el driver de la tarjeta gráfica."] });
  if(!storage()) out.push({ level: "leve",
    title: "El navegador no deja guardar datos de esta web",
    text: "La app funciona, pero no recordará tus ajustes y los modelos de IA se volverán a descargar cada vez.",
    steps: ff ? ["Pulsa el candado o el escudo junto a la dirección y permite cookies y datos del sitio para realify.es.",
                 "En una ventana privada es normal: ábrela en una ventana normal para que se guarde."]
               : ["Permite cookies y datos del sitio para realify.es (o usa una ventana normal, no privada)."] });
  return out;
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Enseña la barra si hace falta. Los avisos leves, una vez por sesión. */
export function showCompatNotice(){
  let problems = checkCompat();
  if(!problems.length) return;
  let seen = false;
  try{ seen = sessionStorage.getItem("realify.compatSeen") === "1"; }catch{}
  if(seen) problems = problems.filter(p => p.level === "grave");
  if(!problems.length) return;
  try{ sessionStorage.setItem("realify.compatSeen", "1"); }catch{}

  const bar = document.createElement("section");
  bar.className = "compat-bar" + (problems.some(p => p.level === "grave") ? " grave" : "");
  bar.setAttribute("role", "status");
  bar.innerHTML = `
    <div class="compat-head"><b>${esc(problems[0].title)}${problems.length > 1 ? ` <span>(+${problems.length - 1})</span>` : ""}</b>
      <button type="button" class="compat-close" aria-label="Cerrar">✕</button></div>
    <details><summary>Cómo arreglarlo</summary>
      ${problems.map(p => `<p><b>${esc(p.title)}.</b> ${esc(p.text)}</p><ol>${p.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`).join("")}
      <button type="button" class="compat-copy">Copiar diagnóstico</button>
    </details>`;
  bar.querySelector(".compat-close").addEventListener("click", () => bar.remove());
  bar.querySelector(".compat-copy").addEventListener("click", e => {
    const text = window.__realifyDiag ? window.__realifyDiag(problems.map(p => "Aviso: " + p.title)) : problems.map(p => p.title).join("\n");
    if(window.__realifyCopyDiag) window.__realifyCopyDiag(text, e.currentTarget);
  });
  document.body.appendChild(bar);
}
