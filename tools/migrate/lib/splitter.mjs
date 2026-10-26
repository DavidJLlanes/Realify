/* DIVISOR DE MÓDULOS (basado en AST).
   Reparte las sentencias de primer nivel de un módulo entre varios módulos nuevos SIN cambiar su código: el texto de
   cada sentencia se copia tal cual. Calcula solo los imports y exports que hacen falta y comprueba, antes de escribir
   nada, que el resultado es válido:
     · una variable de módulo (`let`) que se asigna desde otro módulo no se puede exportar → se aborta;
     · si el reparto crea ciclos entre los módulos resultantes → se aborta (salvo allowCycles);
     · todos los nombres del plan existen y ningún nombre queda en dos módulos.
   El módulo original conserva su API: reexporta (export … from) todo lo exportado que se haya movido.
   Requiere `acorn` (se busca en la carpeta indicada por PW_CORE; vive fuera del proyecto). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const posix = path.posix;
const NL = "\n";
const acorn = (() => {
  /* acorn viene de las dependencias de desarrollo (npm install en la raíz); ACORN_DIR/PW_CORE permiten otra carpeta */
  const dir = process.env.ACORN_DIR || process.env.PW_CORE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  return createRequire(path.join(dir, "x.js"))("acorn");
})();

/* ───────── análisis ───────── */
export function parse(src) { return acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true }); }

const SKIP_KEYS = new Set(["type", "start", "end", "loc"]);

/** Identificadores que PUEDEN ser referencias a un binding (por exceso: ignora claves de propiedad y `.prop`). */
export function referencedNames(node, into = new Set()) {
  (function visit(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      if (parent) {
        if (parent.type === "MemberExpression" && key === "property" && !parent.computed) return;
        if ((parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && key === "key" && !parent.computed && !parent.shorthand) return;
        if (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement") return;
      }
      into.add(n.name); return;
    }
    for (const k of Object.keys(n)) {
      if (SKIP_KEYS.has(k)) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => c && typeof c.type === "string" && visit(c, n, k));
      else if (v && typeof v.type === "string") visit(v, n, k);
    }
  })(node, null, null);
  return into;
}

/** Nombres que declara una sentencia de primer nivel. */
function declaredNames(d) {
  const names = [];
  const pat = p => {
    if (!p) return;
    if (p.type === "Identifier") names.push(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach(x => pat(x.value || x.argument));
    else if (p.type === "ArrayPattern") p.elements.forEach(pat);
    else if (p.type === "AssignmentPattern") pat(p.left);
    else if (p.type === "RestElement") pat(p.argument);
  };
  if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") names.push(d.id.name);
  else if (d.type === "VariableDeclaration") d.declarations.forEach(x => pat(x.id));
  return names;
}

/** Nombres a los que se ASIGNA (=, +=, ++, --, desestructuración) dentro de un nodo. */
function assignedNames(node, into = new Set()) {
  const collect = (t, set) => {
    if (!t) return;
    if (t.type === "Identifier") set.add(t.name);
    else if (t.type === "ObjectPattern") t.properties.forEach(x => collect(x.value || x.argument, set));
    else if (t.type === "ArrayPattern") t.elements.forEach(e => collect(e, set));
  };
  (function visit(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "AssignmentExpression") collect(n.left, into);
    else if (n.type === "UpdateExpression") collect(n.argument, into);
    for (const k of Object.keys(n)) {
      if (SKIP_KEYS.has(k)) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v);
    }
  })(node);
  return into;
}

