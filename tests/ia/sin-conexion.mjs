/* ═══════════════════════════════════════════════════════════════
   PRUEBA · sin conexión y Diagnóstico (F16.4)
   1) Con el service worker activo: se carga la web, se piden un modelo pequeño servido por la web y un módulo del editor de vídeo; se corta la red; se recarga y la app arranca, y lo ya visto
      sigue disponible; los modelos grandes de IndexedDB (pose, partes del cuerpo) NO se duplican en la caché del service worker.
   2) Diagnóstico: un modelo nuevo guardado en IndexedDB (humanparse) aparece con su nombre y su tamaño, y «Borrar» lo quita.
   Uso: CHROME_EXE=… node tests/ia/sin-conexion.mjs
   ═══════════════════════════════════════════════════════════════ */
import { abrir } from "./lib/navegador.mjs";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };

const e = await abrir("escritorio", { sw: true }), { page } = e, ctx = page.context();
await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(1500);
ok(await page.evaluate(() => !!navigator.serviceWorker.controller), "el service worker controla la página");
const pequeno = "/assets/models/people/face_landmarks_detector.onnx", grande = "/assets/models/people/rtmpose_m_body7_fp16.onnx", modulo = "/plugins/video/index.js";
const online = await page.evaluate(async u => (await Promise.all(u.map(x => fetch(x).then(r => r.status)))), [pequeno, modulo]);
ok(online.every(s => s === 200), "en línea: modelo pequeño y módulo de vídeo responden 200 " + online);
await page.evaluate(u => fetch(u, { method: "HEAD" }).then(r => r.status), grande);
const cacheado = await page.evaluate(async u => { const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k); for (const x of u) out[x] = out[x] || !!(await c.match(x)); } return out; }, [pequeno, modulo, grande]);
ok(cacheado[pequeno] && cacheado[modulo], "el modelo pequeño y el módulo de vídeo quedan en la caché del service worker");
ok(!cacheado[grande], "el modelo grande de personas NO se duplica en la caché del service worker (va a IndexedDB)");
await ctx.setOffline(true);
const off = await page.evaluate(async u => (await Promise.all(u.map(x => fetch(x).then(r => r.status).catch(() => "error")))), [pequeno, modulo]);
ok(off.every(s => s === 200), "sin conexión: lo ya visto sigue respondiendo " + off);
await page.reload().catch(() => {}); await page.waitForTimeout(2000);
ok(await page.evaluate(() => !!document.querySelector("#app, main, body > *")) && await page.evaluate(() => typeof window.__realifyDiag === "function" || !!document.querySelector(".menu-root")), "sin conexión la app arranca (menús presentes)");
await ctx.setOffline(false);

// Diagnóstico: modelo nuevo en IndexedDB
const url = await page.evaluate(async () => {
  const { MODELS } = await import("/js/ai/models.js"), m = MODELS.humanparse;
  await new Promise((res, rej) => { const r = indexedDB.open("realify-ai", 1); r.onupgradeneeded = () => r.result.createObjectStore("models"); r.onsuccess = () => { const tx = r.result.transaction("models", "readwrite"); tx.objectStore("models").put(new Blob([new Uint8Array(1048576)]), m.url); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); });
  return m.url;
});
await page.evaluate(async () => { const C = await import("/js/core/commands.js"); (C.run || C.runCommand || C.exec)?.("help.diag"); });
await page.waitForTimeout(1200);
const fila = await page.evaluate(() => [...document.querySelectorAll(".diag-models .field")].map(f => f.textContent.replace(/\s+/g, " ").trim()));
ok(fila.some(t => /partes del cuerpo|SegFormer|humanparse/i.test(t) || /MB/.test(t)), "Diagnóstico lista el modelo nuevo: " + JSON.stringify(fila));
await page.evaluate(() => document.querySelector('.diag-models button[data-i="0"]')?.click()); await page.waitForTimeout(800);
const despues = await page.evaluate(() => document.querySelector(".diag-models")?.textContent.trim());
ok(/Ninguno/.test(despues), "«Borrar» quita el modelo: " + despues);
ok(e.errs.length === 0, "sin errores de página: " + e.errs.join(" | "));
await e.cerrar();
console.log(fallos ? `${fallos} fallos` : "OK · sin conexión y Diagnóstico"); process.exit(fallos ? 1 : 0);
