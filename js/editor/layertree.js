/* ═══════════════════════════════════════════════════════════════
   ÁRBOL DE CAPAS
   `doc.layers` sigue siendo un array PLANO —de abajo a arriba, como
   siempre—: convertirlo en un árbol de verdad habría tocado decenas
   de sitios que ya asumen ese array (paneles, alinear, exportar,
   historial…). Un grupo es sólo otra entrada del array (type:"group",
   sin contenido propio, igual que una capa de ajuste) y sus miembros
   guardan el id de su grupo en `groupId`. Este módulo es el único
   sitio que reconstruye la jerarquía a partir de ese campo, una vez
   por composición, y sabe recorrerla recursivamente: un grupo se
   compone aparte en un lienzo propio y ESE resultado es lo que se
   dibuja donde le toque, con la opacidad, el modo de fusión y la
   máscara del propio grupo — un grupo se comporta como una capa más
   de cara a quien esté por encima o por debajo suyo.
   ═══════════════════════════════════════════════════════════════ */

import { doc } from "../core/doc.js";
import { isAdjustLayer, applyAdjustLayer } from "./adjustlayers.js";
import { hasEnabledStyle, renderLayerStyles, styleBehind, styleRing } from "./layerstyles.js";
import { drawWithBlend, CUSTOM_BLENDS } from "./blend.js";
import { isBlendIfActive, buildBlendIfAlphaCanvas } from "./blendif.js";

/* Reconstruye la jerarquía: una lista de nodos { layer, children } en
   el nivel superior (groupId nulo), con `children` sólo presente para
   los grupos. El orden de abajo a arriba de `layers` se conserva tal
   cual dentro de cada nivel, así que no hace falta que los miembros
   de un grupo sean contiguos en el array para que esto funcione —lo
   son por convención (agrupar y desagrupar la mantienen), pero el
   árbol no depende de ello—. */
export function buildLayerTree(layers = doc.layers){
  const groupIds = new Set(layers.filter(l => l.type === "group").map(l => l.id));
  const childrenOf = new Map();
  for(const l of layers){
    // Un `groupId` que ya no señala a ningún grupo real (huérfano por
    // alguna vía que no haya pasado por editor/groups.js) se trata
    // como nivel superior en vez de dejar la capa fuera del árbol y,
    // con ello, invisible sin ningún aviso.
    if(l.groupId != null && groupIds.has(l.groupId)){
      if(!childrenOf.has(l.groupId)) childrenOf.set(l.groupId, []);
      childrenOf.get(l.groupId).push(l);
    }
  }
  const wrap = l => l.type === "group"
    ? { layer: l, children: (childrenOf.get(l.id) || []).map(wrap) }
    : { layer: l, children: null };
  return layers.filter(l => l.groupId == null || !groupIds.has(l.groupId)).map(wrap);
}

function getEffectiveMask(layer){
  if(!layer) return null;
  if(layer.maskRef){
    const refLayer = doc.layers.find(l => l.id === layer.maskRef);
    return refLayer ? refLayer.mask : null;
  }
  return layer.mask;
}

function readAlpha(canvas, w, h){
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for(let i = 0, p = 3; i < out.length; i++, p += 4) out[i] = d[p];
  return out;
}

/* La mezcla final de una capa de ajuste: cuánto de `computed` (el
   resultado con el efecto puesto) se queda frente a `orig` (lo que
   había antes) en cada píxel, según la opacidad de la capa y, si
   tiene, su máscara. */
export function blendAdjustResult(computed, orig, opacity, maskAlpha){
  for(let i = 0; i < computed.length; i += 4){
    const f = maskAlpha ? opacity * maskAlpha[i >> 2] / 255 : opacity;
    if(f >= 1) continue;
    if(f <= 0){
      computed[i] = orig[i]; computed[i+1] = orig[i+1];
      computed[i+2] = orig[i+2]; computed[i+3] = orig[i+3];
      continue;
    }
    const u = 1 - f;
    computed[i]   = orig[i]   * u + computed[i]   * f;
    computed[i+1] = orig[i+1] * u + computed[i+1] * f;
    computed[i+2] = orig[i+2] * u + computed[i+2] * f;
    computed[i+3] = orig[i+3] * u + computed[i+3] * f;
  }
}

