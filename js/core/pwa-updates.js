/* Comprueba la versión del documento, incluso si una PWA conserva el mismo
   service worker al despertar. No recarga ni toca documentos del usuario. */
export function loadedVersion(){
  const src=document.querySelector('script[src*="main.js"]')?.getAttribute('src');
  const value=src?new URL(src,document.baseURI).searchParams.get('v'):null;
  return value&&/^\d+$/.test(value)?Number(value):null;
}

/* Estado de la última comprobación, a la vista (Ayuda › Buscar actualización y Diagnóstico). */
export const updateInfo={loaded:loadedVersion(),latest:null,checkedAt:0,error:null,log:[]};
/* Registro corto de lo que ha pasado (comprobaciones, avisos, actualizaciones automáticas), también en
   localStorage: si el aviso no llega, Ayuda › Diagnóstico dice por qué sin tener que adivinar. */
const LOG_KEY='realify.updLog';
export function updateLog(msg){
  const line=new Date().toISOString().slice(11,19)+' '+msg;
  updateInfo.log.push(line);if(updateInfo.log.length>30)updateInfo.log.shift();
  try{localStorage.setItem(LOG_KEY,JSON.stringify(updateInfo.log.slice(-30)));}catch{}
}
export function savedUpdateLog(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]');}catch{return [];}}
if(typeof window!=='undefined')window.__realifyUpdateInfo=()=>({...updateInfo,log:updateInfo.log.slice(-8)});

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
        updateLog('version.json: '+latest+' (cargada '+currentVersion+')'+(latest>currentVersion?' → NUEVA':''));
        if(!silent&&!disposed&&currentVersion!==null&&latest>currentVersion)onUpdate?.(latest);
        return;
      }catch(err){
        updateInfo.error=String(err?.message||err);updateInfo.checkedAt=Date.now();
        updateLog('version.json falló: '+updateInfo.error);
        if(attempt===0)await new Promise(r=>setTimeout(r,2500));
      }
      finally{clearTimeout(timeout);}
    }
  }
  function check(soft){
    // «soft»: arranque y cambio de controlador, que ocurren juntos; si ya se consultó hace segundos, no se repite
    if(soft===true&&Date.now()-updateInfo.checkedAt<10000)return Promise.resolve();
    // No se fía de navigator.onLine: en algunos equipos (VPN, adaptadores virtuales) dice «sin conexión» con red; si de
    // verdad no hay, la consulta falla sin más.
    if(disposed||document.visibilityState==='hidden')return Promise.resolve();
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
    updateLog('el service worker nuevo avisa: '+version+' (cargada '+currentVersion+')');
    if(version>currentVersion){updateInfo.latest=Math.max(updateInfo.latest||0,version);onUpdate?.(version);}
  }
  const visible=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',visible);
  for(const event of ['pageshow','focus','online'])window.addEventListener(event,check);
  const soft=()=>check(true);
  sw?.addEventListener?.('controllerchange',soft);
  const timer=setInterval(check,120000);
  check();
  /* Un service worker nuevo en camino es, por sí solo, señal de versión nueva: se consulta version.json ya y, si esa
     consulta no da respuesta, se avisa igualmente (versión desconocida). Un primer registro (sin controlador) no cuenta. */
  function watchRegistration(reg){
    try{
      reg.addEventListener('updatefound',()=>{
        if(!sw?.controller)return;
        updateLog('service worker nuevo encontrado');
        check();
        setTimeout(()=>{
          if(disposed||currentVersion===null)return;
          if(updateInfo.latest===null||updateInfo.error)onUpdate?.(currentVersion+1);
        },12000);
      });
    }catch{}
  }
  return {check,checkNow,swActivated,setRegistration(reg){registration=reg;if(reg)watchRegistration(reg);check(true);},destroy(){
    disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);
    for(const event of ['pageshow','focus','online'])window.removeEventListener(event,check);
    sw?.removeEventListener?.('controllerchange',soft);
  }};
}
