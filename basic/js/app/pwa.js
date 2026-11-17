/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · SERVICE WORKER
   Registra el service worker propio de Basic (alcance /basic/) para que se instale y abra sin conexión.
   Entradas: ninguna. Salidas: registrarSW() → Promise<registro|null>.
   Límites: si el navegador no lo admite o falla, la app funciona igual (sólo sin modo sin conexión).
   ═══════════════════════════════════════════════════════════════ */
export async function registrarSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("sw.js", { scope: "./" }); }
  catch { return null; }
}
