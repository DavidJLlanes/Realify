/* ═══════════════════════════════════════════════════════════════
   VIGILANTE DE ARRANQUE
   Script clásico (no módulo) que se carga ANTES que la app: así sigue
   funcionando aunque los módulos no lleguen a cargarse (navegador
   antiguo, extensión que bloquea scripts, error de sintaxis…).

     · Recoge los errores de JavaScript y de carga de scripts desde el
       primer momento.
     · Si la app no avisa de que ha arrancado (window.__realifyReady)
       en unos segundos, enseña un panel con lo que ha fallado y un
       botón «Copiar diagnóstico» para mandarlo por correo o WhatsApp.
     · Autorreparación: los módulos ES se importan sin «?v=», y un
       navegador con archivos viejos en caché (caché HTTP larga, service
       worker antiguo) puede mezclar un main.js nuevo con módulos de otra
       versión («does not provide an export named…», «import not
       found», «error loading dynamically imported module»): la app no
       arranca. Si pasa, UNA vez por sesión se borran el service worker y
       la caché de la app, se vuelven a pedir TODOS los módulos y hojas
       de estilo saltándose la caché (así se reescribe la caché HTTP) y
       se recarga. Si ni así arranca, el panel.
     · window.__realifyDiag() devuelve ese diagnóstico en texto; lo usan
       también el aviso de compatibilidad (js/core/compat.js) y Ayuda ›
       Diagnóstico.
   Sin dependencias y en JavaScript clásico, para que funcione en
   cualquier navegador.
   ═══════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var errors = [], started = Date.now(), shown = false;
  function push(msg){
    if(errors.length < 20 && errors.indexOf(msg) < 0) errors.push(msg);
  }
  window.addEventListener("error", function(e){
    var t = e && e.target;
    // Error de carga de un recurso (script, hoja de estilos)
    if(t && t !== window && (t.src || t.href)){ push("No se pudo cargar: " + (t.src || t.href)); return; }
    push((e.message || "Error") + (e.filename ? " (" + String(e.filename).replace(location.origin, "") + ":" + (e.lineno || 0) + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", function(e){
    var r = e && e.reason;
    push("Promesa rechazada: " + (r && (r.message || r.name) || String(r)));
  });

  function feature(name, test){
    try{ return name + ": " + (test() ? "sí" : "NO"); }catch(err){ return name + ": NO (" + (err && err.name || "error") + ")"; }
  }
  window.__realifyDiag = function(extra){
    var lines = [
      "Diagnóstico de Realify",
      "Fecha: " + new Date().toISOString(),
      "Página: " + location.href,
      "Navegador: " + navigator.userAgent,
      "Idioma: " + (navigator.language || "?") + " · Pantalla: " + screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1),
      "Versión de la app: " + (function(){ var s = document.querySelector('script[src*="main.js"]'); return s ? s.getAttribute("src") : "?"; })(),
      "Actualización: " + (function(){ try{ var u = window.__realifyUpdateInfo && window.__realifyUpdateInfo(); if(!u) return "sin comprobar"; return "cargada " + u.loaded + " · última " + (u.latest === null ? "?" : u.latest) + (u.checkedAt ? " · comprobada hace " + Math.round((Date.now() - u.checkedAt) / 1000) + " s" : " · sin comprobar") + (u.error ? " · error: " + u.error : "") + (u.log && u.log.length ? " · registro: " + u.log.join(" | ") : ""); }catch(e){ return "?"; } })() + " · service worker: " + (function(){ try{ return navigator.serviceWorker && navigator.serviceWorker.controller ? "controla la página" : "no controla"; }catch(e){ return "?"; } })(),
      "Arrancada: " + (window.__realifyReady ? "sí" : "NO") + " · segundos desde la carga: " + Math.round((Date.now() - started) / 1000) +
        " · autorreparación: " + (function(){ try{ return sessionStorage.getItem("realify.repaired") === "1" ? "hecha" : "no"; }catch(e){ return "?"; } })(),
      feature("Módulos ES", function(){ return "noModule" in document.createElement("script"); }),
      feature("WebGL2", function(){ return !!document.createElement("canvas").getContext("webgl2"); }),
      feature("WebGPU", function(){ return !!navigator.gpu; }),
      feature("WebAssembly", function(){ return typeof WebAssembly === "object"; }),
      feature("Service worker", function(){ return !!navigator.serviceWorker; }),
      feature("localStorage", function(){ localStorage.setItem("realify.probe", "1"); localStorage.removeItem("realify.probe"); return true; }),
      feature("IndexedDB", function(){ return !!window.indexedDB; }),
      feature("OffscreenCanvas", function(){ return typeof OffscreenCanvas === "function"; })
    ];
    if(extra) lines = lines.concat(extra);
    lines.push("Errores (" + errors.length + "):");
    lines = lines.concat(errors.length ? errors.map(function(e){ return " · " + e; }) : [" · ninguno"]);
    return lines.join("\n");
  };
  window.__realifyErrors = function(){ return errors.slice(); };

  function copy(text, btn){
    function done(ok){ if(btn){ btn.textContent = ok ? "Copiado ✓" : "Selecciona y copia el texto"; } }
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(false); }); return; }
    }catch(e){}
    done(false);
  }
  window.__realifyCopyDiag = copy;

  function showPanel(){
    if(shown || window.__realifyReady) return;
    shown = true;
    var box = document.createElement("div");
    box.setAttribute("role", "alertdialog");
    box.setAttribute("aria-label", "Realify no ha podido arrancar");
    box.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,15,.92);font:14px/1.45 system-ui,sans-serif;color:#e9edf4";
    var text = window.__realifyDiag();
    box.innerHTML =
      '<div style="max-width:560px;width:100%;background:#1b1f25;border:1px solid #3a414b;border-radius:10px;padding:18px">' +
      '<b style="font-size:17px">Realify no ha podido arrancar</b>' +
      '<p style="margin:8px 0">Algo ha impedido que la aplicación se cargue en este navegador. Prueba a recargar; si sigue igual, ' +
      'pulsa «Copiar diagnóstico» y envíanoslo: así sabremos qué ha fallado.</p>' +
      '<p style="margin:8px 0;opacity:.85">Suele deberse a una extensión que bloquea scripts (NoScript, uBlock en modo estricto), a un navegador ' +
      'muy antiguo o a la protección estricta contra rastreo. En Firefox: pulsa el escudo junto a la dirección y desactiva la protección para esta web.</p>' +
      '<textarea readonly style="width:100%;height:150px;box-sizing:border-box;background:#0f1216;color:#cfd6e2;border:1px solid #3a414b;border-radius:6px;padding:8px;font:12px/1.35 ui-monospace,monospace"></textarea>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap">' +
      '<button type="button" data-a="copy" style="padding:8px 14px;border-radius:6px;border:1px solid #4b5563;background:#262b33;color:#e9edf4;font:inherit;cursor:pointer">Copiar diagnóstico</button>' +
      '<button type="button" data-a="reload" style="padding:8px 14px;border-radius:6px;border:1px solid #7fa6ff;background:#3b63c4;color:#fff;font:inherit;cursor:pointer">Recargar</button>' +
      '</div></div>';
    box.querySelector("textarea").value = text;
    box.querySelector('[data-a="copy"]').addEventListener("click", function(){ var t = box.querySelector("textarea"); t.select(); copy(window.__realifyDiag(), this); });
    box.querySelector('[data-a="reload"]').addEventListener("click", function(){ location.reload(); });
    (document.body || document.documentElement).appendChild(box);
  }
  /* ── Autorreparación ─────────────────────────────────────────── */
  var MODULE_ERR = /import|export|module|MIME|dynamically|SyntaxError|Failed to fetch|NetworkError|No se pudo cargar/i;
  function repairedBefore(){
    try{ return sessionStorage.getItem("realify.repaired") === "1"; }catch(e){ return true; }   // sin sessionStorage, nunca (evita bucles)
  }
  function markRepaired(){ try{ sessionStorage.setItem("realify.repaired", "1"); return true; }catch(e){ return false; } }
  /* Pide de nuevo (cache: "reload") cada módulo que se importa desde
     `url`, siguiendo los import estáticos y dinámicos del propio código */
  function refreshModules(){
    var seen = {}, queue = [], active = 0, count = 0;
    var RE = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
    function add(u){
      try{ var abs = new URL(u, location.href); }catch(e){ return; }
      if(abs.origin !== location.origin || !/\.(m?js|css)$/.test(abs.pathname)) return;
      var key = abs.href; if(seen[key] || count > 900) return;
      seen[key] = 1; count++; queue.push(key);
    }
    var mainEl = document.querySelector('script[src*="main.js"]');
    if(mainEl) add(mainEl.getAttribute("src"));
    var links = document.querySelectorAll('link[rel="stylesheet"][href], script[src]');
    for(var i = 0; i < links.length; i++) add(links[i].getAttribute("href") || links[i].getAttribute("src"));
    return new Promise(function(resolve){
      function next(){
        if(!queue.length && !active){ resolve(count); return; }
        while(active < 8 && queue.length){
          var u = queue.shift(); active++;
          fetch(u, { cache: "reload", credentials: "same-origin" }).then(function(r){ return /\.m?js(\?|$)/.test(r.url) ? r.text().then(function(t){ return [r.url, t]; }) : [r.url, ""]; })
            .then(function(res){ var m; RE.lastIndex = 0; while((m = RE.exec(res[1]))) add(new URL(m[1] || m[2] || m[3], res[0]).href); })
            .catch(function(){})
            .then(function(){ active--; next(); });
        }
      }
      next();
    });
  }
  function repair(){
    if(!markRepaired()) return false;
    var box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0f1216;color:#e9edf4;font:15px system-ui,sans-serif;text-align:center;padding:16px";
    box.textContent = "Actualizando Realify a la última versión…";
    (document.body || document.documentElement).appendChild(box);
    var steps = [];
    try{ if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations) steps.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); })); }catch(e){}
    try{ if(window.caches && caches.keys) steps.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })); }catch(e){}
    Promise.all(steps.map(function(p){ return p.catch(function(){}); }))
      .then(refreshModules)
      .then(function(){ location.reload(); }, function(){ location.reload(); });
    return true;
  }

  // Errores de módulos: se repara a los 3 s. Sin arrancar ni errores:
  // 15 s de margen (un móvil lento puede tardar) y también se repara.
  // Si ya se reparó en esta sesión, el panel.
  var timer = setInterval(function(){
    if(window.__realifyReady){ clearInterval(timer); return; }
    var t = Date.now() - started, modErr = errors.some(function(e){ return MODULE_ERR.test(e); });
    if((modErr && t > 3000) || t > 15000 || (errors.length && t > 6000)){
      clearInterval(timer);
      if(!repairedBefore() && repair()) return;
      showPanel();
    }
  }, 1000);
})();