export function analyze(src) {
  const ast = parse(src);
  const imports = new Map();            // nombre local → { spec, from }
  const importNodes = [];
  const units = [];
  let prevEnd = 0, hasPrev = false;
  let fileHeader = "";
  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") {
      importNodes.push(n);
      for (const s of n.specifiers) imports.set(s.local.name, { spec: s, from: n.source.value });
      prevEnd = n.end; hasPrev = true; continue;
    }
    const decl = n.type.startsWith("Export") && n.declaration ? n.declaration : n;
    const gap = src.slice(prevEnd, n.start);
    const firstNl = hasPrev ? gap.indexOf(NL) : -2;   // sin nodo anterior: nada es «cola» de otra sentencia
    /* lo que queda en la misma línea tras la sentencia anterior (p. ej. «; // nota») es de ella, no de esta */
    const trail = firstNl >= 0 ? gap.slice(0, firstNl) : (hasPrev ? gap : "");
    if (trail.trim() && units.length) units[units.length - 1].text += trail.replace(/\s+$/, "");
    const from = prevEnd + (firstNl >= 0 ? firstNl + 1 : 0);
    const lead = src.slice(from, n.start);
    const keepLead = lead.trim() === "" ? "" : lead.replace(/^(\s*\n)+/, "");
    let leadForUnit = keepLead;
    if (!hasPrev && !importNodes.length && /^\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/.test(lead)) {
      /* cabecera del archivo: todo el bloque inicial de comentarios hasta la primera línea en blanco tras él */
      const m = /^(\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n?)\s*)+/.exec(lead);
      fileHeader = m ? lead.slice(0, m[0].length).replace(/\s+$/, "") : "";
      leadForUnit = m ? lead.slice(m[0].length).replace(/^(\s*\n)+/, "") : keepLead;
    }
    units.push({
      node: n, decl, exported: decl !== n, names: declaredNames(decl), start: n.start, end: n.end,
      text: leadForUnit + src.slice(n.start, n.end), declOffset: leadForUnit.length,
      line: src.slice(0, n.start).split(NL).length, lines: src.slice(n.start, n.end).split(NL).length,
      isLet: decl.type === "VariableDeclaration" && decl.kind === "let",
      refs: new Set(), assigns: assignedNames(n), type: decl.type
    });
    prevEnd = n.end; hasPrev = true;
  }
  if (units.length) {
    const tail = src.slice(prevEnd); const nl = tail.indexOf(NL); const t = nl >= 0 ? tail.slice(0, nl) : tail;
    if (t.trim()) units[units.length - 1].text += t.replace(/\s+$/, "");
  }
  const declared = new Map();           // nombre → unidad
  units.forEach(u => u.names.forEach(nm => declared.set(nm, u)));
  for (const u of units) { referencedNames(u.node, u.refs); for (const nm of u.names) u.refs.delete(nm); }
  return { ast, imports, importNodes, units, declared, src, fileHeader };
}

/* ───────── plan ───────── */
/**
 * @param {string} root  raíz del proyecto
 * @param {string} file  módulo a dividir (relativo a root)
 * @param {Array<{file:string, names?:string[], select?:(u:object)=>boolean, header?:string}>} groups
 *        `file` es relativo a la carpeta de `file`. Lo que no se asigne a ningún grupo se queda en el original.
 * @param {{dry?:boolean, allowCycles?:boolean}} opts
 */
