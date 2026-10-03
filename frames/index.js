import { doc, addLayer } from "../js/core/doc.js";
import { record } from "../js/core/history.js";
import { flatten } from "../js/editor/layertree.js";
import { emit } from "../js/core/bus.js";
import { toast } from "../js/ui/toast.js";
import { drawFrame } from "./render.js";

function ensureStyles(){
  const href=new URL("./frames.css",import.meta.url).href;
  if([...document.styleSheets].some(s=>s.href===href))return Promise.resolve();
  return new Promise(resolve=>{const l=document.createElement("link");l.rel="stylesheet";l.href=href;l.onload=l.onerror=resolve;document.head.append(l);});
}

function framePixels(w,h,pct){
  return Math.max(2,Math.round(Math.min(w,h)*Math.max(1,Math.min(24,pct))/100));
}

function expandedLayer(src,pad,newW,newH){
  const canvas=document.createElement("canvas");canvas.width=newW;canvas.height=newH;
  const ctx=canvas.getContext("2d",{willReadFrequently:true,colorSpace:"srgb"});
  if(src.canvas?.width&&src.canvas?.height)ctx.drawImage(src.canvas,pad,pad);
  const out={...src,canvas,ctx,thumbDirty:true,thumb:""};
  if(src.hiSrc)out.hiSrc={...src.hiSrc,x:(src.hiSrc.x||0)+pad,y:(src.hiSrc.y||0)+pad,canvasW:newW,canvasH:newH};
  if(src.mask){
    const mc=document.createElement("canvas");mc.width=newW;mc.height=newH;
    const mx=mc.getContext("2d",{willReadFrequently:true});
    mx.drawImage(src.mask.canvas,pad,pad);
    out.mask={canvas:mc,ctx:mx};
  }
  if(src.smartBox)out.smartBox={...src.smartBox,x:src.smartBox.x+pad,y:src.smartBox.y+pad};
  if(src.smartTransform)out.smartTransform={...src.smartTransform,tx:src.smartTransform.tx+pad,ty:src.smartTransform.ty+pad};
  if(src.type==="shape"&&src.shape)out.shape={...src.shape,x:src.shape.x+pad,y:src.shape.y+pad};
  return out;
}

function snapshotState(){
  return {
    layers:doc.layers.slice(),activeId:doc.activeId,w:doc.w,h:doc.h,
    selection:doc.selection,
    guides:{h:[...(doc.guides?.h||[])],v:[...(doc.guides?.v||[])]}
  };
}
function restoreState(s){
  doc.layers=s.layers.slice();doc.activeId=s.activeId;doc.w=s.w;doc.h=s.h;
  doc.selection=s.selection;
  doc.guides={h:[...s.guides.h],v:[...s.guides.v]};
  emit("doc:resize");emit("doc:structure");emit("doc:change");
}

function addOutsideFrame(preset,opts){
  const oldW=doc.w,oldH=doc.h,pad=framePixels(oldW,oldH,opts.width);
  const newW=oldW+pad*2,newH=oldH+pad*2;
  doc.layers=doc.layers.map(l=>expandedLayer(l,pad,newW,newH));
  doc.w=newW;doc.h=newH;doc.selection=null;
  doc.guides={
    h:(doc.guides?.h||[]).map(y=>y+pad),
    v:(doc.guides?.v||[]).map(x=>x+pad)
  };
  const layer=addLayer({name:`Marco · ${preset.label}`,above:doc.layers.length});
  drawFrame(layer.ctx,preset,newW,newH,{
    ...opts,borderPx:pad,
    contentRect:{x:pad,y:pad,w:oldW,h:oldH}
  });
  layer.frameMeta={preset:preset.id,...opts,outside:true,pad,sourceW:oldW,sourceH:oldH};
  layer.thumbDirty=true;
  emit("doc:resize");emit("doc:structure");emit("doc:change");
}

export async function openFrames(){
  if(!doc.open){toast("Abre una imagen antes de añadir un marco","err");return;}
  await ensureStyles();
  const {openFramesEditor}=await import("./ui.js");
  const source=flatten();
  openFramesEditor({
    source,
    onAccept:async(preset,opts)=>{
      const before=snapshotState();
      addOutsideFrame(preset,opts);
      const after=snapshotState();
      record("Añadir marco",()=>restoreState(before),()=>restoreState(after));
      toast(`Marco exterior añadido · ${preset.label}`,"ok");
    }
  });
}
