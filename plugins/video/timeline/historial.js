/* ═══════════════════════════════════════════════════════════════
   EDITOR DE VÍDEO · DESHACER Y REHACER (puro, sin DOM)
   Guarda las versiones del proyecto como instantáneas: como las operaciones (timeline/ops.js) comparten lo que no cambia, cada paso cuesta poco memoria.
   Entradas: proyecto inicial y límite de pasos (100). Salida: objeto con actual(), hacer(fn, etiqueta), deshacer(), rehacer(), etiquetas y estado.
   Si `fn` lanza un error, el historial no cambia y el error sube a quien llamó.
   ═══════════════════════════════════════════════════════════════ */
export function crearHistorial(inicial, limite = 100){
  let pasado = [], futuro = [], actual = inicial;
  return {
    actual: () => actual,
    hacer(fn, etiqueta = ""){ const nuevo = fn(actual); if(nuevo === actual) return actual; pasado.push({ p: actual, etiqueta }); if(pasado.length > limite) pasado.shift(); futuro = []; actual = nuevo; return actual; },
    deshacer(){ const e = pasado.pop(); if(!e) return actual; futuro.push({ p: actual, etiqueta: e.etiqueta }); actual = e.p; return actual; },
    rehacer(){ const e = futuro.pop(); if(!e) return actual; pasado.push({ p: actual, etiqueta: e.etiqueta }); actual = e.p; return actual; },
    puedeDeshacer: () => pasado.length > 0, puedeRehacer: () => futuro.length > 0,
    etiquetaDeshacer: () => pasado.length ? pasado[pasado.length - 1].etiqueta : "", etiquetaRehacer: () => futuro.length ? futuro[futuro.length - 1].etiqueta : "",
    pasos: () => pasado.length
  };
}
