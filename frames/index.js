import { doc, addLayer } from "../js/core/doc.js";
import { recordLayers } from "../js/core/history.js";
import { flatten } from "../js/editor/layertree.js";
import { emit } from "../js/core/bus.js";
import { toast } from "../js/ui/toast.js";
import { drawFrame } from "./render.js";

function ensureStyles(){
  const href=new URL("./frames.css",import.meta.url).href;
  if([...document.styleSheets].some(s=>s.href===href))return Promise.resolve();
  return new Promise(resolve=>{const l=document.createElement("link");l.rel="stylesheet";l.href=href;l.onload=l.onerror=resolve;document.head.append(l);});
}

export async function openFrames(){
  if(!doc.open){toast("Abre una imagen antes de añadir un marco","err");return;}
  await ensureStyles();
  const { openFramesEditor }=await import("./ui.js");
  const source=flatten();
  openFramesEditor({
    source,
    onAccept: async (preset,opts)=>{
      recordLayers("Añadir marco",()=>{
        const layer=addLayer({name:`Marco · ${preset.label}`,above:doc.layers.length});
        drawFrame(layer.ctx,preset,doc.w,doc.h,opts);
        layer.frameMeta={preset:preset.id,...opts};
        layer.thumbDirty=true;
        emit("doc:structure");emit("doc:change");
      });
      toast(`Marco añadido · ${preset.label}`,"ok");
    }
  });
}
