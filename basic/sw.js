/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · SERVICE WORKER
   Red primero y caché como respaldo (igual que el de Realify): con conexión se pide siempre lo fresco y se guarda;
   sin ella se sirve lo último guardado. Alcance /basic/; también guarda el código que Basic comparte de /js/.
   El contador de compilación es EL MISMO que el de Realify (se sube en las dos a la vez).
   Límites: sólo borra cachés propias («realify-basic-…»); las de Realify no se tocan.
   ═══════════════════════════════════════════════════════════════ */
const VERSION = "realify-basic-v361";
const PREFIJO = "realify-basic-";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./css/tokens.css", "./css/shell.css", "./css/controls.css",
  "./js/main.js?v=" + VERSION.match(/v(\d+)/)[1]];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => { /* no bloquea la instalación */ })));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIJO) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;          // relevo de fotos: siempre a la red, nunca a la caché
  if (url.pathname === "/version.json") { e.respondWith(fetch(req, { cache: "no-store" })); return; }
  e.respondWith(
    fetch(req.mode === "navigate" ? req.url : req, { cache: "no-cache" })
      .then(r => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: false }).then(r => r || caches.match("./index.html")))
  );
});
