/* MOVER ARCHIVOS Y REESCRIBIR REFERENCIAS (en el sitio, sobre «Realify - Mejorado»).
   Dada una tabla «ruta antigua → ruta nueva», mueve los archivos y reescribe en TODO el proyecto cada referencia a
   ellos: import / import() / new URL(..., import.meta.url) / rutas relativas escritas como texto / url() de CSS /
   enlaces de HTML y de Markdown / menciones de rutas en comentarios y cadenas absolutas («/js/core/doc.js»).
   No cambia lógica. Calcula todo en memoria antes de escribir nada; si algo falla, el proyecto queda intacto. */
import fs from "node:fs";
import path from "node:path";

const posix = path.posix;
const TEXT_EXT = new Set([".js", ".mjs", ".css", ".html", ".md", ".py"]);
const CODE_EXT = new Set([".js", ".mjs"]);
const HISTORIC = /(^|\/)(CHANGELOG|PENDIENTE)\.md$/;
const SKIP_TOP = new Set([".git", "node_modules", "log"]);
const SKIP_PREFIX = ["tools/verify/", "tools/migrate/"];
const BULK = new Set(["fonts", "emoji", "files", "vendor"]);

export function listFiles(root) {
  const out = [];
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? rel + "/" + e.name : e.name;
      if (SKIP_TOP.has(r.split("/")[0]) || e.name === "venv" || e.name === "__pycache__") continue;
      if (SKIP_PREFIX.some(p => (r + "/").startsWith(p))) continue;
      if (e.isDirectory()) walk(path.join(dir, e.name), r); else out.push(r);
    }
  })(root, "");
  return out;
}

/**
 * @param {string} root
 * @param {Record<string,string>} moves  ruta antigua → ruta nueva (relativas a root, con «/»)
 * @param {{dry?:boolean}} opts
 */
