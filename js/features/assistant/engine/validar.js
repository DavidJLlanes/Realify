/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · VALIDACIÓN DEL PLAN (motor puro, sin DOM)
   Un plan es { pasos: [{ herramienta, valores }] }. Se acepta sólo lo que está en el esquema: herramienta conocida, mandos conocidos, números dentro
   de rango (los que se pasan se recortan y se avisa), opciones válidas. Máximo 8 pasos. Lo demás se rechaza con el motivo.
   Entradas: plan (venga de donde venga) y esquema. Salida: { pasos, rechazados:[{ texto, motivo }], ajustes:[texto] }.
   ═══════════════════════════════════════════════════════════════ */
export const MAX_PASOS = 8;

export function validarPlan(plan, esquema){
  const pasos = [], rechazados = [], ajustes = [], lista = Array.isArray(plan?.pasos) ? plan.pasos : [];
  if(!Array.isArray(plan?.pasos)) rechazados.push({ texto: "plan", motivo: "no es un plan con pasos" });
  for(const p of lista.slice(0, MAX_PASOS)){
    const t = esquema.get(String(p?.herramienta));
    if(!t){ rechazados.push({ texto: String(p?.herramienta ?? "?"), motivo: "esa herramienta no existe" }); continue; }
    const valores = {}, vin = p.valores && typeof p.valores === "object" && !Array.isArray(p.valores) ? p.valores : {};
    let malo = null;
    for(const [k, v] of Object.entries(vin)){
      const m = t.params.find(x => x.key === k);
      if(!m){ ajustes.push(`${t.label}: «${k}» no existe y se ignora`); continue; }
      if(m.type === "range"){
        const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? +v : NaN;
        if(!Number.isFinite(n)){ malo = `«${m.label}» no es un número`; break; }
        const c = Math.min(m.max, Math.max(m.min, n)); if(c !== n) ajustes.push(`${t.label}: «${m.label}» ${n} se recorta a ${c}`); valores[k] = c;
      } else if(m.type === "toggle"){ valores[k] = !!v; }
      else if(m.options){ if(!m.options.some(o => String(o[0]) === String(v))){ malo = `«${m.label}» no admite «${v}»`; break; } valores[k] = m.options.find(o => String(o[0]) === String(v))[0]; }
      else valores[k] = v;
    }
    if(malo){ rechazados.push({ texto: t.label, motivo: malo }); continue; }
    pasos.push({ herramienta: t.id, valores });
  }
  if(lista.length > MAX_PASOS) rechazados.push({ texto: "plan", motivo: `demasiados pasos: sólo caben ${MAX_PASOS}` });
  return { pasos, rechazados, ajustes };
}

/** Frase corta de un paso para enseñarla al confirmar: «Calidez y tinte: Temperatura +30». */
export function describirPaso(paso, esquema){
  const t = esquema.get(paso.herramienta); if(!t) return paso.herramienta;
  const v = Object.entries(paso.valores || {}).map(([k, x]) => { const m = t.params.find(p => p.key === k); return `${m?.label || k} ${typeof x === "number" && x > 0 && m?.min < 0 ? "+" : ""}${x}`; });
  return v.length ? `${t.label}: ${v.join(", ")}` : t.label;
}
