/* ═════════════════════════════════════════════════
   PRUEBA · texto alternativo (motor, Node). Uso: node tests/ia/biblioteca/alt-motor.mjs
   ═════════════════════════════════════════════════ */
import { textoAlternativo } from "../../../js/features/library/alt-text/engine/descripcion.js";
let fallos = 0; const ok = (c, m) => { if (!c) { fallos++; console.log("FALLO:", m); } };
const r = { catEtiqueta: "Perro", grupo: "Animales", top: [{ label: "golden retriever", p: 0.6 }, { label: "cup", p: 0.2 }], colores: [["marron", 0.4], ["verde", 0.3]], brillo: 0.5, bn: false, piel: 0 };
const c = textoAlternativo(r), l = textoAlternativo(r, { largo: true });
console.log(c, "\n" + l);
ok(/^Fotografía de perro/.test(c) && c.length <= 125 && c.endsWith("."), "corto"); ok(/marrones/.test(l) && /luz es equilibrada/.test(l), "largo");
ok(/blanco y negro/.test(textoAlternativo({ ...r, bn: true })) && !/marrones/.test(textoAlternativo({ ...r, bn: true })), "byn");
ok(/sin un sujeto claro/.test(textoAlternativo({ catEtiqueta: "", grupo: "", top: [], colores: [], brillo: 0.5, bn: false, piel: 0 })), "sin sujeto");
ok(/personas/.test(textoAlternativo({ ...r, piel: 0.4 }, { largo: true })) && /oscura/.test(textoAlternativo({ ...r, brillo: 0.1 }, { largo: true })), "personas y noche");
console.log(fallos ? `FALLOS: ${fallos}` : "OK · texto alternativo"); process.exit(fallos ? 1 : 0);
