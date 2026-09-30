/* ═══════════════════════════════════════════════════════════════
   TRANSPARENCIA AL GUARDAR
   Una sola regla para toda la web:
     · Lo que se guarda en un archivo sin capas es el acoplado de las
       capas VISIBLES (lo que se ve).
     · PNG, WebP, AVIF y GIF admiten transparencia: se conserva si el
       usuario lo deja marcado (por defecto, sí).
     · JPEG y PDF no la admiten: las zonas transparentes se rellenan con
       un color de fondo que se puede elegir (blanco por defecto). Antes
       el navegador las volvía negras sin avisar.
   Aquí viven la regla (`prepareForType`), la detección de si la imagen
   tiene zonas transparentes y el bloque de opciones que comparten los
   diálogos de guardado (`alphaFieldsHTML` + `wireAlphaFields`).
   ═══════════════════════════════════════════════════════════════ */

const ALPHA_TYPES = new Set(["image/png", "image/webp", "image/avif", "image/gif", "image/tiff"]);
const NAMES = { "image/jpeg": "JPEG", "application/pdf": "PDF", "image/png": "PNG", "image/webp": "WebP", "image/avif": "AVIF", "image/gif": "GIF", "image/tiff":"TIFF",
                jpg: "JPEG", jpeg: "JPEG", pdf: "PDF", png: "PNG", webp: "WebP", avif: "AVIF", gif: "GIF", tiff:"TIFF" };

/** ¿El formato (tipo MIME, o «png», «jpg»…) admite transparencia? */
export function supportsAlpha(type){
  const t = String(type || "").toLowerCase();
  if(ALPHA_TYPES.has(t)) return true;
  return ["png", "webp", "avif", "gif", "tiff"].includes(t);
}

/** Copia del lienzo sobre un color de fondo (sin transparencia). */
export function onBackground(canvas, color = "#ffffff"){
  const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
  const x = c.getContext("2d", { colorSpace: "srgb" });
  x.fillStyle = color || "#ffffff"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(canvas, 0, 0);
  return c;
}

/** El lienzo listo para codificar en `type`: tal cual si el formato admite
    transparencia y se quiere conservar; si no, sobre el color de fondo. */
export function prepareForType(canvas, type, { alpha = true, background = "#ffffff" } = {}){
  return supportsAlpha(type) && alpha ? canvas : onBackground(canvas, background);
}

/** ¿Tiene el lienzo alguna zona (semi)transparente? Se mira una copia
    reducida: basta para decidir qué ofrecer y es instantáneo. */
export function hasTransparency(canvas){
  if(!canvas?.width || !canvas?.height) return false;
  const k = Math.min(1, 256 / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * k)), h = Math.max(1, Math.round(canvas.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  for(let i = 3; i < d.length; i += 4) if(d[i] < 250) return true;
  return false;
}

/** Bloque de opciones para un diálogo de guardado. `id` hace únicos los
    identificadores. */
export function alphaFieldsHTML(id = "ax"){
  return `<div class="alpha-box" id="${id}Box" style="margin:2px 0 9px">
    <label class="chk" style="margin:0 0 5px"><input type="checkbox" id="${id}Alpha" checked>
      <span><b>Conservar la transparencia</b><br><small class="hint">En PNG, WebP, AVIF, TIFF y GIF</small></span></label>
    <div class="field" id="${id}BgRow" style="margin:0 0 4px"><label>Fondo</label>
      <input type="color" id="${id}Bg" value="#ffffff"><span class="hint" style="margin-left:8px">para las zonas transparentes</span></div>
    <p class="hint" id="${id}Hint" style="margin:0"></p>
  </div>`;
}

/**
 * Da vida al bloque: `getType()` devuelve el formato elegido ahora;
 * `hasAlpha` si la imagen tiene transparencia; `onChange` se llama al
 * cambiar algo; `switchTo(type)` (opcional) cambia el formato del
 * diálogo —el aviso ofrece pasar a PNG—. Devuelve { sync, values }.
 */
export function wireAlphaFields(root, { id = "ax", getType, hasAlpha = false, onChange = () => {}, switchTo = null }){
  const box = root.querySelector(`#${id}Box`), chk = root.querySelector(`#${id}Alpha`);
  const bgRow = root.querySelector(`#${id}BgRow`), bg = root.querySelector(`#${id}Bg`), hint = root.querySelector(`#${id}Hint`);
  const sync = () => {
    const t = getType(), ok = supportsAlpha(t), name = NAMES[t] || String(t).toUpperCase();
    chk.disabled = !ok;
    chk.closest("label").style.opacity = ok ? "" : ".55";
    bgRow.hidden = ok && chk.checked;
    if(!ok){
      hint.innerHTML = hasAlpha
        ? `Tu imagen tiene zonas transparentes y <b>${name} no admite transparencia</b>: se rellenarán con el color de fondo.${switchTo ? ` <a href="#" data-alpha-png>Guardar en PNG</a> para conservarla.` : " Para conservarla, elige PNG, WebP o AVIF."}`
        : `${name} no admite transparencia; si hubiera zonas transparentes, se rellenarían con el color de fondo.`;
    }else if(chk.checked){
      hint.textContent = hasAlpha ? "Se guardará con transparencia: sólo se verá lo que está en las capas visibles." : "La imagen no tiene zonas transparentes ahora mismo.";
    }else{
      hint.textContent = "Las zonas transparentes se rellenarán con el color de fondo.";
    }
    hint.querySelector("[data-alpha-png]")?.addEventListener("click", e => { e.preventDefault(); switchTo?.("image/png"); sync(); onChange(); });
  };
  chk.addEventListener("change", () => { sync(); onChange(); });
  bg.addEventListener("input", onChange);
  sync();
  return { sync, values: () => ({ alpha: chk.checked && !chk.disabled, background: bg.value }), box };
}