/* Compone una lista de nodos (un nivel del árbol) sobre `ctx`, de
   abajo a arriba. `scratch`, opcional, es el trazo en curso del
   compositor en vivo — { on, ownerId, canvas, alpha, blend } —; al
   aplanar o exportar se omite, porque ahí sólo interesan los píxeles
   ya confirmados de cada capa.

   Máscaras y recorte se resuelven con el mismo truco: un lienzo
   temporal aparte con `destination-in`, nunca el `ctx` que se está
   rellenando — necesario aquí porque, a diferencia del compositor de
   una sola pasada de antes, esta función se llama a sí misma para
   cada grupo anidado y un único lienzo compartido se pisaría entre
   llamadas. La cadena de recorte («recortar a la capa de abajo») vive
   dentro de este mismo nivel: la capa no recortada más reciente sirve
   de base para cuantas capas recortadas se acumulen encima, y una
   capa de ajuste ni tiene forma propia que ofrecer como base ni
   rompe la cadena si aparece en medio. */
export function compositeTree(nodes, ctx, w, h, scratch = null){
  let clipBaseCanvas = null;
  for(const node of nodes){
    const l = node.layer;
    if(!l.visible || l.opacity <= 0) continue;
    if(l.__editing) continue;

    if(isAdjustLayer(l)){
      const img = ctx.getImageData(0, 0, w, h);
      const orig = Uint8ClampedArray.from(img.data);
      applyAdjustLayer(l, img.data, w, h);
      const effectiveMask = getEffectiveMask(l);
      const maskAlpha = (effectiveMask && l.maskEnabled) ? readAlpha(effectiveMask.canvas, w, h) : null;
      blendAdjustResult(img.data, orig, l.opacity, maskAlpha);
      ctx.putImageData(img, 0, 0);
      continue;
    }

    let src;
    if(l.type === "group"){
      const buf = document.createElement("canvas");
      buf.width = w; buf.height = h;
      compositeTree(node.children, buf.getContext("2d", { colorSpace:"srgb" }), w, h, scratch);
      src = buf;
    } else {
      src = l.canvas;
    }

    const effectiveMask = getEffectiveMask(l);
    const ownMasked = !!(effectiveMask && l.maskEnabled);
    const hasScratch = !!(scratch && scratch.on && l.type !== "group" && scratch.ownerId === l.id);
    const doClip = !!(l.clipped && clipBaseCanvas);
    // «Esta capa» compara contra el brillo de la propia capa; «capa
    // subyacente», contra lo que ya está compuesto en `ctx` justo
    // ANTES de dibujar esta —por eso se lee aquí, antes de tocar nada
    // más—. Se salta por completo (ni el getImageData) cuando no está
    // activo, que es el caso normal de cualquier capa.
    const hasBlendIf = l.type !== "group" && isBlendIfActive(l.blendIf);
    const underlyingSnapshot = hasBlendIf ? ctx.getImageData(0, 0, w, h) : null;

    let drawn = src;
    if(ownMasked || hasScratch || doClip || hasBlendIf){
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext("2d", { colorSpace:"srgb" });
      tctx.drawImage(src, 0, 0);
      if(hasScratch){
        tctx.globalAlpha = scratch.alpha;
        tctx.globalCompositeOperation = scratch.blend;
        tctx.drawImage(scratch.canvas, scratch.x || 0, scratch.y || 0);
        tctx.globalAlpha = 1; tctx.globalCompositeOperation = "source-over";
      }
      // Justo aquí, con el trazo en curso ya fundido y antes de que la
      // máscara o el recorte reduzcan el alfa: «esta capa» tiene que
      // medir el color que de verdad se está pintando, no el de antes
      // de la pincelada.
      if(hasBlendIf){
        const alphaMap = buildBlendIfAlphaCanvas(tmp, underlyingSnapshot, w, h, l.blendIf);
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(alphaMap, 0, 0);
        tctx.globalCompositeOperation = "source-over";
      }
      if(ownMasked){
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(effectiveMask.canvas, 0, 0);
        tctx.globalCompositeOperation = "source-over";
      }
      if(doClip){
        tctx.globalCompositeOperation = "destination-in";
        tctx.drawImage(clipBaseCanvas, 0, 0);
        tctx.globalCompositeOperation = "source-over";
      }
      drawn = tmp;
    }

    // La base de recorte se fija ANTES de aplicar los estilos (una
    // sombra o un resplandor no deberían formar parte de la silueta a
    // la que se recorta lo de encima) y sólo si esta misma capa no
    // está recortada —encadenar recortes reutiliza la MISMA base, no
    // la capa recortada que se acaba de dibujar—.
    if(!l.clipped) clipBaseCanvas = drawn;

    if(l.styles && hasEnabledStyle(l.styles)){
      drawn = renderLayerStyles(drawn, l.styles, w, h);
    }

    // «Luz lineal» no es un modo de fusión nativo del lienzo (no está
    // en la lista de `globalCompositeOperation` del navegador, aunque
    // sí lo es de cualquier editor de imagen de verdad): editor/blend.js
    // la resuelve a mano, píxel a píxel. Hace falta para reconstruir
    // con precisión el original de una separación de frecuencias —la
    // capa de «alta» se recombina con la de «baja» justo con este
    // modo—, y para cualquier otro uso normal de luz lineal.
    drawWithBlend(ctx, drawn, l.blend, l.opacity, w, h);
  }
}

