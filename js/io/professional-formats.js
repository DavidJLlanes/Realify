/* Intercambio con editores externos. TIFF guarda el compuesto sin pérdidas;
   PSD conserva grupos y capas rasterizadas. El proyecto .realify sigue siendo
   la copia que conserva los mandos nativos de texto, filtros y ajustes. */
import { doc } from "../core/doc.js";
import { buildLayerTree, flatten } from "../editor/layertree.js";

export function tiffFromCanvas(canvas){
  const U = globalThis.UTIF;
  if(!U?.encodeImage) throw new Error("El codificador TIFF no está disponible");
  // TIFF de 8 bits sin perfil: siempre en sRGB (en documentos P3 el navegador convierte)
  const rgba = canvas.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, canvas.width, canvas.height, { colorSpace:"srgb" }).data;
  return new Blob([U.encodeImage(rgba, canvas.width, canvas.height)], { type:"image/tiff" });
}

const blendModes = {
  "source-over":"normal", multiply:"multiply", screen:"screen", overlay:"overlay",
  darken:"darken", lighten:"lighten", difference:"difference", exclusion:"exclusion",
  "color-burn":"color burn", "color-dodge":"color dodge",
  "hard-light":"hard light", "soft-light":"soft light"
};

export function layeredPsd(scale = 1){
  const A = globalThis.agPsd;
  if(!A?.writePsdUint8Array) throw new Error("El codificador PSD no está disponible");
  const width = doc.w * scale, height = doc.h * scale;
  if(width > 30000 || height > 30000) throw new Error("PSD admite como máximo 30 000 píxeles por lado");
  const resize = canvas => {
    if(scale === 1) return canvas;
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const x = c.getContext("2d", { colorSpace:"srgb" }); x.imageSmoothingQuality = "high";
    x.drawImage(canvas, 0, 0, width, height); return c;
  };
  const nodes = nodes => nodes.slice().reverse().flatMap(({ layer:l, children }) => {
    // Los ajustes dependen de las capas inferiores y no tienen píxeles
    // autónomos: sólo el compuesto PSD y el proyecto nativo los reproducen.
    if(l.type === "adjust") return [];
    const common = { name:l.name || "Capa", hidden:!l.visible,
      opacity:l.opacity ?? 1, blendMode:blendModes[l.blend] || "normal" };
    if(children) return [{ ...common, children:nodes(children) }];
    // Los efectos, máscaras y formas se resuelven con el compositor de
    // Realify en cada capa; PSD puede editar sus píxeles y su opacidad.
    const raster = flatten(null, [{ ...l, groupId:null, visible:true,
      opacity:1, blend:"source-over", clipped:false }], doc.w, doc.h);
    return [{ ...common, clipping:!!l.clipped, imageData:resize(raster)
      .getContext("2d", { willReadFrequently:true }).getImageData(0, 0, width, height, { colorSpace:"srgb" }) }];
  });
  const composite = resize(flatten());
  const psd = { width, height, imageData:composite.getContext("2d", { willReadFrequently:true }).getImageData(0, 0, width, height, { colorSpace:"srgb" }),
    children:nodes(buildLayerTree(doc.layers)) };
  // Una copia oculta facilita comparar la apariencia final si un ajuste,
  // máscara de grupo o modo propio de Realify no se traduce a PSD.
  if(doc.layers.some(l => l.type === "adjust" || l.type === "group" && l.mask ||
      l.blendIf || l.styles || l.filters?.length || !blendModes[l.blend]))
    psd.children.unshift({ name:"Vista final · referencia", hidden:true, imageData:psd.imageData });
  return new Blob([A.writePsdUint8Array(psd, { noBackground:true, trimImageData:true })],
    { type:"image/vnd.adobe.photoshop" });
}
