/* PLAN AUTOMÁTICO DE DIVISIÓN POR BLOQUES.
   Agrupa las sentencias de primer nivel de un módulo en bloques que no se usan entre sí (componentes conexos del
   grafo de referencias, sin contar las piezas muy compartidas) y propone un módulo por cada bloque grande:
     · las piezas compartidas por varios bloques van a «<nombre>/shared.js»;
     · lo que solo usa un bloque va con él; lo que no usa nadie (o solo el propio archivo) se queda en el original;
     · una variable de módulo (`let`) y todo lo que la asigna se quedan juntos.
   El resultado se pasa a splitFile (splitter.mjs), que lo valida (ciclos, asignaciones entre módulos) antes de escribir. */
import path from "node:path";
import { analyze } from "./splitter.mjs";

const posix = path.posix;
const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[_\s]+/g, "-").toLowerCase();

export function autoPlan(src, { file, minLines = 120, hub = 3, rename = {} }) {
  const A = analyze(src);
  const U = A.units;
  const idx = new Map(U.map((u, i) => [u, i]));
  const out = U.map(u => new Set([...u.refs].map(r => A.declared.get(r)).filter(v => v && v !== u).map(v => idx.get(v))));
  const referrers = U.map(() => new Set());
  out.forEach((s, i) => s.forEach(j => referrers[j].add(i)));
  const isHub = referrers.map(s => s.size >= hub);

  /* bloques: componentes conexos sin las piezas compartidas */
  const par = U.map((_, i) => i); const find = x => par[x] === x ? x : (par[x] = find(par[x]));
  out.forEach((s, i) => s.forEach(j => { if (!isHub[i] && !isHub[j]) par[find(i)] = find(j); }));
  const comps = new Map();
  U.forEach((u, i) => { if (isHub[i]) return; const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); });
  const big = [...comps.values()].map(ix => ({ ix, lines: ix.reduce((a, i) => a + U[i].lines, 0) })).filter(c => c.lines >= minLines).sort((a, b) => a.ix[0] - b.ix[0]);

  const label = new Map();                // índice de unidad → etiqueta
  const names = new Map();                // etiqueta → nombre de archivo
  const used = new Set();
  big.forEach((c, n) => {
    const id = "c" + n;
    const exported = c.ix.filter(i => U[i].exported && U[i].names.length).sort((a, b) => U[b].lines - U[a].lines);
    const named = c.ix.filter(i => U[i].names.length).sort((a, b) => U[b].lines - U[a].lines);
    const wanted = c.ix.flatMap(i => U[i].names).find(nm => rename[nm]);
    let base = wanted ? rename[wanted] : kebab((exported[0] || named[0] ? U[(exported[0] ?? named[0])].names[0] : "parte-" + (n + 1)));
    while (used.has(base)) base += "-" + (n + 1);
    used.add(base); names.set(id, base);
    c.ix.forEach(i => label.set(i, id));
  });
  const isCluster = l => typeof l === "string" && names.has(l);
  const fixed = new Set(big.flatMap(c => c.ix));        // miembros de un bloque: su sitio no cambia

  /* resto de piezas: según quién las usa */
  const decide = S => {
    const set = new Set(S);
    if (set.size === 1) return [...set][0];
    const cl = [...set].filter(isCluster);
    if (set.has("shared") || cl.length >= 2) return "shared";
    return cl[0] || "residual";           // {bloque, residual} → el bloque (el original lo importa)
  };
  for (let round = 0; round < 60; round++) {
    let changed = false;
    for (let i = 0; i < U.length; i++) {
      if (fixed.has(i)) continue;
      const refs = [...referrers[i]].map(r => label.get(r) ?? null);
      if (refs.some(x => x === null)) continue;
      const h = refs.length ? decide(refs) : "residual";
      if (label.get(i) !== h) { label.set(i, h); changed = true; }
    }
    /* variables `let` y quienes las asignan: al mismo sitio */
    for (let i = 0; i < U.length; i++) {
      if (!U[i].isLet) continue;
      const as = U.map((x, j) => j).filter(j => j !== i && U[i].names.some(n => U[j].assigns.has(n)));
      const hs = new Set([label.get(i) ?? "residual", ...as.map(j => label.get(j) ?? "residual")]);
      const cl = [...hs].filter(isCluster);
      if (hs.size > 1 && cl.length === 1) { for (const j of [i, ...as]) if ((label.get(j) ?? "residual") !== cl[0]) { label.set(j, cl[0]); changed = true; } }
      else if (cl.length > 1) throw new Error(`«${U[i].names[0]}» se asigna desde bloques distintos: ${cl.map(c => names.get(c)).join(", ")}`);
    }
    if (!changed) break;
  }
  for (let i = 0; i < U.length; i++) if (!label.has(i)) label.set(i, "residual");

  const dir = posix.dirname(file), base = posix.basename(file, ".js");
  const groups = [];
  const header = t => `/* ═══════════════════════════════════════════════════════════════\n   ${t}\n   Parte de ${file}, que conserva la API y reexporta lo de aquí.\n   ═══════════════════════════════════════════════════════════════ */`;
  const members = lab => U.map((u, i) => [u, i]).filter(([, i]) => label.get(i) === lab).map(([u]) => u);
  const mk = (lab, fname, title) => {
    const us = members(lab);
    if (!us.length) return;
    const lines = new Set(us.filter(u => u.names.length === 0).map(u => u.line));
    groups.push({ file: `${base}/${fname}.js`, names: us.flatMap(u => u.names), select: u => u.names.length === 0 && lines.has(u.line), header: header(title), lines: us.reduce((a, u) => a + u.lines, 0), title });
  };
  for (const [lab, fname] of names) mk(lab, fname, `${base} · ${fname.replace(/-/g, " ")}`);
  mk("shared", "common", `${base} · piezas que usan varios bloques`);
  const residual = members("residual");
  return { groups, residualLines: residual.reduce((a, u) => a + u.lines, 0), total: U.reduce((a, u) => a + u.lines, 0), clusters: big.length };
}
