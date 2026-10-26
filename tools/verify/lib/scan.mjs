/* Utilidades de análisis estático compartidas por las herramientas de verificación.
   Solo leen: nunca escriben en el proyecto que analizan. */
import fs from "node:fs";
import path from "node:path";

export const SKIP_DIRS = new Set(["node_modules", ".git", "venv", "__pycache__", "log"]);
/* Carpetas con miles de recursos que no contienen código propio: no se recorren al buscar código. */
export const BULK_DIRS = new Set(["fonts", "emoji", "files", "vendor"]);

export const toPosix = p => p.replace(/\\/g, "/");

export function walk(root, { exts = null, skipBulk = true } = {}) {
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(d, e.name);
      /* Las herramientas de verificación y migración no forman parte de la web que se analiza. */
      if (e.isDirectory() && /^tools\/(verify|migrate)$/.test(toPosix(path.relative(root, p)))) continue;
      if (e.isDirectory()) {
        if (skipBulk && BULK_DIRS.has(e.name)) continue;
        rec(p);
      } else if (!exts || exts.has(path.extname(e.name).toLowerCase())) out.push(p);
    }
  })(root);
  return out;
}

export const rel = (root, p) => toPosix(path.relative(root, p));
const CODE = new Set([".js", ".mjs"]);
const IMPORT_RE = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[;\s])import\s*['"]([^'"]+)['"]/g;
const URL_RE = /new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g;
const SOFT_RE = /['"`]((?:\.\/)?(?:assets|fonts|lut|stickers|css|js|raw|hdr|camaras|vintagefilter)\/[^'"`\s${}]+\.[a-z0-9]{2,5})(?:\?[^'"`\s]*)?['"`]/gi;

export function stripQuery(s) { return s.split("?")[0].split("#")[0]; }

/** Referencias de un archivo de código: { hard:[{spec,kind,target}], soft:[...] } con rutas relativas a root. */
export function jsRefs(root, file) {
  const src = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  const hard = [], soft = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] || m[2] || m[3];
    if (!spec || !spec.startsWith(".")) continue;
    hard.push({ spec, kind: m[2] ? "dynamic" : "static", target: rel(root, path.resolve(dir, stripQuery(spec))) });
  }
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(src))) {
    const spec = m[1];
    if (/^(https?:|data:|blob:)/.test(spec)) continue;
    hard.push({ spec, kind: "url", target: rel(root, path.resolve(dir, stripQuery(spec))) });
  }
  /* Rutas relativas escritas como texto fuera de un import (p. ej. mod("../filters/basic.js") en
     editor/filterregistry.js, que luego hace import(path)): un mover archivos que sólo mire los import no las vería. */
  const seen = new Set(hard.map(h => h.kind + "|" + h.spec));
  const STR_RE = /["'`](\.{1,2}\/[^"'`\s${}]+\.(?:m?js|css|json|webp|png|svg|onnx|ort|wasm|cube))(?:\?[^"'`\s]*)?["'`]/g;
  while ((m = STR_RE.exec(src))) {
    const spec = m[1];
    if (seen.has("static|" + spec) || seen.has("dynamic|" + spec) || seen.has("url|" + spec)) continue;
    /* ¿Relativa al módulo o a la página (raíz web)? register("./sw.js") en js/pwa.js es de la página. */
    const fileT = rel(root, path.resolve(dir, stripQuery(spec)));
    const pageT = rel(root, path.resolve(root, stripQuery(spec)));
    const ok = t => { try { return fs.statSync(path.join(root, t)).isFile(); } catch { return false; } };
    if (!ok(fileT) && ok(pageT)) hard.push({ spec, kind: "string", base: "page", target: pageT });
    else hard.push({ spec, kind: "string", base: "file", target: fileT });
  }
  SOFT_RE.lastIndex = 0;
  while ((m = SOFT_RE.exec(src))) {
    const spec = m[1];
    soft.push({ spec, kind: "soft", target: rel(root, path.resolve(root, stripQuery(spec))) });
  }
  return { hard, soft, src };
}

