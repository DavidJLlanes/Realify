/* Editor panorámico independiente, de pantalla completa y adaptable. */
import { createShell, mountControls, stateHistory, decodePhoto, pickFiles, scaledCanvas } from "../js/ui/fsshell.js";
import { toast } from "../js/ui/toast.js";

const MOBILE = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:900px)").matches;
const WORK_SIDE = MOBILE ? 2400 : 4000, PREVIEW_SIDE = MOBILE ? 800 : 1100;
const MAX_AREA = MOBILE ? 16e6 : 60e6, MAX_PHOTOS = 20;
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");

export function openPanoramaEditor({ current = null, onAccept }){
  const worker = new Worker(new URL("../unir/worker.js", import.meta.url), { type:"module" });
  let req = 0, closed = false, timer = 0, renderSeq = 0, placedCache = null;
  const pending = new Map();
  worker.onmessage = e => {
    const m = e.data || {};
    if(m.type === "progress"){ sh.setBusy(m.msg); return; }
    const p = pending.get(m.req); if(!p) return;
    pending.delete(m.req); m.type === "error" ? p.reject(new Error(m.message)) : p.resolve(m);
  };
  worker.onerror = e => { for(const p of pending.values()) p.reject(new Error(e.message || "El motor panorámico se detuvo")); pending.clear(); };
  const call = (msg, transfer = []) => new Promise((resolve,reject) => { const id=++req; pending.set(id,{resolve,reject}); worker.postMessage({...msg,req:id},transfer); });
  const photos = []; let seq=0, usedCurrent=false, applying=false;
  const S = { order:[], projection:"cyl", alignment:"feature", direction:"auto", overlap:35, fov:60, quality:"balanced", fusion:"feather", blend:50, gain:true, crop:true, selected:null, offsets:{} };
  const sh = createShell({ title:"Panorámica desde fotos", subtitle:"Alineado y fusión de alta calidad", applyLabel:"Crear panorámica", onCancel:close, onApply:apply, onUndo:()=>hist.undo(), onRedo:()=>hist.redo() });
  const hist = stateHistory(S,()=>{ sync(); controls.refresh(); renderPhotos(); schedule(); },sh);
  sh.setApplyEnabled(false);
  const ordered = () => S.order.map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  sh.stage.addEventListener("click",e=>{ if(e.target.closest("[data-add-pano]")) addPhotos(); if(e.target.closest("[data-current-pano]")) addCurrent(); });
  const empty=()=>sh.setEmpty(photos.length?null:`<b>Panorámica desde fotos</b><span>Añade fotos de la misma escena con zonas solapadas. Elige el alineado, la proyección, la fusión y el recorte en los ajustes.</span><button type="button" data-add-pano>Añadir fotos</button>${current?'<button type="button" data-current-pano>Usar la imagen abierta</button>':""}`);
  empty();

  async function addItems(items){
    const room=MAX_PHOTOS-photos.length,sortInitial=photos.length===0; if(room<=0){toast(`Máximo ${MAX_PHOTOS} fotos`,"err");return;}
    sh.setBusy("Abriendo fotos…");
    try{
      const ims=[];
      for(const it of items.slice(0,room)){
        const full=it.canvas||await decodePhoto(it.file,WORK_SIDE), id=++seq;
        photos.push({id,name:it.name,full,proxy:scaledCanvas(full,PREVIEW_SIDE),thumb:scaledCanvas(full,144).toDataURL("image/jpeg",.82)}); S.order.push(id);
        const data=full.getContext("2d",{willReadFrequently:true}).getImageData(0,0,full.width,full.height).data;
        ims.push({id,w:full.width,h:full.height,data:data.buffer});
      }
      if(sortInitial){
        const byId=new Map(photos.map(p=>[p.id,p]));
        S.order.sort((a,b)=>(byId.get(a)?.name||"").localeCompare(byId.get(b)?.name||"",undefined,{numeric:true,sensitivity:"base"}));
      }
      await call({type:"add",images:ims},ims.map(x=>x.data));
      if(sortInitial) await call({type:"order",ids:S.order});
      placedCache=null; hist.reset();
      if(!S.selected&&S.order.length)S.selected=S.order[0];
    }catch(e){toast(e.message,"err");}
    finally{sh.setBusy(null);}
    changed();
  }
  async function addPhotos(){const files=await pickFiles();if(files.length) addItems(files.map(file=>({file,name:file.name})));}
  function addCurrent(){if(current&&!usedCurrent){usedCurrent=true;addItems([{canvas:current.canvas,name:current.name}]);}}
  async function remove(id){const p=photos.findIndex(x=>x.id===id);if(p<0)return;photos.splice(p,1);S.order=S.order.filter(x=>x!==id);delete S.offsets[id];if(S.selected===id)S.selected=S.order[0]??null;await call({type:"remove",id}).catch(()=>{});placedCache=null;hist.reset();changed();}
  function move(id,d){const i=S.order.indexOf(id),j=i+d;if(j<0||j>=S.order.length)return;[S.order[i],S.order[j]]=[S.order[j],S.order[i]];hist.commit();sync();renderPhotos();schedule();}
  function sync(){call({type:"order",ids:S.order}).catch(()=>{});placedCache=null;}
  function changed(){empty();sh.setApplyEnabled(photos.length>=2);sh.setSubtitle(photos.length?`${photos.length} fotos · ${S.alignment==="feature"?"alineado por puntos clave":"alineado automático"}`:"Alineado y fusión de alta calidad");renderPhotos();controls.refresh();if(!photos.length){sh.setView(null);return;}schedule();}

  function photoRow(p,compact){const row=document.createElement("div");row.className="fsp-photo";const i=S.order.indexOf(p.id);row.innerHTML=`<img alt="" src="${p.thumb}"><div><b>${i+1}. ${esc(p.name)}</b><small>${p.full.width} × ${p.full.height}</small></div><span class="ops">${compact?`<small class="ev">${i+1}</small>`:`<button type="button" class="x" data-mv="-1" aria-label="Mover antes">↑</button><button type="button" class="x" data-mv="1" aria-label="Mover después">↓</button>`}<button type="button" class="x" data-rm aria-label="Quitar">✕</button></span>`;
    row.addEventListener("click",e=>{if(e.target.closest("[data-rm]"))remove(p.id);else if(e.target.closest("[data-mv]"))move(p.id,+e.target.closest("[data-mv]").dataset.mv);else{S.selected=p.id;controls.refresh();}});return row;}
  function renderPhotos(){const L=sh.left;L.innerHTML="";const h=document.createElement("h3");h.textContent=`Fotos (${photos.length})`;L.appendChild(h);const list=document.createElement("div");list.className="fsp-photos";ordered().forEach(p=>list.appendChild(photoRow(p,false)));L.appendChild(list);const b=document.createElement("button");b.type="button";b.className="fsp-btn dashed";b.textContent="+ Añadir fotos";b.addEventListener("click",addPhotos);L.appendChild(b);const n=document.createElement("p");n.className="fsp-note";n.textContent="La primera tanda se ordena por nombre; ajusta la ruta de captura con las flechas si hace falta. Cada toma debe solapar con la siguiente.";L.appendChild(n);}
  function mobilePhotos(){const w=document.createElement("div");w.className="fsp-mphotos";ordered().forEach(p=>w.appendChild(photoRow(p,true)));const b=document.createElement("button");b.type="button";b.className="fsp-photo";b.style.cssText="display:grid;place-items:center;width:58px;height:58px;color:#e9edf4;font-size:22px;background:#272b31;border-style:dashed";b.textContent="+";b.addEventListener("click",addPhotos);w.appendChild(b);return w;}

  const sections=[
    {id:"alignment",label:"Alineado",props:[
      {key:"alignment",label:"Método",type:"select",options:[["feature","Puntos clave · ORB / RANSAC"],["auto","Automático · traslación"]]},
      {key:"quality",label:"Precisión del análisis",type:"select",when:()=>S.alignment==="feature",options:[["draft","Rápida"],["balanced","Equilibrada"],["high","Máxima"]]},
      {key:"direction",label:"Dirección de avance",type:"select",when:()=>S.alignment==="auto",options:[["auto","Detectar automáticamente"],["h","Horizontal"],["v","Vertical"]]},
      {key:"overlap",label:"Solape aproximado",type:"range",min:10,max:90,unit:" %",def:35,when:()=>S.alignment==="auto"},
      {key:"projection",label:"Proyección",type:"select",options:[["cyl","Cilíndrica · panorámicas"],["sph","Esférica · campo amplio"],["plane","Plana · arquitectura y escaneos"]]},
      {key:"fov",label:"Campo de visión",type:"range",min:20,max:120,unit:"°",def:60,when:()=>S.projection!=="plane"}
    ]},
    {id:"fusion",label:"Fusión",props:[
      {key:"fusion",label:"Método de fusión",type:"select",options:[["feather","Fundido por distancia · recomendado"],["average","Promedio uniforme"],["cut","Corte directo · sin fundido"]]},
      {key:"blend",label:"Anchura del fundido",type:"range",min:0,max:100,unit:" %",def:50,when:()=>S.fusion==="feather"},
      {key:"gain",label:"Compensar diferencias de exposición",type:"toggle"},
      {key:"crop",label:"Recortar automáticamente los bordes vacíos",type:"toggle"}
    ]},
    {id:"manual",label:"Ajuste manual",props:[
      {key:"selected",label:"Foto seleccionada",type:"select",options:()=>ordered().map((p,i)=>[p.id,`${i+1}. ${p.name}`])},
      {key:"dx",label:"Desplazamiento horizontal",type:"range",min:-300,max:300,unit:" px",def:0},
      {key:"dy",label:"Desplazamiento vertical",type:"range",min:-300,max:300,unit:" px",def:0},
      {key:"resetOffset",label:"Restablecer foto seleccionada",type:"button",run:()=>{if(S.selected!=null)delete S.offsets[S.selected];hist.commit();controls.refresh();schedule();}}
    ]}
  ];
  const controls=mountControls(sh,{sections,get:k=>k==="dx"||k==="dy"?(S.offsets[S.selected]?.[k]||0):S[k],set:(k,v,final)=>{if(k==="dx"||k==="dy"){if(S.selected!=null)S.offsets[S.selected]={...(S.offsets[S.selected]||{}),[k]:v};}else S[k]=v;if(final){hist.commit();if(["alignment","projection","quality","direction","selected"].includes(k)){placedCache=null;controls.refresh();renderPhotos();}}schedule(final?0:80);},mobileExtra:mobilePhotos});

  async function precise(final){
    const {loadOpenCv}=await import("../js/cv/opencv.js"),lib=await loadOpenCv();if(!lib)throw new Error("No se pudo cargar OpenCV para el alineado por puntos clave");
    const key=JSON.stringify([final,S.order,S.quality,S.projection,S.fov]);
    if(placedCache?.key!==key){
      const {placeMosaic}=await import("../unir/precise.js");
      let canvases=ordered().map(p=>final?p.full:p.proxy);
      if(S.projection!=="plane"){
        const {cylindrical,spherical}=await import("../unir/engine.js");
        const project=S.projection==="sph"?spherical:cylindrical;
        canvases=canvases.map(c=>{const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,c.width,c.height),im=project({w:c.width,h:c.height,data:d.data},S.fov,false),o=document.createElement("canvas");o.width=im.w;o.height=im.h;o.getContext("2d").putImageData(new ImageData(im.data,im.w,im.h),0,0);return o;});
      }
      const q={draft:{side:800,minInliers:8},balanced:{side:1200,minInliers:12},high:{side:1800,minInliers:20}}[S.quality];
      const r=await placeMosaic(lib.cv,canvases,{side:final?Math.min(WORK_SIDE,q.side*2):q.side,maxArea:final?MAX_AREA:7e6,interp:final?"lanczos":"linear",minInliers:q.minInliers,onStep:(i,n)=>sh.setBusy(`Buscando coincidencias · ${i} de ${n}`)});
      if(r.error||r.found.some(ok=>!ok)){
        // No mostrar una composición de traslación como si fuera el resultado
        // de ORB: puede duplicar fachadas cuando el emparejamiento falla.
        throw new Error(r.error||"No hay coincidencias fiables entre todas las fotos consecutivas. Reordena las imágenes o prueba el alineado automático.");
      }
      placedCache={key,r};
    }
    const r=placedCache.r;
    const refPrev=Math.min(...ordered().map(p=>p.proxy.height)),refFinal=Math.min(...ordered().map(p=>p.full.height));
    const target=final?Math.min(refFinal,Math.min(WORK_SIDE,({draft:1600,balanced:2400,high:3600}[S.quality]))):refPrev;
    const k=final?target/Math.max(1,refPrev):1;
    const images=r.images.map(im=>{const d=S.offsets[ordered()[im.i]?.id]||{};return {w:im.w,h:im.h,x:im.x+(+d.dx||0)*k,y:im.y+(+d.dy||0)*k,data:im.data.buffer.slice(0)};});
    const out=await call({type:"placed",s:params(),images});out.found=r.found;return out;
  }
  const params=()=>({...S,dir:S.direction,blend:S.blend,previewSide:PREVIEW_SIDE});
  function schedule(delay=0){if(photos.length<2)return;clearTimeout(timer);timer=setTimeout(preview,delay);}
  const view=document.createElement("canvas");
  async function preview(){const id=++renderSeq;sh.setBusy("Alineando y fusionando…");try{const r=S.alignment==="feature"?await precise(false):await call({type:"pano",s:params(),side:PREVIEW_SIDE,final:false});if(id!==renderSeq||closed)return;const missing=r.found?.filter(x=>!x).length||0;if(missing){sh.setView(null);toast(`Alineado incompleto: ${missing} foto(s) no tienen un solape fiable. Revisa el orden, la dirección o el método.`,"err");return;}view.width=r.w;view.height=r.h;view.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data),r.w,r.h),0,0);sh.setView(view,true);}catch(e){if(!closed){sh.setView(null);toast(e.message,"err");}}finally{if(id===renderSeq)sh.setBusy(null);}}
  async function apply(){if(applying||photos.length<2)return;applying=true;sh.setApplyEnabled(false);sh.setBusy("Generando panorámica a resolución completa…");try{const r=S.alignment==="feature"?await precise(true):await call({type:"pano",s:params(),side:WORK_SIDE,final:true,maxArea:MAX_AREA});if(r.found?.some(x=>!x))throw new Error("No se pudo alinear una o varias fotos; revisa el solape, el orden o el método de alineado");const out=document.createElement("canvas");out.width=r.w;out.height=r.h;out.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data),r.w,r.h),0,0);await onAccept(out,{count:photos.length});close();}catch(e){toast("No se pudo crear la panorámica: "+e.message,"err");sh.setBusy(null);sh.setApplyEnabled(true);applying=false;}}
  function close(){if(closed)return;closed=true;clearTimeout(timer);worker.terminate();sh.close();}
  renderPhotos();return {close};
}
