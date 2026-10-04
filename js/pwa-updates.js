/* Comprueba la versión del documento, incluso si una PWA conserva el mismo
   service worker al despertar. No recarga ni toca documentos del usuario. */
export function loadedVersion(){
  const src=document.querySelector('script[src*="main.js"]')?.getAttribute('src');
  const value=src?new URL(src,document.baseURI).searchParams.get('v'):null;
  return value&&/^\d+$/.test(value)?Number(value):null;
}

/* Estado de la última comprobación, a la vista (Ayuda › Buscar actualización y Diagnóstico). */
export const updateInfo={loaded:loadedVersion(),latest:null,checkedAt:0,error:null};
if(typeof window!=='undefined')window.__realifyUpdateInfo=()=>({...updateInfo});

export function watchPWAUpdates({onUpdate,currentVersion=loadedVersion()}={}){
  let registration=null,pending=null,pendingSince=0,disposed=false;
  const sw=navigator.serviceWorker;
  /* Consulta version.json. Un fallo puntual (red lenta al despertar la app) se reintenta una vez. */
  async function fetchVersion(silent=false){
    for(let attempt=0;attempt<2;attempt++){
      const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
      try{
        const url=new URL('./version.json',document.baseURI);
        url.searchParams.set('update-check',Date.now());
        const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:abort.signal});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json(),latest=Number(data.version);
        if(!Number.isSafeInteger(latest))throw new Error('version.json sin número de versión');
        updateInfo.latest=latest;updateInfo.checkedAt=Date.now();updateInfo.error=null;
        if(!silent&&!disposed&&currentVersion!==null&&latest>currentVersion)onUpdate?.(latest);
        return;
      }catch(err){
        updateInfo.error=String(err?.message||err);updateInfo.checkedAt=Date.now();
        if(attempt===0)await new Promise(r=>setTimeout(r,2500));
      }
      finally{clearTimeout(timeout);}
    }
  }
  function check(){
    if(disposed||document.visibilityState==='hidden'||navigator.onLine===false)return Promise.resolve();
    // El manifiesto se consulta aunque el worker falle, ya esté actualizado o
    // no llegue a emitir controllerchange (frecuente al reanudar una PWA).
    // Una consulta «colgada» (iOS congela las peticiones al suspender la app) no bloquea las siguientes.
    if(pending&&Date.now()-pendingSince<25000)return pending;
    try{Promise.resolve(registration?.update()).catch(()=>{});}catch{}
    pendingSince=Date.now();
    const mine=pending=fetchVersion().finally(()=>{if(pending===mine)pending=null;});return pending;
  }
  /* Comprobación pedida por la persona (Ayuda › Buscar actualización): sin atajos ni esperas. */
  async function checkNow(){
    try{await Promise.resolve(registration?.update()).catch(()=>{});}catch{}
    updateInfo.latest=null;updateInfo.error=null;
    await fetchVersion(true);      // sin reacción automática: el diálogo cuenta lo que hay
    return {...updateInfo};
  }
  /* El propio service worker avisa al activarse (js/pwa.js recibe el mensaje): no depende de version.json. */
  function swActivated(version){
    if(disposed||currentVersion===null||!Number.isSafeInteger(version))return;
    if(version>currentVersion){updateInfo.latest=Math.max(updateInfo.latest||0,version);onUpdate?.(version);}
  }
  const visible=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',visible);
  for(const event of ['pageshow','focus','online'])window.addEventListener(event,check);
  sw?.addEventListener?.('controllerchange',check);
  const timer=setInterval(check,60000);
  check();
  return {check,checkNow,swActivated,setRegistration(reg){registration=reg;check();},destroy(){
    disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);
    for(const event of ['pageshow','focus','online'])window.removeEventListener(event,check);
    sw?.removeEventListener?.('controllerchange',check);
  }};
}
