/* Compara dos resultados de smoke.mjs (o dos de static-check.mjs) y dice qué ha cambiado.
     node compare.mjs smoke  <base.json> <nuevo.json>
     node compare.mjs static <base.json> <nuevo.json> [moves.json]
   En «static», moves.json ({ "ruta/antigua.js": "ruta/nueva.js" }) traduce los módulos movidos.
   Código de salida 0 = equivalentes; 1 = hay diferencias. */
import fs from "node:fs";

const [mode, a, b, movesFile] = process.argv.slice(2);
if (!mode || !a || !b) { console.error("uso: node compare.mjs smoke|static <base.json> <nuevo.json> [moves.json]"); process.exit(2); }
const A = JSON.parse(fs.readFileSync(a, "utf8")), B = JSON.parse(fs.readFileSync(b, "utf8"));
const diffs = [], warnings = [];
const note = (area, msg) => diffs.push(`[${area}] ${msg}`);
const j = x => JSON.stringify(x);

function setDiff(area, x, y, what) {
  const sx = new Set(x), sy = new Set(y);
  for (const v of sx) if (!sy.has(v)) note(area, `falta ${what}: ${v}`);
  for (const v of sy) if (!sx.has(v)) note(area, `sobra ${what}: ${v}`);
}

if (mode === "smoke") {
  for (const side of ["desktop", "mobile"]) {
    const x = A[side], y = B[side];
    /* Solo cuentan como fallo los errores NUEVOS. Que falte uno de la versión de partida es un aviso: algunos dependen del
       momento (p. ej. el de Unmark al cerrar su ventana con una vista previa pendiente) y no siempre ocurren. */
    for (const [what, xa, ya] of [["errores", x.finalErrors, y.finalErrors], ["errores-carga", x.loadErrors, y.loadErrors]]) {
      for (const e of ya) if (!xa.includes(e)) note(side + "." + what, `error nuevo: ${e}`);
      for (const e of xa) if (!ya.includes(e)) warnings.push(`[${side}.${what}] no apareció (ya existía en la versión de partida; puede ser intermitente): ${e.slice(0, 110)}`);
    }
    if (j(x.afterOpen) !== j(y.afterOpen)) note(side, `estado tras abrir imagen distinto: ${j(x.afterOpen)} ≠ ${j(y.afterOpen)}`);
    if (side === "desktop") {
      setDiff("comandos", x.fingerprint.commands, y.fingerprint.commands, "comando");
      if (j(x.fingerprint.tools) !== j(y.fingerprint.tools)) note("herramientas", "lista u orden de herramientas distinto");
      if (j(x.fingerprint.menus) !== j(y.fingerprint.menus)) note("menús", "árbol de menús distinto");
      x.sequence.forEach((s, i) => {
        const t = y.sequence[i];
        if (!t) return note("secuencia", `falta ${s.id}`);
        for (const k of ["layers", "w", "h", "hash", "active", "opensDialog"]) if (s[k] !== t[k]) note("secuencia", `${s.id}: ${k} ${s[k]} → ${t[k]}`);
      });
      x.dialogs.forEach((d, i) => {
        const t = y.dialogs[i];
        if (!t) return note("diálogos", `falta ${d.id}`);
        for (const k of ["opened", "kind", "title"]) if (d[k] !== t[k]) note("diálogos", `${d.id}: ${k} «${d[k]}» → «${t[k]}»`);
      });
      for (const sec of ["gestures", "keys"]) {
        (x[sec] || []).forEach((g, i) => {
          const t = (y[sec] || [])[i];
          if (!t) return note(sec, `falta «${g.name}»`);
          for (const k of ["layers", "w", "h", "hash", "active", "activeType", "selection", "selSum", "tool"]) if (g[k] !== t[k]) note(sec, `«${g.name}»: ${k} ${g[k]} → ${t[k]}`);
          if (JSON.stringify(g.view) !== JSON.stringify(t.view)) note(sec, `«${g.name}»: vista ${JSON.stringify(g.view)} → ${JSON.stringify(t.view)}`);
          if (JSON.stringify(g.newErrors) !== JSON.stringify(t.newErrors)) note(sec, `«${g.name}»: errores distintos`);
        });
      }
      (x.formats || []).forEach((g, i) => {
        const t = (y.formats || [])[i];
        if (!t) return note("formatos", `falta «${g.name}»`);
        for (const k of ["layers", "w", "h", "hash", "activeType", "open"]) if (g[k] !== t[k]) note("formatos", `«${g.name}»: ${k} ${g[k]} → ${t[k]}`);
        if (JSON.stringify(g.newErrors) !== JSON.stringify(t.newErrors)) note("formatos", `«${g.name}»: errores distintos`);
      });
      x.toolRun.forEach((tl, i) => { const t = y.toolRun[i]; if (!t || tl.id !== t.id || tl.current !== t.current) note("herramientas", `${tl.id} no se activa igual`); });
    }
    /* Los hashes de captura son sensibles a diferencias de subpíxel (visto en el cajón móvil entre dos pasadas
       idénticas): se avisan, pero no cuentan como fallo. Se revisan mirando las imágenes. */
    for (const [k, v] of Object.entries(x.screens || {})) if (y.screens?.[k] !== v) warnings.push(`[${side}.capturas] ${k}: hash distinto; revisar visualmente`);
  }
  const pa = A.desktop.perf, pb = B.desktop.perf, ra = pa.runs[0], rb = pb.runs[0];
  console.log(`rendimiento (informativo): arranque ${pa.medianReadyMs} → ${pb.medianReadyMs} ms · peticiones ${ra.requests} → ${rb.requests} · JS ${(ra.jsBytes / 1024) | 0} → ${(rb.jsBytes / 1024) | 0} KB · CSS peticiones ${ra.cssRequests} → ${rb.cssRequests}`);
} else if (mode === "static") {
  /* Varias tablas de movimientos se encadenan en orden: «fase1.json,fase2.json». */
  const chain = movesFile ? movesFile.split(",").map(f => JSON.parse(fs.readFileSync(f, "utf8"))) : [];
  const mv = p => chain.reduce((cur, m) => m[cur] || cur, p);
  setDiff("referencias", [], B.brokenRefs.map(r => `${r.file} → ${r.spec}`), "referencia rota");
  setDiff("almacenamiento.localStorage", A.storage.localStorage, B.storage.localStorage, "clave");
  setDiff("almacenamiento.indexedDB", A.storage.indexedDB, B.storage.indexedDB, "base");
  /* «candidatos» es una lista heurística (cualquier texto con forma «grupo.accion»): un texto nuevo que no es un comando
     (p. ej. «utif.js») no es un problema; lo que importa es que no FALTE ninguno. Los comandos reales se comprueban en
     la prueba de humo, contra el registro de verdad. */
  for (const id of A.commandCandidates) if (!B.commandCandidates.includes(id)) note("comandos", `falta id candidato: ${id}`);
  const ea = Object.fromEntries(Object.entries(A.exportsByFile).map(([k, v]) => [mv(k), v]));
  for (const [f, names] of Object.entries(ea)) {
    const other = B.exportsByFile[f];
    if (!other) { note("exports", `módulo sin exports o ausente: ${f}`); continue; }
    setDiff("exports " + f, names, other, "export");
  }
  const ca = new Set(A.staticCycles.map(c => j(c.map(mv).sort())));
  for (const c of B.staticCycles) if (!ca.has(j(c))) note("ciclos", `ciclo nuevo: ${c.join(" ↔ ")}`);
  console.log(`archivos JS: ${A.jsFiles} → ${B.jsFiles} · líneas: ${A.jsLines} → ${B.jsLines} · ciclos: ${A.staticCycles.length} → ${B.staticCycles.length}`);
}

if (warnings.length) { console.log(`\n${warnings.length} aviso(s) (no son fallo):`); warnings.forEach(w => console.log("  " + w)); }
if (diffs.length) { console.log(`\n${diffs.length} diferencia(s):`); diffs.slice(0, 80).forEach(d => console.log("  " + d)); process.exit(1); }
console.log("EQUIVALENTE: sin diferencias en lo que se compara.");
