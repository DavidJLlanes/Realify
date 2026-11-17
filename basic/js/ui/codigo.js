/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · CÓDIGO DE EMPAREJAMIENTO
   La ventanita de cristal para emparejar Basic con Realify en el iPhone (una sola vez): enseñar el código que hay que escribir en la
   otra app, o pedir el que enseña la otra. Va arriba, para que el teclado del móvil nunca la tape.
   Entradas: ensenarCodigo(codigo, otra) · pedirCodigo(otra, error, { titulo }) · elegirEmparejar(otra).
   Salidas: pedirCodigo → Promise<string|null> (null = cancelado) · elegirEmparejar → "ensenar" | "escribir" | null.
   Límites: una sola ventanita a la vez; sin lógica de red (eso es js/core/relevo.js).
   ═══════════════════════════════════════════════════════════════ */
import { h } from "./dom.js";

let abierta = null;
const cerrar = () => { abierta?.remove(); abierta = null; };
const montar = (...hijos) => { cerrar(); abierta = document.body.appendChild(h("div", { class: "hoja-codigo", role: "dialog", "aria-modal": "true" }, ...hijos)); return abierta; };

/** Enseña el código que hay que escribir en la otra app. */
export function ensenarCodigo(codigo, otra) {
  montar(h("h2", {}, `Emparejar con ${otra}`),
    h("p", {}, `Abre ${otra} desde su icono y escribe este código. Solo hace falta una vez: después las fotos pasan solas.`),
    h("div", { class: "codigo-grande" }, codigo.slice(0, 3) + " " + codigo.slice(3)),
    h("div", { class: "hoja-botones" }, h("button", { class: "pildora texto fuerte", onclick: cerrar }, "Entendido")));
}

/** Pide el código que enseña la otra app. Resuelve con el texto escrito o null si se cancela. */
export function pedirCodigo(otra, error = "", { titulo = `${otra} quiere pasarte una foto` } = {}) {
  return new Promise(ok => {
    const fin = v => { cerrar(); ok(v); };
    const campo = h("input", { class: "campo-codigo", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 7, placeholder: "000 000", "aria-label": "Código" });
    const hoja = montar(h("h2", {}, titulo),
      h("p", {}, `Escribe el código que ves en ${otra}. Solo hace falta una vez.`),
      error ? h("p", { class: "hoja-error" }, error) : null,
      campo,
      h("div", { class: "hoja-botones" },
        h("button", { class: "pildora texto", onclick: () => fin(null) }, "Ahora no"),
        h("button", { class: "pildora texto fuerte", onclick: () => fin(campo.value) }, "Emparejar")));
    campo.addEventListener("keydown", e => { if (e.key === "Enter") fin(campo.value); });
    hoja.addEventListener("keydown", e => { if (e.key === "Escape") fin(null); });
  });
}

/** Emparejar a mano: ¿esta app enseña el código o escribe el de la otra? */
export function elegirEmparejar(otra) {
  return new Promise(ok => {
    const fin = v => { cerrar(); ok(v); };
    montar(h("h2", {}, `Emparejar con ${otra}`),
      h("p", {}, `Para que las fotos pasen solas entre las dos apps. Una enseña un código y la otra lo escribe.`),
      h("div", { class: "hoja-botones" },
        h("button", { class: "pildora texto", onclick: () => fin("escribir") }, "Escribir código"),
        h("button", { class: "pildora texto fuerte", onclick: () => fin("ensenar") }, "Enseñar código")),
      h("button", { class: "pildora texto", onclick: () => fin(null) }, "Cancelar"));
  });
}