export function cssRefs(root, file) {
  const src = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  const hard = [];
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(?:url\()?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = (m[2] || m[3] || "").trim();
    if (!spec || /^(data:|https?:|#|blob:)/.test(spec)) continue;
    const base = spec.startsWith("/") ? root : dir;
    hard.push({ spec, kind: "css", target: rel(root, path.resolve(base, stripQuery(spec.replace(/^\//, "")))) });
  }
  return { hard, soft: [] };
}

export function htmlRefs(root, file) {
  const src = fs.readFileSync(file, "utf8");
  const hard = [];
  const re = /\b(?:src|href|content)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1].trim();
    if (!spec || /^(data:|https?:|mailto:|#|\/\/|blob:)/.test(spec)) continue;
    if (!/\.(js|mjs|css|webp|png|jpe?g|svg|ico|webmanifest|json|xml|woff2?)(\?|#|$)/i.test(spec)) continue;
    const base = spec.startsWith("/") ? root : path.dirname(file);
    hard.push({ spec, kind: "html", target: rel(root, path.resolve(base, stripQuery(spec.replace(/^\//, "")))) });
  }
  return { hard, soft: [] };
}

export function manifestRefs(root, file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  return { hard: (j.icons || []).map(i => ({ spec: i.src, kind: "manifest", target: rel(root, path.resolve(path.dirname(file), i.src)) })), soft: [] };
}

/** Todos los archivos que contienen referencias y sus referencias. */
export function collectRefs(root) {
  const all = walk(root, { exts: new Set([".js", ".mjs", ".css", ".html", ".webmanifest"]) });
  const out = new Map();
  for (const f of all) {
    const r = rel(root, f);
    if (r.startsWith("js/vendor/")) continue;
    const ext = path.extname(f).toLowerCase();
    try {
      if (CODE.has(ext)) { const x = jsRefs(root, f); out.set(r, { hard: x.hard, soft: x.soft }); }
      else if (ext === ".css") out.set(r, cssRefs(root, f));
      else if (ext === ".html") out.set(r, htmlRefs(root, f));
      else if (ext === ".webmanifest") out.set(r, manifestRefs(root, f));
    } catch (e) { out.set(r, { hard: [], soft: [], error: String(e) }); }
  }
  return out;
}

const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
  /export\s+class\s+([A-Za-z_$][\w$]*)/g,
  /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g
];

export function exportsOf(src) {
  const names = new Set();
  for (const re of EXPORT_PATTERNS) { re.lastIndex = 0; let m; while ((m = re.exec(src))) names.add(m[1]); }
  let m;
  const lst = /export\s*\{([^}]*)\}/g;
  while ((m = lst.exec(src))) for (const part of m[1].split(",")) {
    const t = part.trim(); if (!t) continue;
    const as = t.split(/\s+as\s+/); names.add((as[1] || as[0]).trim());
  }
  if (/export\s+default\b/.test(src)) names.add("default");
  const star = /export\s*\*\s*(?:as\s+(\w+)\s*)?from\s*['"]([^'"]+)['"]/g;
  while ((m = star.exec(src))) names.add(m[1] ? m[1] : "*from:" + path.basename(stripQuery(m[2])));
  return [...names].sort();
}

/** Strings que parecen ids de comando ("grupo.accion"); luego se filtran en ejecución con commands.get(). */
export function commandCandidates(root) {
  const set = new Set();
  const re = /["'`]([a-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*)["'`]/g;
  const files = [...walk(root, { exts: new Set([".js", ".html"]) })].filter(f => {
    const r = rel(root, f); return !r.startsWith("js/vendor/") && !r.startsWith("tests/") && !r.includes("/tests/");
  });
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8"); let m; re.lastIndex = 0;
    while ((m = re.exec(s))) set.add(m[1]);
  }
  return [...set].sort();
}

export function storageKeys(root) {
  const keys = new Set(), idb = new Set(), caches = new Set();
  const files = walk(root, { exts: CODE }).filter(f => { const r = rel(root, f); return !r.startsWith("js/vendor/") && !r.startsWith("tests/") && !r.includes("/tests/"); });
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8"); let m;
    const k = /["'`](realify\.[A-Za-z0-9_.\-]+)/g; while ((m = k.exec(s))) keys.add(m[1]);
    const d = /indexedDB\.open\(\s*["'`]([^"'`]+)/g; while ((m = d.exec(s))) idb.add(m[1]);
    const d2 = /\bDB_NAME\s*=\s*["'`]([^"'`]+)/g; while ((m = d2.exec(s))) idb.add(m[1]);
    const c = /caches\.open\(\s*["'`]([^"'`]+)/g; while ((m = c.exec(s))) caches.add(m[1]);
  }
  return { localStorage: [...keys].sort(), indexedDB: [...idb].sort(), caches: [...caches].sort() };
}

/** Componentes fuertemente conectados (ciclos) de un grafo Map<string, Set<string>>. */
export function cycles(graph) {
  let idx = 0; const st = [], on = new Set(), I = new Map(), L = new Map(), out = [];
  const sc = v => {
    I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v);
    for (const w of graph.get(v) || []) {
      if (!graph.has(w)) continue;
      if (!I.has(w)) { sc(w); L.set(v, Math.min(L.get(v), L.get(w))); }
      else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w)));
    }
    if (L.get(v) === I.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) out.push(c.sort()); }
  };
  for (const v of graph.keys()) if (!I.has(v)) sc(v);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
