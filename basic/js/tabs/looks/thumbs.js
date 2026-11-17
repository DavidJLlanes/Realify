/* ═══════════════════════════════════════════════════════════════
   REALIFY BASIC · MINIATURAS DE ESTILOS
   La propia foto del usuario, recortada en cuadrado y reducida, con cada estilo aplicado. Se calculan bajo demanda y se guardan.
   Entradas: crearMiniaturas(lienzo, lado, catalogo = { LOOKS, applyLook }). Salidas: { canvas(i) } → lienzo cuadrado del estilo i (−1 = original).
   Límites: sin interfaz; cada miniatura cuesta unos milisegundos, por eso quien la pide las reparte por fotogramas.
   ═══════════════════════════════════════════════════════════════ */
export function crearMiniaturas(fuente, S, { LOOKS, applyLook }) {
  const base = Object.assign(document.createElement("canvas"), { width: S, height: S }), lado = Math.min(fuente.width, fuente.height);
  const bx = base.getContext("2d", { willReadFrequently: true });
  bx.imageSmoothingQuality = "high";
  bx.drawImage(fuente, (fuente.width - lado) / 2, (fuente.height - lado) / 2, lado, lado, 0, 0, S, S);
  const datos = bx.getImageData(0, 0, S, S), cache = new Map();
  return {
    canvas(i) {
      if (i < 0) return base;
      if (cache.has(i)) return cache.get(i);
      const img = new ImageData(new Uint8ClampedArray(datos.data), S, S);
      applyLook(img.data, LOOKS[i]);
      const c = Object.assign(document.createElement("canvas"), { width: S, height: S });
      c.getContext("2d").putImageData(img, 0, 0); cache.set(i, c); return c;
    },
  };
}
