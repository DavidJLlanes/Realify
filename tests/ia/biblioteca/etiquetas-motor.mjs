/* ═════════════════════════════════════════════════
   PRUEBA · etiquetas y plantillas de nombre (motor, Node). Uso: node tests/ia/biblioteca/etiquetas-motor.mjs
   ═════════════════════════════════════════════════ */
import { etiquetasDe } from "../../../js/features/library/auto-tags/engine/etiquetas.js";
import { aplicarPlantilla, seguro } from "../../../js/features/library/auto-tags/engine/plantilla.js";
import { toSpanish } from "../../../js/ai/es2en.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
ok(toSpanish("dog") === "perro" && toSpanish("cats") === "gato" && toSpanish("zzzz") === null, "toSpanish");
const r = { catEtiqueta: "Perro", grupo: "Animales", top: [{ label: "golden retriever", p: 0.6 }, { label: "dog", p: 0.2 }, { label: "cup", p: 0.01 }], colores: [["marron", 0.4], ["verde", 0.3], ["negro", 0.2]], brillo: 0.5, bn: false, piel: 0 };
const e = etiquetasDe(r); console.log(e.join(", "));
ok(e[0] === "perro" && e.includes("animales") && e.includes("marron") && e.includes("verde") && !e.includes("negro") && !e.includes("taza"), "etiquetas");
ok(etiquetasDe({ ...r, bn: true, brillo: 0.1 }).includes("blanco y negro") && etiquetasDe({ ...r, bn: true, brillo: 0.1 }).includes("noche"), "marcas");
const d = { fecha: new Date(2026, 10, 5, 9, 7), etiquetas: ["perro", "animales", "verde"], categoria: "Perro", color: "marrón", nombre: "IMG_0042", n: 3, ancho: 4000, alto: 3000 };
ok(aplicarPlantilla("{fecha}_{etiqueta}_{n}", d) === "2026-11-05_perro_003", "plantilla básica: " + aplicarPlantilla("{fecha}_{etiqueta}_{n}", d));
ok(aplicarPlantilla("{año}{mes}{dia}-{hora}-{etiquetas}", d) === "20261105-0907-perro-animales-verde", "plantilla larga");
ok(aplicarPlantilla("{nombre}_{ancho}x{alto}", d) === "img_0042_4000x3000", "nombre");
ok(aplicarPlantilla("{color}_{etiqueta9}__{n}", d) === "marron_001".replace("001", "003") || aplicarPlantilla("{color}_{etiqueta9}__{n}", d) === "marron_003", "ficha desconocida se limpia: " + aplicarPlantilla("{color}_{etiqueta9}__{n}", d));
ok(aplicarPlantilla("", {}) !== "" && seguro("Mañana/Ñu:*?") === "manana-nu", "vacío y caracteres: " + seguro("Mañana/Ñu:*?"));
console.log(fallos ? `FALLOS: ${fallos}` : "OK · etiquetas y plantillas"); process.exit(fallos ? 1 : 0);
