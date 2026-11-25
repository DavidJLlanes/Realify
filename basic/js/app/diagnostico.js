/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · DIAGNÓSTICO DE MÓDULOS
   Cuando un import() dinámico falla con el mensaje genérico de Safari («Importing a module script failed») no se sabe QUÉ archivo
   falló. Aquí se recorre el árbol de imports desde el módulo de entrada, pidiendo cada archivo como lo pediría el navegador (pasa por
   el service worker), y se devuelve el primero que no llega bien: estado HTTP, tipo de contenido o error de red.
   Entradas: buscarModuloRoto(url). Salidas: Promise<string> («ruta · 404», «ruta · text/html», «todos cargan (N)»…).
   Límites: lee los imports con una expresión regular (basta para el código de Realify); como mucho 200 archivos.
   ═══════════════════════════════════════════════════════════════ */
const IMPORTS = /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\s*\(?\s*["']([^"']+)["']/g;

export async function buscarModuloRoto(entrada) {
  const vistos = new Set(), cola = [new URL(entrada, location.href).href];
  while (cola.length && vistos.size < 200) {
    const url = cola.shift();
    if (vistos.has(url)) continue;
    vistos.add(url);
    const ruta = new URL(url).pathname;
    let r;
    try { r = await fetch(url, { cache: "no-cache" }); } catch (e) { return `${ruta} · red: ${e.message}`; }
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok) return `${ruta} · HTTP ${r.status}`;
    if (!/javascript|ecmascript/.test(tipo)) return `${ruta} · tipo ${tipo || "vacío"}`;
    const texto = await r.text();
    for (const m of texto.matchAll(IMPORTS)) { const p = m[1] || m[2]; if (p.startsWith(".")) cola.push(new URL(p, url).href); }
  }
  return `todos los módulos cargan (${vistos.size})`;
}
