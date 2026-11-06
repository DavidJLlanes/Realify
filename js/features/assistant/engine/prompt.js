/* ═══════════════════════════════════════════════════════════════
   ASISTENTE · AVISO AL MODELO DE LENGUAJE Y LECTURA DEL PLAN (motor puro, sin DOM)
   Convierte el esquema de herramientas (esquema.js) en un aviso corto para Qwen —id, nombre y mandos con su rango— y pide SOLO un JSON
   {"pasos":[{"herramienta":"id","valores":{"mando":número}}]}. Lo que el modelo conteste se busca como JSON y se pasa por validarPlan(): nada
   se ejecuta sin esa validación. Entradas: esquema (Map) y pedido. Salidas: construirMensajes() → [{ role, content }], leerPlan(texto) → plan | null.
   Límites: el modelo es pequeño: se le dan ejemplos y se descartan las herramientas con opciones de texto para acortar el aviso.
   ═══════════════════════════════════════════════════════════════ */
const rango = p => p.type === "range" ? `${p.key} ${p.min}..${p.max}${p.def ? ` (def ${p.def})` : ""}` : p.type === "toggle" ? `${p.key} true|false` : `${p.key} ${(p.options || []).map(o => o[0]).join("|")}`;

export function listaHerramientas(esquema){
  return [...esquema.values()].map(t => `- ${t.id}: ${t.label}${t.params.length ? " [" + t.params.map(rango).join("; ") + "]" : ""}`).join("\n");
}

export function construirMensajes(esquema, pedido){
  const sistema = `Eres el asistente de un editor de fotos. El usuario pide cambios en español. Responde SOLO con un JSON, sin texto antes ni después, con este formato:
{"pasos":[{"herramienta":"<id>","valores":{"<mando>":<número>}}]}
Usa SOLO estas herramientas y sus mandos (rangos tras los dos puntos). Si una herramienta no tiene mandos, "valores" va vacío. Máximo 6 pasos. Si no se puede hacer con ellas, responde {"pasos":[]}.
Herramientas:
${listaHerramientas(esquema)}
Ejemplos:
Usuario: más cálida y con contraste
{"pasos":[{"herramienta":"wb","valores":{"temp":30}},{"herramienta":"bc","valores":{"contrast":25}}]}
Usuario: en blanco y negro con grano
{"pasos":[{"herramienta":"gray","valores":{}},{"herramienta":"grano","valores":{"fuerza":50,"tam":30}}]}`;
  return [{ role: "system", content: sistema }, { role: "user", content: String(pedido || "").slice(0, 300) }];
}

/** Busca el primer objeto JSON equilibrado en el texto y lo lee; null si no hay o no tiene «pasos». */
export function leerPlan(texto){
  const t = String(texto || ""), ini = t.indexOf("{"); if(ini < 0) return null;
  let prof = 0, enCad = false, esc = false;
  for(let i = ini; i < t.length; i++){
    const c = t[i];
    if(enCad){ if(esc) esc = false; else if(c === "\\") esc = true; else if(c === '"') enCad = false; continue; }
    if(c === '"') enCad = true; else if(c === "{") prof++; else if(c === "}" && --prof === 0){
      try{ const o = JSON.parse(t.slice(ini, i + 1)); return Array.isArray(o?.pasos) ? o : null; }catch{ return null; }
    }
  }
  return null;
}
