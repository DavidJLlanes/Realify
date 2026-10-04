/* Regresión del aviso de actualización en navegador y app instalada.
   node tests/pwa-actualizaciones.mjs (Playwright + Chromium). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let version=227,invalid=false,checks=0,navigations=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/version.json'){
    checks++;res.setHeader('Content-Type','application/json');return res.end(invalid?'invalid':JSON.stringify({version}));
  }
  if(url.pathname==='/worker-fixture'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><body>Prueba de service worker');}
  if(url.pathname==='/'){
    navigations++;res.setHeader('Content-Type','text/html');
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <script type="application/json" src="/js/main.js?v=227"></script><body>
      <script>
      window.worker=new EventTarget();worker.controller=null;window.registrations=0;
      worker.register=()=>{registrations++;return Promise.resolve({update:()=>Promise.reject(new Error('worker suspendido'))})};
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:worker});
      Object.defineProperty(navigator,'standalone',{value:${url.searchParams.has('installed')}});
      </script>`);
  }
  const stubs={
    '/js/ui/dialog.js':'export const dialog=async()=>{}; export const confirmDlg=async()=>false;',
    '/js/ui/toast.js':'export const toast=()=>{};',
    '/js/core/doc.js':'export const doc={open:false};'
  };
  if(stubs[url.pathname]){res.setHeader('Content-Type','text/javascript');return res.end(stubs[url.pathname]);}
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type','text/javascript');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
  for(const installed of [false,true]){
    version=227;invalid=false;
    const context=await browser.newContext({serviceWorkers:'block',viewport:installed?{width:390,height:844}:{width:1280,height:800},isMobile:installed,hasTouch:installed});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+(installed?'/?installed=1':'/'));
    // initPWA después de load: debe registrar y empezar a vigilar igualmente.
    await page.evaluate(async()=>{const m=await import('/js/pwa.js');m.initPWA();m.initPWA();});
    await page.waitForFunction(()=>window.registrations===1);await page.waitForTimeout(150);
    if(await page.locator('.update-bar').count())throw new Error('Aviso falso en versión actual');
    await page.evaluate(()=>{worker.controller={};worker.dispatchEvent(new Event('controllerchange'));});
    await page.waitForTimeout(100);if(await page.locator('.update-bar').count())throw new Error('Aviso falso en primera instalación');
    // Simula volver de suspensión con el mismo controlador y reg.update fallando.
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    version=228;const previousChecks=checks,beforeNavigation=navigations;
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(100);
    if(checks!==previousChecks)throw new Error('Consulta mientras la app está oculta');
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.locator('.update-bar').waitFor();
    if(navigations!==beforeNavigation)throw new Error('Recarga automática sin guardar');
    await page.locator('[data-u="later"]').click();
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await page.waitForTimeout(100);
    if(await page.locator('.update-bar').isVisible())throw new Error('Ignora Luego');
    if(await page.locator('.update-bar').count()!==1)throw new Error('Avisos duplicados');
    // Otra sesión instalada, sin service worker: respuesta inválida y reconexión.
    await page.close();const cold=await context.newPage();cold.on('pageerror',e=>errors.push(e.message));
    invalid=true;await cold.goto(base+(installed?'/?installed=1':'/'));
    await cold.evaluate(async()=>{
      Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:undefined});
      (await import('/js/pwa.js')).initPWA();
    });
    await cold.waitForTimeout(100);if(await cold.locator('.update-bar').count())throw new Error('Aviso con manifiesto inválido');
    invalid=false;
    await cold.evaluate(()=>{
      Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('online'));
    });
    await cold.waitForTimeout(100);if(await cold.locator('.update-bar').count())throw new Error('Aviso nuevo sin conexión');
    await cold.evaluate(()=>{
      Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));
    });
    await cold.locator('.update-bar').waitFor();
    await Promise.all([cold.waitForNavigation(),cold.locator('[data-u="now"]').click()]);
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('APTO · '+(installed?'app instalada':'navegador')+' · reanudación, registro tardío, mismo worker, reconexión, Luego y Actualizar');
    await context.close();
  }
  const workerContext=await browser.newContext({serviceWorkers:'allow'}),workerPage=await workerContext.newPage();
  await workerPage.goto(base+'/worker-fixture');
  await workerPage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await workerPage.waitForFunction(()=>navigator.serviceWorker.controller);
  version=229;
  const live=await workerPage.evaluate(async()=>(await (await fetch('/version.json?update-check=real-worker',{cache:'no-store'})).json()).version);
  if(live!==229)throw new Error('Worker no devuelve versión de red');
  const cached=await workerPage.evaluate(async()=>{
    for(const key of await caches.keys())for(const request of await (await caches.open(key)).keys())if(new URL(request.url).pathname==='/version.json')return true;
    return false;
  });
  if(cached)throw new Error('Worker almacena consultas de versión');
  await workerContext.setOffline(true);
  const offline=await workerPage.evaluate(async()=>{try{await fetch('/version.json?update-check=real-worker');return true;}catch{return false;}});
  if(offline)throw new Error('Worker devuelve versión obsoleta sin red');
  console.log('APTO · service worker real · manifiesto de red, sin caché y fallo limpio sin conexión');
  await workerContext.close();
}finally{await browser.close();server.close();}
