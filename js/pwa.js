/* ═══════════════════════════════════════════════════════════════
   INSTALACIÓN COMO APP
   Android/Chrome ofrecen un evento (`beforeinstallprompt`) que se
   puede disparar a mano desde un botón propio; iOS no tiene ese
   evento —Safari nunca lo ha implementado— y la única vía es «Compartir
   → Añadir a pantalla de inicio», así que ahí sólo cabe explicarlo.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "./ui/dialog.js";
import { toast } from "./ui/toast.js";

let deferredPrompt = null;

addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
});

addEventListener("appinstalled", () => {
  deferredPrompt = null;
  toast("Instalada. Búscala en tu pantalla de inicio o en tus aplicaciones.", "ok");
});

export function initPWA(){
  if(!("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Sin service worker la app sigue funcionando igual, sólo que
      // no se cachea para uso sin conexión; no hace falta molestar.
    });
  });
}

function isStandalone(){
  return matchMedia("(display-mode: standalone)").matches ||
         matchMedia("(display-mode: fullscreen)").matches ||
         navigator.standalone === true;
}
function isIOS(){
  return /iP(hone|ad|od)/.test(navigator.platform) ||
         (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
}

export async function promptInstall(){
  if(isStandalone()){ toast("Ya la tienes instalada"); return; }

  if(deferredPrompt){
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if(choice && choice.outcome === "dismissed") toast("Instalación cancelada");
    return;
  }

  if(isIOS()){
    await dialog({
      title: "Instalar en iPhone o iPad",
      body: `<p class="hint">Safari no ofrece un botón de instalación automático; se hace a mano
        en tres toques:</p>
        <p class="hint">1. Toca el icono <b>Compartir</b> (el cuadrado con la flecha hacia arriba)
        en la barra de Safari.</p>
        <p class="hint">2. Baja hasta <b>«Añadir a pantalla de inicio»</b>.</p>
        <p class="hint">3. Confirma el nombre y toca <b>Añadir</b>.</p>
        <p class="hint">Quedará como una app normal, a pantalla completa y sin la barra del
        navegador.</p>`,
      buttons: [{ label:"Entendido", primary:true }]
    });
    return;
  }

  await dialog({
    title: "Instalar la app",
    body: `<p class="hint">Tu navegador todavía no ha ofrecido instalarla por su cuenta. Prueba
      desde su propio menú: busca <b>«Instalar Realify…»</b> o <b>«Añadir a pantalla de
      inicio»</b> —en Chrome suele estar tras los tres puntos de arriba a la derecha, o como
      un icono de instalación en la barra de direcciones—.</p>`,
    buttons: [{ label:"Entendido", primary:true }]
  });
}
