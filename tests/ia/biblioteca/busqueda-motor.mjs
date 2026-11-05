/* ═════════════════════════════════════════════════
   PRUEBA · buscar fotos (motor, Node). Uso: node tests/ia/biblioteca/busqueda-motor.mjs
   ═════════════════════════════════════════════════ */
import { buscar, interpretar } from "../../../js/features/library/search-photos/engine/consulta.js";
import { coloresDominantes, nombreDeColor } from "../../../js/features/library/search-photos/engine/color.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const R = [
  { catEtiqueta: "Perro", grupo: "Animales", top: [{ label: "golden retriever", p: 0.7 }, { label: "dog", p: 0.1 }], colores: [["marron", 0.4], ["verde", 0.3]], brillo: 0.5, bn: false, piel: 0 },
  { catEtiqueta: "Playa", grupo: "Naturaleza & Paisajes", top: [{ label: "seashore", p: 0.6 }], colores: [["azul", 0.5], ["amarillo", 0.3]], brillo: 0.7, bn: false, piel: 0 },
  { catEtiqueta: "Retrato", grupo: "Retratos", top: [{ label: "sweatshirt", p: 0.2 }], colores: [["gris", 0.6]], brillo: 0.4, bn: true, piel: 0.4 },
  { catEtiqueta: "Noche urbana", grupo: "Fotografía Especial", top: [{ label: "street sign", p: 0.3 }], colores: [["negro", 0.8]], brillo: 0.1, bn: false, piel: 0 }
];
const top = t => buscar(R, t)[0]?.i;
ok(top("perro") === 0, "perro"); ok(top("una playa azul") === 1, "playa azul"); ok(top("retrato en blanco y negro") === 2, "retrato byn");
ok(top("foto de noche") === 3, "noche"); ok(top("playa") === 1, "playa"); ok(buscar(R, "").length === 0, "vacía");
ok(buscar(R, "perro azul")[0]?.i === 0 || buscar(R, "perro azul")[0]?.i === 1, "sin todos cae a alguno");
ok(interpretar("el perro de la playa").length === 2, "palabras vacías fuera");
ok(nombreDeColor(255, 0, 0) === "rojo" && nombreDeColor(0, 0, 255) === "azul" && nombreDeColor(10, 10, 10) === "negro" && nombreDeColor(250, 250, 250) === "blanco" && nombreDeColor(0, 200, 0) === "verde", "nombres de color");
const px = new Uint8ClampedArray(400); for (let i = 0; i < 100; i++) { px[i * 4] = 255; px[i * 4 + 3] = 255; }
ok(coloresDominantes(px, 10, 10).colores[0][0] === "rojo", "dominante rojo");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · motor de búsqueda"); process.exit(fallos ? 1 : 0);