export function splitFile(root, file, groups, { dry = false, allowCycles = false, src: srcOverride = null, importAllGroups = false } = {}) {
  const src = srcOverride ?? fs.readFileSync(path.join(root, file), "utf8");
  const A = analyze(src);
  const dir = posix.dirname(file);
  const owner = new Map();                // unidad → índice de grupo (−1 = se queda en el original)
  A.units.forEach(u => owner.set(u, -1));
  const problems = [];
  groups.forEach((g, gi) => {
    for (const nm of g.names || []) {
      const u = A.declared.get(nm);
      if (!u) { problems.push(`${g.file}: no existe el binding «${nm}» en ${file}`); continue; }
      if (owner.get(u) !== -1 && owner.get(u) !== gi) problems.push(`«${nm}» está en dos grupos`);
      owner.set(u, gi);
    }
    if (g.select) for (const u of A.units) if (g.select(u)) {
      if (owner.get(u) !== -1 && owner.get(u) !== gi) problems.push(`la sentencia de la línea ${u.line} está en dos grupos`);
      owner.set(u, gi);
    }
  });
  for (const u of A.units) if (u.names.length > 1) {
    const g = owner.get(u);
    for (const nm of u.names) if (owner.get(A.declared.get(nm)) !== g) problems.push(`sentencia de la línea ${u.line} partida entre grupos`);
  }
  if (problems.length) throw new Error("Plan inválido:\n  " + problems.join("\n  "));

  const modOf = u => { const g = owner.get(u); return g === -1 ? file : posix.join(dir, groups[g].file); };
  const mods = [file, ...groups.map(g => posix.join(dir, g.file))];
  const exportedNeeded = new Set();       // nombres que otros módulos importan
  const edges = new Map(mods.map(m => [m, new Set()]));
  const needsFrom = new Map(mods.map(m => [m, new Map()]));   // módulo → origen → nombres
  const importUse = new Map(mods.map(m => [m, new Set()]));   // módulo → nombres importados del original que usa

  for (const u of A.units) {
    const m = modOf(u);
    for (const r of u.refs) {
      if (A.imports.has(r)) { importUse.get(m).add(r); continue; }
      const v = A.declared.get(r);
      if (!v) continue;                   // global del navegador
      const vm = modOf(v);
      if (vm === m) continue;
      if (v.isLet && u.assigns.has(r)) throw new Error(`«${r}» es una variable de módulo (let) declarada en ${vm} pero asignada en ${m}: no se puede dividir así`);
      exportedNeeded.add(r);
      edges.get(m).add(vm);
      if (!needsFrom.get(m).has(vm)) needsFrom.get(m).set(vm, new Set());
      needsFrom.get(m).get(vm).add(r);
    }
  }
  const cyc = findCycles(edges);
  if (cyc.length && !allowCycles) throw new Error("El plan crea ciclos entre módulos:\n  " + cyc.map(c => c.join(" ↔ ")).join("\n  "));

  /* ───────── construcción ───────── */
  const relImport = (fromMod, toMod) => { let r = posix.relative(posix.dirname(fromMod), toMod); if (!r.startsWith(".")) r = "./" + r; return r; };
  const importSpec = (m, name) => {
    const im = A.imports.get(name), sp = im.spec;
    const isRel = im.from.startsWith(".");
    const abs = isRel ? posix.normalize(posix.join(dir, im.from.split("?")[0])) : null;
    const q = im.from.includes("?") ? "?" + im.from.split("?")[1] : "";
    const from = isRel ? relImport(m, abs) + q : im.from;
    if (sp.type === "ImportDefaultSpecifier") return { from, def: name };
    if (sp.type === "ImportNamespaceSpecifier") return { from, ns: name };
    return { from, named: sp.imported.name === name ? name : `${sp.imported.name} as ${name}` };
  };
  const buildImports = (m, onlyNeeds = false) => {
    const byFrom = new Map();
    const entry = from => { if (!byFrom.has(from)) byFrom.set(from, { def: null, ns: null, named: [] }); return byFrom.get(from); };
    if (!onlyNeeds) for (const nm of importUse.get(m)) {
      const s = importSpec(m, nm), e = entry(s.from);
      if (s.def) e.def = s.def; else if (s.ns) e.ns = s.ns; else e.named.push(s.named);
    }
    for (const [origin, names] of needsFrom.get(m)) for (const nm of names) entry(relImport(m, origin)).named.push(nm);
    const lines = [];
    for (const [from, e] of byFrom) {
      const parts = [];
      if (e.def) parts.push(e.def);
      if (e.ns) parts.push(`* as ${e.ns}`);
      if (e.named.length) parts.push(`{ ${[...new Set(e.named)].join(", ")} }`);
      lines.push(`import ${parts.join(", ")} from "${from}";`);
    }
    return lines;
  };
  const moveRel = (text, toMod) => {
    const newDir = posix.dirname(toMod);
    if (dir === newDir) return text;
    return text.replace(/(["'`])(\.{1,2}\/[^"'`\n\r$]*)\1/g, (mm, q, spec) => {
      const clean = spec.split("?")[0], tail = spec.slice(clean.length);
      const abs = posix.normalize(posix.join(dir, clean));
      let rel = posix.relative(newDir, abs); if (clean.endsWith("/")) rel += "/"; if (!rel.startsWith(".")) rel = "./" + rel;
      return q + rel + tail + q;
    });
  };
  const unitText = (u, toMod) => {
    let t = u.text;
    if (!u.exported && u.names.some(n => exportedNeeded.has(n))) t = t.slice(0, u.declOffset) + "export " + t.slice(u.declOffset);
    return moveRel(t, toMod);
  };

  const out = new Map();
  groups.forEach((g, gi) => {
    const m = posix.join(dir, g.file);
    const imp = buildImports(m);
    const body = A.units.filter(u => owner.get(u) === gi).map(u => unitText(u, m)).join(NL + NL);
    const header = g.header ? g.header.trim() + NL + NL : "";
    out.set(m, header + imp.join(NL) + (imp.length ? NL + NL : "") + body + NL);
  });

  /* el original: cabecera + imports que aún usa + importaciones de lo movido + reexportaciones + sentencias restantes */
  const reexports = new Map();
  for (const u of A.units) if (owner.get(u) !== -1 && u.exported) {
    const m = modOf(u);
    if (!reexports.has(m)) reexports.set(m, []);
    reexports.get(m).push(...u.names);
  }
  const reLines = [...reexports].map(([m, names]) => `export { ${names.join(", ")} } from "${relImport(file, m)}";`);
  const header = (A.importNodes[0] ? src.slice(0, A.importNodes[0].start) : A.fileHeader).replace(/\s+$/, "");
  /* Los imports originales se conservan en su orden (los que ya no se usan quedan como «import "ruta";»): así los
     módulos de los que depende se siguen evaluando en el mismo orden que antes, y los de lo movido van después. */
  const imp = [];
  for (const node of A.importNodes) {
    const used = node.specifiers.filter(sp => importUse.get(file).has(sp.local.name));
    const raw = node.source.raw;
    if (!used.length) { imp.push(`import ${raw};`); continue; }
    const parts = [], named = [];
    for (const sp of used) {
      if (sp.type === "ImportDefaultSpecifier") parts.push(sp.local.name);
      else if (sp.type === "ImportNamespaceSpecifier") parts.push(`* as ${sp.local.name}`);
      else named.push(sp.imported.name === sp.local.name ? sp.local.name : `${sp.imported.name} as ${sp.local.name}`);
    }
    if (named.length) parts.push(`{ ${named.join(", ")} }`);
    imp.push(`import ${parts.join(", ")} from ${raw};`);
  }
  if (!importAllGroups) imp.push(...buildImports(file, true));
  else {
    const needed = needsFrom.get(file);
    for (const g of groups) {
      const m = posix.join(dir, g.file);
      const names = needed.get(m);
      if (names && names.size) imp.push(`import { ${[...names].join(", ")} } from "${relImport(file, m)}";`);
      else imp.push(`import "${relImport(file, m)}";`);
    }
  }
  const body = A.units.filter(u => owner.get(u) === -1).map(u => u.text).join(NL + NL);
  out.set(file, (header ? header + NL + NL : "") + imp.join(NL) + (imp.length ? NL : "") + (reLines.length ? reLines.join(NL) + NL : "") + NL + body + NL);

  const report = { cycles: cyc, files: [...out].map(([f, t]) => ({ file: f, lines: t.split(NL).length })), exportedNeeded: [...exportedNeeded] };
  if (dry) return { ...report, out };
  for (const [f, t] of out) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  return report;
}

function findCycles(edges) {
  let idx = 0; const st = [], on = new Set(), I = new Map(), L = new Map(), out = [];
  const sc = v => {
    I.set(v, idx); L.set(v, idx); idx++; st.push(v); on.add(v);
    for (const w of edges.get(v) || []) {
      if (!edges.has(w)) continue;
      if (!I.has(w)) { sc(w); L.set(v, Math.min(L.get(v), L.get(w))); } else if (on.has(w)) L.set(v, Math.min(L.get(v), I.get(w)));
    }
    if (L.get(v) === I.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) out.push(c.sort()); }
  };
  for (const v of edges.keys()) if (!I.has(v)) sc(v);
  return out;
}
