/* FASE 1 · Mover, no reescribir.
   Copia «Realify - copia» a «Realify - Mejorado» con la nueva estructura de carpetas y reescribe todas las
   referencias a archivos movidos (import, import(), new URL(...), rutas escritas como texto, url() de CSS, enlaces
   de HTML y de Markdown). No cambia ninguna línea de lógica.

     node tools/migrate/phase1.mjs [--src <copia>] [--dst <mejorado>] [--dry]

   Reglas de seguridad: lee SOLO de la copia; escribe SOLO en «Realify - Mejorado»; se niega a tocar cualquier otra
   ruta. Es idempotente: antes de copiar borra lo anterior de Mejorado, salvo tools/verify, tools/migrate y log/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = path.resolve(arg("src", "C:/Proyectos/Realify - copia"));
const DST = path.resolve(arg("dst", path.resolve(here, "..", "..")));
const DRY = process.argv.includes("--dry");

/* ── guardas ─────────────────────────────────────────────────── */
const lower = p => p.replace(/\\/g, "/").toLowerCase();
if (!lower(SRC).endsWith("/realify - copia")) throw new Error("El origen debe ser «Realify - copia»: " + SRC);
if (!lower(DST).endsWith("/realify - mejorado")) throw new Error("El destino debe ser «Realify - mejorado»: " + DST);
if (lower(SRC).endsWith("/proyectos/realify") || lower(DST).endsWith("/proyectos/realify")) throw new Error("Prohibido tocar C:\\Proyectos\\Realify");

/* Esta fase BORRA el contenido del destino antes de copiar. Si el proyecto ya tiene trabajo hecho, se niega. */
if (!DRY && fs.existsSync(path.join(DST, "index.html")) && !process.argv.includes("--force"))
  throw new Error("El destino ya contiene el proyecto (hay index.html). Ejecutar esta fase lo borraría y perdería las fases posteriores. Usa --force solo si es lo que quieres.");

/* ── mapa de carpetas ────────────────────────────────────────── */
const PLUGINS = {
  camaras: "cameras", comparar: "compare", cortar: "slice", formas: "shape-crop", frames: "frames", hdr: "hdr",
  hojacontactos: "contact-sheet", lote: "batch", lut: "lut", memes: "memes", panorama: "panorama", raw: "raw",
  socialmediapost: "social-post", stickers: "stickers", unir: "merge", vintagefilter: "vintage"
};
const PANORAMA_SERVER = new Set(["server.py", "realify-panorama.service", "requirements.txt", "nginx.conf.example", "README.md"]);
const ROOT_DOCS = new Set(["CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "DEPLOY.md", "PENDIENTE.md", "RELEASE.md", "SECURITY.md"]);
const ROOT_DESIGN = new Set(["icono.png", "logo.png", "og-image.png"]);
const EXCLUDE_TOP = new Set([".git", "log", "node_modules"]);
const isExcluded = rel => { const p = rel.split("/"); return EXCLUDE_TOP.has(p[0]) || p.includes("venv") || p.includes("__pycache__"); };

/** Destino (relativo a la raíz) de una ruta de la copia. Sirve para archivos y para carpetas. */
function destOf(rel) {
  rel = rel.replace(/^\.\//, "").replace(/\/+$/, "");
  if (rel === "" || rel === ".") return "";
  const parts = rel.split("/");
  const first = parts[0], rest = parts.slice(1);
  if (parts.length === 1) {
    if (ROOT_DOCS.has(first)) return "docs/" + first;
    if (ROOT_DESIGN.has(first)) return "design/" + first;
  }
  if (rel === "server/nginx-realify.conf.example") return "server/nginx/nginx-realify.conf.example";
  if (first in PLUGINS) {
    const name = PLUGINS[first];
    if (first === "panorama" && rest.length === 1 && PANORAMA_SERVER.has(rest[0])) return "server/panorama/" + rest[0];
    if (rest[0] === "tests") return ["tests/plugins", name, ...rest.slice(1)].join("/");
    if (first === "frames" && rest.length === 1 && rest[0] === "test-marcos.mjs") return "tests/plugins/frames/test-marcos.mjs";
    if (first === "camaras" && rest.length === 1 && rest[0] === "camaras.css") return "plugins/cameras/cameras.css";
    return ["plugins", name, ...rest].join("/");
  }
  return rel;
}

/* ── utilidades de lectura de la copia ───────────────────────── */
const srcPath = rel => path.join(SRC, rel);
const existsSrc = rel => { try { fs.statSync(srcPath(rel)); return true; } catch { return false; } };
const posix = path.posix;
const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".md", ".py"]);
const CODE_EXT = new Set([".js", ".mjs"]);

const files = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (isExcluded(r)) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name), r); else files.push(r);
  }
})(SRC, "");

