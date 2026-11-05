/* ═══════════════════════════════════════════════════════════════
   TEXTO ALTERNATIVO · DESCRIPCIÓN (motor puro, sin DOM)
   Compone una frase en español para lectores de pantalla con plantillas, a partir del registro de la IA (tipo de foto, objetos, colores, luz).
   Corto: ≤ 125 caracteres (lo que cabe en un alt). Largo: añade colores, luz y personas. No inventa nada que la IA no haya visto.
   Entradas: registro { catEtiqueta, grupo, top, colores, brillo, bn, piel } y { largo }. Salida: texto.
   Límites: describe tipo, objetos, color y luz; no acciones, relaciones ni texto dentro de la imagen.
   ═══════════════════════════════════════════════════════════════ */
import { etiquetasDe } from "../../auto-tags/engine/etiquetas.js";

const GENERO = { rojo: "rojos", naranja: "naranjas", amarillo: "amarillos", verde: "verdes", turquesa: "turquesas", azul: "azules", morado: "morados", rosa: "rosas", marron: "marrones", gris: "grises" };
const lista = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
const minusIni = s => s.charAt(0).toUpperCase() + s.slice(1);

export function textoAlternativo(r, { largo = false } = {}){
  const tags = etiquetasDe(r, { max: 10, minP: 0.25 }), tipo = (r.catEtiqueta && !/detecci/i.test(r.catEtiqueta)) ? r.catEtiqueta.toLowerCase() : "", resto = tags.filter(t => t !== tipo && !/^(noche|luminosa|personas|blanco y negro)$/.test(t) && !GENERO[t] && t !== (r.grupo || "").toLowerCase().replace(/\s*&.*/, ""));
  const objetos = resto.slice(0, largo ? 3 : 2), cols = r.bn ? [] : (r.colores || []).filter(([c, f]) => f >= 0.15 && GENERO[c]).slice(0, largo ? 3 : 2).map(([c]) => GENERO[c]);
  let t = r.bn ? "Fotografía en blanco y negro" : "Fotografía";
  if(tipo) t += ` de ${tipo}`;
  if(objetos.length) t += (tipo ? " con " : " de ") + lista(objetos);
  if(!tipo && !objetos.length) t += " sin un sujeto claro";
  if(!largo){ if(cols.length) t += `, tonos ${lista(cols.slice(0, 2))}`; return minusIni(t.length > 124 ? t.slice(0, 121).replace(/[ ,]+\S*$/, "") + "…" : t) + (t.length > 124 ? "" : "."); }
  const extra = [];
  if(cols.length) extra.push(`Predominan los tonos ${lista(cols)}.`);
  extra.push(r.brillo < 0.2 ? "Es una escena muy oscura, de noche o con poca luz." : r.brillo > 0.65 ? "Es una imagen luminosa y clara." : "La luz es equilibrada.");
  if(r.piel > 0.2) extra.push("Es probable que aparezcan personas.");
  return minusIni(t) + ". " + extra.join(" ");
}
