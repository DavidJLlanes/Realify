import { RawDecoder } from "./decoder.js";
import { isRawFile } from "./formats.js";
import { defaults, normalize } from "./state.js";
import { openDeveloper } from "./ui.js";
import { dialog } from "../js/ui/dialog.js";
import { toast, status } from "../js/ui/toast.js";
import { newDoc, activeLayer } from "../js/core/doc.js";
import { clear as clearHistory } from "../js/core/history.js";
import { clearSnapshots } from "../js/core/snapshots.js";
import { emit } from "../js/core/bus.js";
import { commitFilter, filterBase } from "../js/editor/filterlayer.js";

const canvasCopy=source=>{const c=document.createElement("canvas");c.width=source.width;c.height=source.height;c.getContext("2d",{willReadFrequently:true}).drawImage(source,0,0);return c;};

export { isRawFile };

export async function openRawFile(file) {
  const choice=await dialog({title:"Archivo RAW detectado",body:`<p class="hint">${file.name}</p><p class="hint">Puedes extraer la previsualización JPEG incrustada o revelar los datos RAW reales con LibRaw. La segunda opción es la recomendada.</p>`,buttons:[{label:"Cancelar",value:"cancel"},{label:"Abrir como JPEG",value:"jpeg"},{label:"Revelar RAW",primary:true,value:"raw"}]});
  if(choice==="cancel"||!choice)return false;
  status(choice==="raw"?"Preparando revelado RAW…":"Extrayendo previsualización…");
  let decoder;
  try{
    decoder=await RawDecoder.open(file,defaults(),{thumbnailOnly:choice==='jpeg'});
    if(choice==="jpeg"){
      let thumb;try{thumb=await decoder.thumbnail();}catch{throw new Error("Este RAW no contiene una previsualización JPEG utilizable; elige «Revelar RAW».");}
      decoder.dispose();
      newDoc(thumb.width,thumb.height,{image:thumb,adoptImage:true,name:file.name.replace(/\.[^.]+$/,""),source:{w:thumb.width,h:thumb.height,type:"image/jpeg",size:file.size,name:file.name,file,rawPreview:true}});clearHistory();clearSnapshots();emit("doc:change");toast("Previsualización JPEG abierta");return true;
    }
    openDeveloper({title:"Revelado RAW",source:decoder.source,metadata:decoder.metadata,initial:defaults(),onSettingChange:(settings,item)=>decoder.renderBase(settings),onClose:()=>decoder?.dispose(),onAccept:async(result,settings)=>{
      const rawMetadata=decoder.metadata;
      /* Liberar el buffer lineal del decodificador antes de que el
         compositor móvil empiece a preparar el documento. En RAW de
         24 MP ese buffer puede superar 100 MB y mantenerlo durante el
         primer repintado provocaba cierres por presión de memoria. */
      decoder.dispose();
      newDoc(result.width,result.height,{image:result,adoptImage:true,name:file.name.replace(/\.[^.]+$/,""),layerName:"RAW revelado",source:{w:result.width,h:result.height,type:file.type||"image/x-raw",size:file.size,name:file.name,file,raw:true,rawSettings:settings,rawMetadata}});clearHistory();clearSnapshots();emit("doc:change");toast("RAW revelado y abierto en Reality","ok");
    }});
    // The developer owns the linear source now; do not retain the first
    // decode after engine settings replace it with a new one.
    decoder.source=null;
    return true;
  }catch(error){decoder?.dispose();toast(error?.message||"No se pudo revelar este RAW","err");return false;}finally{status("");}
}

export async function openPhotoDevelop(opts={}) {
  const edit=opts.edit||null, layer=edit?filterBase(edit):activeLayer();
  if(!layer){toast("No hay una capa que revelar","err");return;}
  const source=canvasCopy(layer.canvas), initial=normalize(opts.init);
  openDeveloper({title:"Revelado fotográfico",source,initial,onAccept:async(result,settings)=>{
    commitFilter({base:layer,edit,result,title:"Revelado fotográfico",filter:"photo-develop",params:settings});
    toast(edit?"Revelado fotográfico actualizado":"Revelado fotográfico · capa nueva","ok");
  }});
}

export async function renderPhotoDevelop({init={},render,edit=null}) {
  if(!render) return openPhotoDevelop({init,edit});
  const { renderPhoto }=await import("./pipeline.js");
  return renderPhoto(render.src,normalize(init),{preview:!render.isFinal});
}