/* ── reescritura de referencias ──────────────────────────────── */
const stats = { moved: 0, rewritten: {}, mention: 0, rootFix: 0, unresolved: [], filesChanged: 0 };
const bump = k => { stats.rewritten[k] = (stats.rewritten[k] || 0) + 1; };

/** Resuelve un texto de ruta escrito en `fileOld`. Devuelve { target (relativo a raíz, copia), base } o null. */
function resolveSpec(fileOld, spec, { allowPage = true } = {}) {
  const clean = spec.split("?")[0].split("#")[0];
  if (!clean) return null;
  if (clean.startsWith("/")) { const t = posix.normalize(clean.slice(1)); return existsSrc(t === "." ? "" : t) ? { target: t === "." ? "" : t, base: "root" } : null; }
  const t1 = posix.normalize(posix.join(posix.dirname(fileOld), clean));
  if (!t1.startsWith("..") && existsSrc(t1 === "." ? "" : t1)) return { target: t1 === "." ? "" : t1, base: "file" };
  if (allowPage) { const t2 = posix.normalize(clean); if (!t2.startsWith("..") && existsSrc(t2 === "." ? "" : t2)) return { target: t2 === "." ? "" : t2, base: "page" }; }
  return null;
}

/** Texto nuevo de una ruta, dado dónde está ahora el archivo y dónde está ahora el destino. */
function newSpec(fileNew, orig, res) {
  const clean = orig.split("?")[0].split("#")[0];
  const tail = orig.slice(clean.length);
  const tNew = destOf(res.target);
  const slash = clean.endsWith("/");
  if (res.base === "root") return "/" + tNew + (slash && tNew ? "/" : "") + tail;
  if (res.base === "page") {
    // relativa a la página (raíz web): se conserva el estilo («./x» o «x»)
    const s = (clean.startsWith("./") ? "./" : "") + (tNew || ".") + (slash && tNew ? "/" : "");
    return s + tail;
  }
  // ¿el texto original, leído desde el sitio nuevo del archivo, ya apunta al destino nuevo? → se deja tal cual
  const asIs = posix.normalize(posix.join(posix.dirname(fileNew) === "." ? "" : posix.dirname(fileNew), clean));
  if ((asIs === "." ? "" : asIs) === tNew) return orig;
  let rel = posix.relative(posix.dirname(fileNew) || ".", tNew || ".");
  if (rel === "") rel = ".";
  if (!rel.startsWith(".")) rel = "./" + rel;
  if (slash && !rel.endsWith("/")) rel += "/";
  return rel + tail;
}

function rewriteLiteral(fileOld, fileNew, spec) {
  const res = resolveSpec(fileOld, spec);
  if (!res) return null;
  const moved = fileOld !== fileNew || destOf(res.target) !== res.target;
  if (!moved) return null;
  const out = newSpec(fileNew, spec, res);
  return out === spec ? null : out;
}

const oldDirs = Object.keys(PLUGINS).join("|");
const MENTION = new RegExp(`(?<=[\\s"'\`(=:,\\[<>])(\\/?)(${oldDirs}|server\\/nginx-realify\\.conf\\.example|CHANGELOG\\.md|CONTRIBUTING\\.md|CODE_OF_CONDUCT\\.md|DEPLOY\\.md|PENDIENTE\\.md|RELEASE\\.md|SECURITY\\.md)((?:\\/[\\w.\\-$\\{\\}/]*)?)`, "g");

