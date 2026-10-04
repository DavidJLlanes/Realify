/* ═══════════════════════════════════════════════════════════════
   INSTALACIÓN COMO APP
   Android/Chrome ofrecen un evento (`beforeinstallprompt`) que se
   puede disparar a mano desde un botón propio; iOS no tiene ese
   evento —Safari nunca lo ha implementado— y la única vía es «Compartir
   → Añadir a pantalla de inicio», así que ahí sólo cabe explicarlo.
   ═══════════════════════════════════════════════════════════════ */

import { dialog } from "./ui/dialog.js";
import { toast } from "./ui/toast.js";
import { watchPWAUpdates } from "./pwa-updates.js";

let deferredPrompt = null;

addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
});

addEventListener("appinstalled", () => {
  deferredPrompt = null;
  toast("Instalada. Búscala en tu pantalla de inicio o en tus aplicaciones.", "ok");
});

let initialized=false;
let dismissedAt=0,bar=null;
export function initPWA(){
  if(initialized)return;initialized=true;
  const watcher=watchPWAUpdates({onUpdate:latest=>{
    // Al abrir la web o la app, o volver a ponerla en primer plano, se actualiza sola
    // (guardando antes lo abierto). Sólo si no se puede, queda el aviso con Luego/Actualizar.
    if(autoUpdate(latest))return;
    if(Date.now()-dismissedAt>60e3)showUpdateBar();
  }});
  // La detección por version.json funciona también sin service worker.
  if(!navigator.serviceWorker||typeof navigator.serviceWorker.register!=="function")return;
  const register=()=>{
    try{
      Promise.resolve(navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}))
        .then(reg=>watcher.setRegistration(reg)).catch(()=>{});
    }catch{}
  };
  // Una app reanudada puede iniciar este módulo después del evento load.
  if(document.readyState==="complete")register();
  else addEventListener("load",register,{once:true});
}

/* Actualización automática. Se recarga sola cuando hay una versión nueva, con lo abierto
   guardado y recuperado después (applyUpdate). No lo hace —y deja el aviso— si:
     · hay un diálogo o una herramienta a pantalla completa abiertos (se perdería lo que se
       está haciendo en ellos);
     · ya lo intentó para esa misma versión hace menos de 3 minutos (si el servidor sirviese
       una copia vieja, se recargaría sin fin);
     · no hay sessionStorage para recordar el intento (mismo motivo). */
const AUTO_KEY="realify.autoUpdate";
let updating=false;
function autoUpdate(latest){
  if(updating)return true;
  if(document.querySelector(".modal, .fsp"))return false;
  try{
    const t=JSON.parse(sessionStorage.getItem(AUTO_KEY)||"null");
    if(t&&t.v===latest&&Date.now()-t.t<180e3)return false;
    sessionStorage.setItem(AUTO_KEY,JSON.stringify({v:latest,t:Date.now()}));
  }catch{return false;}
  updating=true;
  toast("Actualizando Realify a la versión nueva…");
  applyUpdate({silent:true}).then(ok=>{if(!ok){updating=false;showUpdateBar();}}).catch(()=>{updating=false;showUpdateBar();});
  return true;
}

/* El aviso depende de la versión cargada en main.js frente a version.json,
   no de que cambie el controlador. Se comprueba al arrancar, reanudar,
   volver a tener red y cada minuto mientras la app está visible.
   Actualizar conserva el guardado y recuperación de documentos existentes. */

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

async function applyUpdate({ silent = false } = {}){
  const btn = bar?.querySelector('[data-u="now"]');
  if(btn){ btn.disabled = true; btn.textContent = "Guardando…"; }
  try{
    const { doc } = await import("./core/doc.js");
    if(doc.open){
      const { stashForUpdate } = await import("./io/project.js");
      await stashForUpdate();
    }
  }catch(err){
    if(silent) return false;           // sin poder guardar, no se recarga solo: queda el aviso
    const { confirmDlg } = await import("./ui/dialog.js");
    const ok = await confirmDlg("Actualizar sin guardar", `No se ha podido guardar lo que tienes abierto (${err?.message || "sin espacio en el navegador"}). Si actualizas ahora, se cerrará. Puedes cancelar, guardarlo como proyecto o exportarlo, y actualizar después.`, "Actualizar igualmente");
    if(!ok){ if(btn){ btn.disabled = false; btn.textContent = "Actualizar"; } return false; }
  }
  location.reload();
  return true;
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