/* Láminas de estilo de las capas con estilos activos, a tamaño completo y en 8 bits, para el motor de
   coma flotante de exportación (core/precision-stack.js): ese motor recorre el documento por franjas, pero
   una sombra o un resplandor se desenfocan a través de las franjas, así que se dibujan aparte con la
   misma `drawn` que usa compositeTree (la capa ya recortada por su máscara y por el recorte, sin trazo en
   curso). Devuelve un Map capa → { behind, ring } (lienzos o null). Mismo recorrido y mismas reglas de
   recorte que compositeTree; sólo calcula lo que hace falta. */
export function collectStyleShapes(nodes, w, h, plates = new Map()){
  let clipBaseCanvas = null;
  for(const node of nodes){
    const l = node.layer;
    if(!l.visible || l.opacity <= 0 || l.__editing) continue;
    if(isAdjustLayer(l)) continue;
    let src;
    if(l.type === "group"){
      const buf = document.createElement("canvas");
      buf.width = w; buf.height = h;
      compositeTree(node.children, buf.getContext("2d", { colorSpace:"srgb" }), w, h, null);
      collectStyleShapes(node.children, w, h, plates);
      src = buf;
    } else src = l.canvas;
    const effectiveMask = getEffectiveMask(l);
    const ownMasked = !!(effectiveMask && l.maskEnabled), doClip = !!(l.clipped && clipBaseCanvas);
    let drawn = src;
    if(ownMasked || doClip){
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext("2d", { colorSpace:"srgb" });
      tctx.drawImage(src, 0, 0);
      if(ownMasked){ tctx.globalCompositeOperation = "destination-in"; tctx.drawImage(effectiveMask.canvas, 0, 0); tctx.globalCompositeOperation = "source-over"; }
      if(doClip){ tctx.globalCompositeOperation = "destination-in"; tctx.drawImage(clipBaseCanvas, 0, 0); tctx.globalCompositeOperation = "source-over"; }
      drawn = tmp;
    }
    if(!l.clipped) clipBaseCanvas = drawn;
    if(l.styles && hasEnabledStyle(l.styles)){
      plates.set(l, { behind: styleBehind(drawn, l.styles, w, h), ring: styleRing(drawn, l.styles, w, h) });
    }
  }
  return plates;
}

/* Devuelve un lienzo con todo el documento aplanado —de verdad, con
   grupos, máscaras, recorte, capas de ajuste y estilos ya resueltos—:
   lo que ve el usuario y lo que se exporta. Sustituye a la versión
   plana que vivía en core/doc.js, que sólo entendía capas sueltas. */
export function flatten(target, layers = doc.layers, w = doc.w, h = doc.h){
  const c = target || document.createElement("canvas");
  c.width = w; c.height = h;
  // Los modos de fusión que se resuelven a mano (blend.js) leen este
  // lienzo con getImageData en cada capa que los usa: sólo entonces
  // conviene que viva en CPU. En el caso normal se queda en GPU.
  const reads = !target && layers.some(l => CUSTOM_BLENDS.has(l.blend));
  const x = c.getContext("2d", reads ? { colorSpace:"srgb", willReadFrequently:true } : { colorSpace:"srgb" });
  x.clearRect(0, 0, w, h);
  compositeTree(buildLayerTree(layers), x, w, h, null);
  return c;
}
