/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER
   La app ya no depende de ningún servidor para funcionar —todo el
   procesado ocurre en el equipo—, así que tiene sentido que funcione
   sin conexión también para CARGARSE. Estrategia: RED PRIMERO, caché
   como red de seguridad. Con conexión, siempre se pide la versión
   fresca al servidor (y se guarda para la próxima vez sin conexión);
   sólo si la red falla se sirve lo último que hubiera en caché.

   Antes era al revés —caché primero, red sólo si no había nada
   cacheado—, y con `VERSION` fija eso significaba que, una vez
   cacheado un archivo, JAMÁS se volvía a pedir a la red: cualquier
   actualización subida al servidor quedaba invisible para quien ya
   hubiera visitado el sitio una vez, sin ningún aviso de que estaba
   viendo una copia vieja. Subir `VERSION` en cada despliegue real
   sigue haciendo falta para que `activate` limpie la caché de la
   versión anterior. */

const VERSION = "realify-v159-premium-con-texto";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/mobile.css",
  "./css/curves.css",
  "./js/main.js",
  "./js/core/viewport-lock.js"
  ,"./js/vendor/ag-psd.js"
  ,"./js/vendor/utif.js"
  ,"./js/vendor/heic2any.min.js"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(VERSION).then(cache =>
      cache.addAll(SHELL).catch(() => { /* algún archivo del esqueleto no cargó; no bloquea la instalación */ }))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // las fuentes de Google, etc., tal cual

  /* `no-cache`: el navegador puede reutilizar su caché HTTP, pero
     siempre pregunta antes al servidor (un 304 si no ha cambiado). Sin
     esto, los módulos sin «?v=» (p. ej. vintagefilter/ui.js o su CSS)
     se servían de la caché HTTP del móvil durante horas tras publicar
     una versión nueva. Una navegación no admite opciones: se pide por
     su URL. */
  const fresh = req.mode === "navigate"
    ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
    : fetch(req, { cache: "no-cache" });
  e.respondWith(
    fresh.then(res => {
      if(res && res.ok){
        const copy = res.clone();
        caches.open(VERSION).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req).then(cached => {
        if(cached) return cached;
        // Sin red y sin caché: para una navegación, al menos ofrecer el shell
        if(req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "sin conexión" });
      })
    )
  );
});
