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
    navigator.serviceWorker.register("./sw.js").then(watchUpdates).catch(() => {
      // Sin service worker la app sigue funcionando igual, sólo que
      // no se cachea para uso sin conexión; no hace falta molestar.
    });
  });
}

/* ── Aviso de versión nueva ───────────────────────────────────────
   El service worker sirve siempre lo último de la red, pero lo que ya
   está cargado en una sesión abierta sigue siendo la versión con la
   que se abrió (y en el iPhone una app instalada puede pasar días
   «dormida» sin recargarse). Así que se pregunta por una versión nueva
   al arrancar, al volver a la app y cada 30 minutos; cuando el service
   worker nuevo toma el control, se avisa con una barra. «Actualizar»
   guarda todas las pestañas abiertas (io/project.js), recarga y las
   vuelve a abrir. La primera instalación también cambia de
   controlador, pero eso no es una versión nueva: no se avisa. */
let updateReady = false, dismissedAt = 0, bar = null;
function watchUpdates(reg){
  // Con el service worker bloqueado (navegación privada, políticas de
  // empresa, pruebas automáticas) `register` puede resolver sin
  // registro: no hay nada que vigilar. Antes esto lanzaba un error a los
  // 5 s y cada 30 minutos («Cannot read properties of undefined»).
  if(!reg || typeof reg.update !== "function") return;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(hadController){ updateReady = true; showUpdateBar(); }
    hadController = true;
  });
  const check = () => { if(navigator.onLine !== false) reg.update().catch(() => {}); };
  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState !== "visible") return;
    check();
    if(updateReady && Date.now() - dismissedAt > 60e3) showUpdateBar();
  });
  setInterval(check, 30 * 60e3);
  setTimeout(check, 5e3);
}

function showUpdateBar(){
  if(bar){ bar.hidden = false; return; }
  bar = document.createElement("div");
  bar.className = "update-bar";
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span>Hay una versión nueva de Realify.</span>
    <button type="button" class="ghost" data-u="later">Luego</button>
    <button type="button" class="primary" data-u="now">Actualizar</button>`;
  bar.addEventListener("click", async e => {
    const a = e.target.closest("[data-u]")?.dataset.u;
    if(a === "later"){ bar.hidden = true; dismissedAt = Date.now(); }
    else if(a === "now") await applyUpdate();
  });
  document.body.appendChild(bar);
}

async function applyUpdate(){
  const btn = bar?.querySelector('[data-u="now"]');
  if(btn){ btn.disabled = true; btn.textContent = "Guardando…"; }
  try{
    const { doc } = await import("./core/doc.js");
    if(doc.open){
      const { stashForUpdate } = await import("./io/project.js");
      await stashForUpdate();
    }
  }catch(err){
    const { confirmDlg } = await import("./ui/dialog.js");
    const ok = await confirmDlg("Actualizar sin guardar", `No se ha podido guardar lo que tienes abierto (${err?.message || "sin espacio en el navegador"}). Si actualizas ahora, se cerrará. Puedes cancelar, guardarlo como proyecto o exportarlo, y actualizar después.`, "Actualizar igualmente");
    if(!ok){ if(btn){ btn.disabled = false; btn.textContent = "Actualizar"; } return; }
  }
  location.reload();
}

/** Al arrancar: reabre lo que se guardó justo antes de actualizar. */
export async function resumeAfterUpdate(){
  try{
    const { restoreAfterUpdate } = await import("./io/project.js");
    const n = await restoreAfterUpdate();
    if(n) toast(`Realify actualizado · ${n === 1 ? "tu documento se ha recuperado" : `tus ${n} documentos se han recuperado`} (el historial de deshacer empieza de cero)`, "ok");
  }catch{}
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