export function applyMoves(root, moves, { dry = false } = {}) {
  const M = new Map(Object.entries(moves));
  const files = listFiles(root);
  const fileSet = new Set(files);
  for (const [a, b] of M) {
    if (!fileSet.has(a)) throw new Error("No existe el origen del movimiento: " + a);
    if (fileSet.has(b) && !M.has(b)) throw new Error("El destino ya existe: " + b);
  }
  const newSet = new Set(); for (const [, b] of M) { if (newSet.has(b)) throw new Error("Destino repetido: " + b); newSet.add(b); }

  const exists = rel => { try { fs.statSync(path.join(root, rel)); return true; } catch { return false; } };
  const destOf = rel => M.get(rel) ?? rel;
  const stats = { moved: M.size, literal: 0, css: 0, html: 0, md: 0, mentions: 0, filesChanged: 0, warnings: [], unresolved: [] };

  /* ¿Se movió algo dentro de esta carpeta? (una ruta a carpeta no se puede reescribir con seguridad) */
  const dirMoved = dirRel => { const p = dirRel.replace(/\/+$/, "") + "/"; for (const k of M.keys()) if (k.startsWith(p)) return true; return false; };

  function resolveSpec(fileOld, spec) {
    const clean = spec.split("?")[0].split("#")[0];
    if (!clean) return null;
    if (clean.startsWith("/")) { const t = posix.normalize(clean.slice(1)); const tt = t === "." ? "" : t; return exists(tt) ? { target: tt, base: "root" } : null; }
    const t1 = posix.normalize(posix.join(posix.dirname(fileOld), clean));
    if (!t1.startsWith("..") && exists(t1 === "." ? "" : t1)) return { target: t1 === "." ? "" : t1, base: "file" };
    const t2 = posix.normalize(clean);
    if (!t2.startsWith("..") && exists(t2 === "." ? "" : t2)) return { target: t2 === "." ? "" : t2, base: "page" };
    return null;
  }

  function newSpec(fileNew, orig, res) {
    const clean = orig.split("?")[0].split("#")[0];
    const tail = orig.slice(clean.length);
    const tNew = destOf(res.target);
    const slash = clean.endsWith("/");
    if (res.base === "root") return "/" + tNew + (slash && tNew ? "/" : "") + tail;
    if (res.base === "page") return (clean.startsWith("./") ? "./" : "") + (tNew || ".") + (slash && tNew ? "/" : "") + tail;
    const dirNew = posix.dirname(fileNew) === "." ? "" : posix.dirname(fileNew);
    const asIs = posix.normalize(posix.join(dirNew, clean));
    if ((asIs === "." ? "" : asIs) === tNew) return orig;
    let rel = posix.relative(dirNew || ".", tNew || ".");
    if (rel === "") rel = ".";
    if (!rel.startsWith(".")) rel = "./" + rel;
    if (slash && !rel.endsWith("/")) rel += "/";
    return rel + tail;
  }

  function rewriteSpec(fileOld, fileNew, spec) {
    const res = resolveSpec(fileOld, spec);
    if (!res) return null;
    const isDir = !fileSet.has(res.target);
    if (isDir && dirMoved(res.target)) { stats.warnings.push(`${fileOld}: ruta a carpeta con archivos movidos: ${spec}`); return null; }
    const moved = fileOld !== fileNew || destOf(res.target) !== res.target;
    if (!moved) return null;
    const out = newSpec(fileNew, spec, res);
    return out === spec ? null : out;
  }

  /* Menciones: «js/core/doc.js», «core/doc.js», «/js/core/doc.js», «plugins/raw/formats.js» que sean un archivo movido. */
  const MENTION = /(?<=[\s"'`(=:,\[<>])(\/?)((?:js\/)?(?:core|editor|io|ui|filters|features|ai|analysis|cv|exif|gpu|lens)\/[\w.\-/]+\.(?:m?js|css)|plugins\/[\w-]+\/[\w.\-/]+\.(?:m?js|css))/g;
  function mentions(src) {
    return src.replace(MENTION, (m, lead, p) => {
      const hadJs = p.startsWith("js/") || p.startsWith("plugins/");
      const full = hadJs ? p : "js/" + p;
      const d = M.get(full);
      if (!d) return m;
      stats.mentions++;
      return lead + (hadJs ? d : d.replace(/^js\//, ""));
    });
  }

  const LIT = /(["'`])(\.{1,2}\/[^"'`\n\r$]*)\1/g;
  function processJs(fileOld, fileNew, src) {
    const out = src.replace(LIT, (m, q, spec) => {
      const n = rewriteSpec(fileOld, fileNew, spec);
      if (n === null) {
        if (!resolveSpec(fileOld, spec) && /\.(m?js|css|json|wasm|onnx|html)$/.test(spec)) stats.unresolved.push(`${fileOld}: ${spec}`);
        return m;
      }
      stats.literal++; return q + n + q;
    });
    return mentions(out);
  }
  const processCss = (fo, fn, src) => {
    let out = src.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, spec) => {
      if (/^(data:|https?:|#|blob:)/.test(spec)) return m;
      const n = rewriteSpec(fo, fn, spec.trim()); if (n === null) return m; stats.css++; return `url(${q}${n}${q})`;
    });
    out = out.replace(/@import\s+(url\()?(['"])([^'"]+)\2/g, (m, u, q, spec) => { const n = rewriteSpec(fo, fn, spec); return n === null ? m : m.replace(spec, n); });
    return mentions(out);
  };
  const processHtml = (fo, fn, src) => mentions(src.replace(/(\b(?:src|href)\s*=\s*["'])([^"']+)(["'])/g, (m, pre, spec, post) => {
    if (/^(data:|https?:|mailto:|#|\/\/|blob:)/.test(spec)) return m;
    const n = rewriteSpec(fo, fn, spec); if (n === null) return m; stats.html++; return pre + n + post;
  }));
  const processMd = (fo, fn, src, historic) => {
    let out = src.replace(/\]\(([^)\s#]+)(#[^)]*)?\)/g, (m, spec, frag = "") => {
      if (/^(https?:|mailto:|data:)/.test(spec)) return m;
      const n = rewriteSpec(fo, fn, spec); if (n === null) return m; stats.md++; return `](${n}${frag})`;
    });
    return historic ? out : mentions(out);
  };

  /* ── cálculo en memoria ── */
  const out = new Map();   // ruta nueva → Buffer
  const touched = new Set();
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    const fileNew = destOf(rel);
    const isText = TEXT_EXT.has(ext) && !rel.startsWith("js/vendor/") && !BULK.has(rel.split("/").find(s => BULK.has(s)) || "");
    if (!isText) { if (fileNew !== rel) touched.add(rel); continue; }
    const buf = fs.readFileSync(path.join(root, rel));
    const src = buf.toString("utf8");
    if (src.includes("�")) { if (fileNew !== rel) touched.add(rel); continue; }
    let res = src;
    if (CODE_EXT.has(ext)) res = processJs(rel, fileNew, src);
    else if (ext === ".css") res = processCss(rel, fileNew, src);
    else if (ext === ".html") res = processHtml(rel, fileNew, src);
    else if (ext === ".md") res = processMd(rel, fileNew, src, HISTORIC.test(rel));
    else if (ext === ".py") res = mentions(src);
    if (res !== src) { out.set(fileNew, Buffer.from(res, "utf8")); stats.filesChanged++; touched.add(rel); }
    else if (fileNew !== rel) { out.set(fileNew, buf); touched.add(rel); }
  }
  /* los movidos que no eran texto procesable: se mueven tal cual */
  const rawMoves = [...M.keys()].filter(k => !out.has(M.get(k)));

  if (dry) return { stats, out: out.size, rawMoves: rawMoves.length };

  /* ── escritura: primero se retiran los movidos, luego se escribe todo ── */
  const buffers = new Map(rawMoves.map(k => [M.get(k), fs.readFileSync(path.join(root, k))]));
  for (const k of M.keys()) fs.rmSync(path.join(root, k));
  for (const [rel, buf] of [...out, ...buffers]) {
    const to = path.join(root, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, buf);
  }
  /* carpetas vacías */
  const dirs = new Set([...M.keys()].map(k => posix.dirname(k)));
  for (const d of [...dirs].sort((a, b) => b.length - a.length)) {
    let cur = d;
    while (cur && cur !== ".") {
      const p = path.join(root, cur);
      try { if (fs.readdirSync(p).length === 0) fs.rmdirSync(p); else break; } catch { break; }
      cur = posix.dirname(cur);
    }
  }
  return { stats };
}
