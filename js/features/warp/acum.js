/* ═══════════════════════════════════════════════════════════════
   DEFORMACIÓN · ACUMULADOR DE DESPLAZAMIENTOS (puro, sin DOM)
   Varios mandos mueven el mismo punto (la cabeza la tocan la altura, el cuello y la postura). Si cada uno creara su propia «mano»
   del campo en el mismo sitio, se pisarían; aquí se suman por nombre y al final sale una sola mano por punto.
   Entradas: nombre, punto y desplazamiento. Salida: lista de manos { x, y, tx, ty }.
   ═══════════════════════════════════════════════════════════════ */
export class Acum {
  constructor(){ this.m = new Map(); }
  add(clave, p, dx, dy){
    const a = this.m.get(clave) || { x: p[0], y: p[1], tx: p[0], ty: p[1] };
    a.tx += dx; a.ty += dy; this.m.set(clave, a);
  }
  /* Mueve un punto con un vector [dx, dy]. */
  mover(clave, p, v){ if(p) this.add(clave, p, v[0], v[1]); }
  /* Anillo de `n` puntos alrededor de `c` (radio r) más el centro: escala (pct) y/o traslada (v) la zona entera. */
  anillo(clave, c, r, pct, v = [0, 0], n = 8){
    this.add(clave + ".c", c, v[0], v[1]);
    for(let k = 0; k < n; k++){
      const a = k * 2 * Math.PI / n, p = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
      this.add(clave + "." + k, p, v[0] + Math.cos(a) * r * pct, v[1] + Math.sin(a) * r * pct);
    }
  }
  /* Sólo las manos que se mueven: una mano fija pegada a otra que se mueve (un anillo de la mano junto a la cadera) pliega el campo. */
  lista(){ return [...this.m.values()].filter(a => Math.hypot(a.tx - a.x, a.ty - a.y) > 1e-6); }
}
