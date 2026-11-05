/* ═══════════════════════════════════════════════════════════════
   CUERPO · SECCIONES (puro, sin DOM)
   Una «sección» es el corte de una parte del cuerpo perpendicular a su eje: desde un punto del eje se avanza hacia los dos lados hasta
   salir de la máscara de la persona (o hasta un límite). Los mandos de grosor mueven esos dos bordes hacia el eje o lejos de él.
   Entradas: máscara 0-1 (Float32Array w×h), punto del eje, normal unitaria, límite en píxeles y, opcional, `evitar` (función que
   dice si un punto ya es de otra parte, p. ej. un brazo). Salida: { c, e1, e2, mitad } o null si el punto no está dentro de la máscara.
   ═══════════════════════════════════════════════════════════════ */
function dentro(m, w, h, x, y){
  const i = Math.round(x), j = Math.round(y);
  return i >= 0 && j >= 0 && i < w && j < h && m[j * w + i] > 0.5;
}

export function seccion(m, w, h, c, n, limite, evitar = null){
  if(!dentro(m, w, h, c[0], c[1])) return null;
  const lado = s => {
    let k = 0;
    while(k < limite){
      const x = c[0] + n[0] * s * (k + 1), y = c[1] + n[1] * s * (k + 1);
      if(!dentro(m, w, h, x, y) || (evitar && evitar(x, y))) break;
      k++;
    }
    return [c[0] + n[0] * s * k, c[1] + n[1] * s * k, k];
  };
  const a = lado(-1), b = lado(1);
  if(a[2] < 2 || b[2] < 2) return null;
  return { c, e1: [a[0], a[1]], e2: [b[0], b[1]], mitad: (a[2] + b[2]) / 2 };
}

/* Manos (puntos movidos) para cambiar el grosor de una sección en un porcentaje `pct` (0,1 = 10 % más ancho).
   La sección se centra antes: así no se desplaza todo el miembro, sólo se ensancha o se estrecha. */
export function manosGrosor(s, pct){
  const m = [[s.e1, s.c], [s.e2, s.c]], out = [];
  for(const [e, c] of m) out.push({ x: e[0], y: e[1], tx: c[0] + (e[0] - c[0]) * (1 + pct), ty: c[1] + (e[1] - c[1]) * (1 + pct) });
  out.push({ x: s.c[0], y: s.c[1], tx: s.c[0], ty: s.c[1] });
  return out;
}