/** Menciones de rutas en comentarios, selectores y cadenas absolutas («/raw/index.js», `lut/files/`, «PENDIENTE.md»). */
function rewriteMentions(src, nextCharGuard = true) {
  return src.replace(MENTION, (m, lead, head, rest, offset, whole) => {
    let tailTrim = "";
    let r = rest;
    const mt = r.match(/[.\-]+$/); if (mt) { tailTrim = mt[0]; r = r.slice(0, -mt[0].length); }
    const staticPart = r.split("$")[0];
    const cand = (head + staticPart).replace(/\/+$/, "");
    if (!existsSrc(cand)) return m;
    // mención «solo carpeta» (p. ej. «raw/»): sólo si la sigue un cierre claro; si no, podría ser una división
    if (nextCharGuard && r === "/" && !tailTrim) {
      const nxt = whole[offset + m.length] || "";
      if (!/[)`'"\],;:.»\n]/.test(nxt)) return m;
    }
    if (r === "" && /^[A-Za-z]+$/.test(head) && head in PLUGINS) {
      // «raw» a secas, sin barra: no es una ruta
      return m;
    }
    const d = destOf(cand);
    if (d === cand) return m;
    const tailStatic = r.slice(staticPart.length);
    return lead + d + (staticPart.endsWith("/") ? "/" : "") + tailStatic + tailTrim;
  });
}

const LIT = /(["'`])(\.{1,2}\/[^"'`\n\r$]*)\1/g;

function processJs(fileOld, fileNew, src) {
  let changed = false;
  let out = src.replace(LIT, (m, q, spec) => {
    const n = rewriteLiteral(fileOld, fileNew, spec);
    if (n === null) {
      if (!resolveSpec(fileOld, spec) && /\.(m?js|css|json|wasm|onnx|html)$/.test(spec)) stats.unresolved.push(`${fileOld}: ${spec}`);
      return m;
    }
    bump("literal"); changed = true; return q + n + q;
  });
  // raíz del repositorio derivada con path.resolve(<dir del archivo>, "..") en archivos que cambian de profundidad
  if (fileOld !== fileNew) {
    out = out.replace(/(import\.meta\.url\)\s*\)\s*,\s*)(["'])\.\.\2/g, (m, pre, q) => {
      const rel = posix.relative(posix.dirname(fileNew), "") || ".";
      stats.rootFix++; return pre + q + rel + q;
    });
  }
  const out2 = rewriteMentions(out);
  if (out2 !== out) { stats.mention += 1; }
  return out2;
}

function processCss(fileOld, fileNew, src) {
  const fix = (spec) => { const n = rewriteLiteral(fileOld, fileNew, spec); if (n === null) return null; bump("css"); return n; };
  let out = src.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, spec) => {
    if (/^(data:|https?:|#|blob:)/.test(spec)) return m;
    const n = fix(spec.trim()); return n === null ? m : `url(${q}${n}${q})`;
  });
  out = out.replace(/@import\s+(url\()?(['"])([^'"]+)\2/g, (m, u, q, spec) => { const n = fix(spec); return n === null ? m : m.replace(spec, n); });
  return rewriteMentions(out);
}

function processHtml(fileOld, fileNew, src) {
  let out = src.replace(/(\b(?:src|href)\s*=\s*["'])([^"']+)(["'])/g, (m, pre, spec, post) => {
    if (/^(data:|https?:|mailto:|#|\/\/|blob:)/.test(spec)) return m;
    const n = rewriteLiteral(fileOld, fileNew, spec); if (n === null) return m;
    bump("html"); return pre + n + post;
  });
  return rewriteMentions(out);
}

function processMd(fileOld, fileNew, src, historic) {
  let out = src.replace(/\]\(([^)\s#]+)(#[^)]*)?\)/g, (m, spec, frag = "") => {
    if (/^(https?:|mailto:|data:)/.test(spec)) return m;
    const n = rewriteLiteral(fileOld, fileNew, spec); if (n === null) return m;
    bump("md"); return `](${n}${frag})`;
  });
  out = out.replace(/(\b(?:src|href)\s*=\s*["'])([^"'#]+)(["'])/g, (m, pre, spec, post) => {
    if (/^(https?:|mailto:|data:)/.test(spec)) return m;
    const n = rewriteLiteral(fileOld, fileNew, spec); if (n === null) return m;
    bump("md"); return pre + n + post;
  });
  return historic ? out : rewriteMentions(out);
}

/* Rutas absolutas del VPS que cambian al mover el servicio de panorámicas a server/panorama (ver docs/DEPLOY.md). */
const VPS_FIXES = [
  [/\/var\/www\/realify\.es\/panorama\b/g, "/var/www/realify.es/server/panorama"],
  [/\/var\/www\/realify\/panorama\b/g, "/var/www/realify/server/panorama"]
];

function transform(fileOld, fileNew, buf) {
  const ext = path.extname(fileOld).toLowerCase();
  if (!TEXT_EXT.has(ext) && !/\.(service|example)$/.test(fileOld)) return buf;
  if (fileOld.startsWith("js/vendor/") || fileOld.includes("/vendor/")) return buf;
  let src = buf.toString("utf8");
  if (src.includes("\uFFFD")) return buf;   // no es UTF-8 limpio: no se toca
  let out = src;
  if (CODE_EXT.has(ext)) out = processJs(fileOld, fileNew, src);
  else if (ext === ".css") out = processCss(fileOld, fileNew, src);
  else if (ext === ".html") out = processHtml(fileOld, fileNew, src);
  else if (ext === ".md") out = processMd(fileOld, fileNew, src, /(^|\/)(CHANGELOG|PENDIENTE)\.md$/.test(fileOld));
  else if (ext === ".py") out = rewriteMentions(src);
  if (["panorama/README.md", "panorama/realify-panorama.service", "panorama/nginx.conf.example", "README.md", "DEPLOY.md"].includes(fileOld))
    for (const [re, to] of VPS_FIXES) out = out.replace(re, to);
  return out === src ? buf : Buffer.from(out, "utf8");
}

/* ── ejecución ───────────────────────────────────────────────── */
const KEEP = [["tools", "verify"], ["tools", "migrate"], ["log"]];
function clean() {
  for (const e of fs.readdirSync(DST, { withFileTypes: true })) {
    if (e.name === "log") continue;
    const p = path.join(DST, e.name);
    if (e.name === "tools") {
      for (const t of fs.readdirSync(p)) if (t !== "verify" && t !== "migrate") fs.rmSync(path.join(p, t), { recursive: true, force: true });
      continue;
    }
    fs.rmSync(p, { recursive: true, force: true });
  }
}
const moves = {};
const t0 = Date.now();
if (!DRY) { fs.mkdirSync(DST, { recursive: true }); clean(); fs.mkdirSync(path.join(DST, "log"), { recursive: true }); }

for (const rel of files) {
  const dest = destOf(rel);
  if (dest !== rel) {
    stats.moved++;
    if (/\.(m?js|css|html|md|py|service|example|json)$/.test(rel)) moves[rel] = dest;
  }
  if (DRY) continue;
  const to = path.join(DST, dest);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const ext = path.extname(rel).toLowerCase();
  if (TEXT_EXT.has(ext) || /\.(service|example)$/.test(rel)) {
    const buf = fs.readFileSync(srcPath(rel));
    const out = transform(rel, dest, buf);
    if (out !== buf) stats.filesChanged++;
    fs.writeFileSync(to, out);
  } else fs.copyFileSync(srcPath(rel), to);
}

if (!DRY) {
  fs.writeFileSync(path.join(DST, "tools", "verify", "moves.phase1.json"), JSON.stringify(moves, null, 1));
  fs.writeFileSync(path.join(DST, "tools", "migrate", "phase1.report.json"), JSON.stringify({ ...stats, unresolved: [...new Set(stats.unresolved)] }, null, 1));
}
console.log(`${DRY ? "[simulación] " : ""}archivos: ${files.length} · movidos: ${stats.moved} · con texto reescrito: ${stats.filesChanged}`);
console.log(`referencias reescritas:`, JSON.stringify(stats.rewritten), `· archivos con menciones corregidas: ${stats.mention} · raíz derivada corregida: ${stats.rootFix}`);
console.log(`rutas sin resolver (revisar): ${new Set(stats.unresolved).size}`);
for (const u of [...new Set(stats.unresolved)].slice(0, 20)) console.log("  ", u);
console.log(`tiempo: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
