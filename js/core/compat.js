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

/* Comprueba la lectura de píxeles sin confundir pequeñas diferencias
   normales de color/renderizado con una protección anti-fingerprinting.

   Estrategia:
     1) escribe dos patrones RGB opacos directamente con putImageData();
     2) lee cada patrón tres veces;
     3) compara contra los bytes originales y entre lecturas;
     4) sólo avisa si la alteración es clara y repetible.

   putImageData/getImageData evita que la propia gestión de color del
   navegador (sRGB/P3, GPU, redondeos de fillStyle, etc.) se interprete
   como manipulación de píxeles. Esta prueba NO toca ninguna foto ni el
   pipeline de edición: usa un canvas temporal de 16 × 16. */
function canvasReadback(){
  try{
    const W = 16, H = 16, PX = W * H;

    function makePattern(seed){
      const a = new Uint8ClampedArray(PX * 4);
      let s = seed >>> 0;
      for(let i = 0; i < PX; i++){
        // PRNG determinista: colores muy variados, siempre opacos.
        s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0;
        s = Math.imul(s ^ (s >>> 13), 3266489917) >>> 0;
        s ^= s >>> 16;
        const j = i * 4;
        a[j]     = 8  + (s        & 239);
        a[j + 1] = 8  + ((s >> 8) & 239);
        a[j + 2] = 8  + ((s >>16) & 239);
        a[j + 3] = 255;
        s = (s + 0x9e3779b9 + i) >>> 0;
      }
      return a;
    }

    function run(seed){
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const x = c.getContext("2d", { willReadFrequently: true });
      if(!x) return { blocked:true };

      const expected = makePattern(seed);
      x.putImageData(new ImageData(expected, W, H), 0, 0);

      const reads = [];
      for(let n = 0; n < 3; n++) reads.push(x.getImageData(0, 0, W, H).data);

      let changedPx = 0, severePx = 0, maxDelta = 0, blankPx = 0;
      let unstablePx = 0;

      for(let i = 0; i < PX; i++){
        const j = i * 4;
        let pxChanged = false, pxSevere = false, pxUnstable = false;
        const d = reads[0];

        if((d[j] === 255 && d[j+1] === 255 && d[j+2] === 255) ||
           (d[j] === 0 && d[j+1] === 0 && d[j+2] === 0)) blankPx++;

        for(let k = 0; k < 3; k++){
          const delta = Math.abs(d[j+k] - expected[j+k]);
          if(delta > maxDelta) maxDelta = delta;
          if(delta > 2) pxChanged = true;
          if(delta > 8) pxSevere = true;

          const d12 = Math.abs(reads[0][j+k] - reads[1][j+k]);
          const d13 = Math.abs(reads[0][j+k] - reads[2][j+k]);
          if(d12 > 1 || d13 > 1) pxUnstable = true;
        }
        if(pxChanged) changedPx++;
        if(pxSevere) severePx++;
        if(pxUnstable) unstablePx++;
      }

      return {
        blocked: blankPx > PX * 0.94,
        changedRatio: changedPx / PX,
        severeRatio: severePx / PX,
        unstableRatio: unstablePx / PX,
        maxDelta
      };
    }

    const a = run(0x13579bdf), b = run(0x2468ace0);
    if(a.blocked || b.blocked) return "blocked";

    /* Diferencias minúsculas y estables (pocos píxeles, delta <= 2)
       se consideran comportamiento normal del motor gráfico. Para
       declarar manipulación exigimos evidencia fuerte en AMBOS tests,
       o ruido que cambie entre lecturas consecutivas. */
    const unstable = a.unstableRatio > 0.01 && b.unstableRatio > 0.01;
    const altered = a.changedRatio > 0.05 && b.changedRatio > 0.05 &&
                    (a.severeRatio > 0.01 || b.severeRatio > 0.01 ||
                     a.maxDelta > 8 || b.maxDelta > 8);

    return (unstable || altered) ? "noisy" : "ok";
  }catch{
    return "blocked";
  }
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
    text: "Realify ha verificado una alteración repetible de la lectura de píxeles del lienzo. En un editor de fotos puede afectar a filtros y exportaciones que necesiten leer esos píxeles.",
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
