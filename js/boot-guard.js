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
      "Arrancada: " + (window.__realifyReady ? "sí" : "NO") + " · segundos desde la carga: " + Math.round((Date.now() - started) / 1000),
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
  // 15 s de margen: en un móvil lento la primera carga puede tardar.
  // Si ya hay errores graves y han pasado 6 s, no hace falta esperar más.
  var timer = setInterval(function(){
    if(window.__realifyReady){ clearInterval(timer); return; }
    var t = Date.now() - started;
    if(t > 15000 || (errors.length && t > 6000)){ clearInterval(timer); showPanel(); }
  }, 1000);
})();
