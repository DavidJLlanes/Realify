/* ═══════════════════════════════════════════════════════════════
   AVISO DE COOKIES
   Realify no usa cookies de analítica ni de seguimiento (ver Política
   de cookies), así que esto no es un panel de "aceptar/rechazar"
   categorías: es el aviso informativo obligatorio, con un único botón
   para darse por enterado. El enlace "Más información" ya funciona
   solo, porque cualquier elemento con data-cmd se cablea solo
   (ver ui/commands.js).
   ═══════════════════════════════════════════════════════════════ */

const KEY = "realify.cookieConsent";

const accepted = () => { try{ return localStorage.getItem(KEY) === "1"; }catch{ return false; } };
const markAccepted = () => { try{ localStorage.setItem(KEY, "1"); }catch{} };

export function initCookieBar(){
  const bar = document.getElementById("cookieBar");
  if(!bar || accepted()) return;
  bar.hidden = false;
  bar.querySelector("[data-cookie-accept]").addEventListener("click", () => {
    markAccepted();
    bar.hidden = true;
  });
}
