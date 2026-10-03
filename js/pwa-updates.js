/* Comprueba la versión del documento, incluso si una PWA conserva el mismo
   service worker al despertar. No recarga ni toca documentos del usuario. */
export function loadedVersion(){
  const src=document.querySelector('script[src*="main.js"]')?.getAttribute('src');
  const value=src?new URL(src,document.baseURI).searchParams.get('v'):null;
  return value&&/^\d+$/.test(value)?Number(value):null;
}

export function watchPWAUpdates({onUpdate,currentVersion=loadedVersion()}={}){
  let registration=null,pending=null,disposed=false;
  const sw=navigator.serviceWorker;
  async function fetchVersion(){
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
    try{
      const url=new URL('./version.json',document.baseURI);
      url.searchParams.set('update-check',Date.now());
      const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:abort.signal});
      if(!response.ok)return;
      const data=await response.json(),latest=Number(data.version);
      if(!disposed&&currentVersion!==null&&Number.isSafeInteger(latest)&&latest>currentVersion)onUpdate?.(latest);
    }catch{/* Sin conexión o respuesta inválida: mantener la sesión abierta. */}
    finally{clearTimeout(timeout);}
  }
  function check(){
    if(disposed||document.visibilityState==='hidden'||navigator.onLine===false)return Promise.resolve();
    // El manifiesto se consulta aunque el worker falle, ya esté actualizado o
    // no llegue a emitir controllerchange (frecuente al reanudar una PWA).
    if(pending)return pending;
    try{Promise.resolve(registration?.update()).catch(()=>{});}catch{}
    pending=fetchVersion().finally(()=>{pending=null;});return pending;
  }
  const visible=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',visible);
  for(const event of ['pageshow','focus','online'])window.addEventListener(event,check);
  sw?.addEventListener?.('controllerchange',check);
  const timer=setInterval(check,60000);
  check();
  return {check,setRegistration(reg){registration=reg;check();},destroy(){
    disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);
    for(const event of ['pageshow','focus','online'])window.removeEventListener(event,check);
    sw?.removeEventListener?.('controllerchange',check);
  }};
}
