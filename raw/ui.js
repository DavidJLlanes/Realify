import { GROUPS, CONTROLS, control, controlsFor, normalize, valueText } from "./state.js";
import { Preview } from "./preview.js";
import { RenderWorker } from "./render-client.js";
import { toast } from "../js/ui/toast.js";
import { autoWhiteBalance } from './tone.js';

const canvasCopy = source => {
  const canvas=document.createElement("canvas"); canvas.width=source.width; canvas.height=source.height;
  canvas.getContext("2d",{willReadFrequently:true}).drawImage(source,0,0); return canvas;
};

const metaLine = metadata => {
  const make=metadata?.make || metadata?.model || "RAW";
  const lens=metadata?.lens?.Lens || metadata?.lens || "";
  const iso=metadata?.iso_speed || metadata?.iso || metadata?.common?.real_ISO;
  return [make,lens,iso ? `ISO ${Math.round(iso)}` : ""].filter(Boolean).join(" · ");
};

export function openDeveloper({ title="Revelado fotográfico", source, metadata=null, initial=null, onAccept, onClose=null, onSettingChange=null }) {
  const state=normalize(initial), initialState=structuredClone(state), history=[], future=[];
  let workingSource=source, engineTimer=0, engineVersion=0, engineBusy=false, enginePending=null;
  state.autoWb=autoWhiteBalance(source);
  let activeGroup="luz", activeKey="exposure", showingOriginal=false, zoom=1, previewZoom=1, closed=false, accepting=false, histogramTimer=0, finalWorker=null;
  const root=document.createElement("section"); root.id="rawDeveloper"; root.className="raw-developer";
  root.innerHTML=`
    <header class="raw-topbar">
      <button class="raw-cancel" type="button">Cancelar</button>
      <div class="raw-title"><b>${title}</b><span>${metaLine(metadata)}</span></div>
      <div class="raw-actions"><button type="button" data-action="undo" aria-label="Deshacer">↶</button><button type="button" data-action="redo" aria-label="Rehacer">↷</button><button class="primary" type="button" data-action="accept">Abrir en Realify</button></div>
    </header>
    <main class="raw-workspace">
      <aside class="raw-left">
        <div class="raw-hist"><span>Histograma</span><canvas width="256" height="76"></canvas></div>
        <div class="raw-meta"><b>Archivo RAW</b><span>${metaLine(metadata) || "Datos de cámara no disponibles"}</span></div>
      </aside>
      <div class="raw-preview"><canvas></canvas><div class="raw-zoom">100 %</div><button class="raw-fit" type="button" title="Encajar vista">⌗</button></div>
      <aside class="raw-controls"><div class="raw-groups"></div><div class="raw-control-list"></div></aside>
    </main>
    <footer class="raw-mobile-controls">
      <select aria-label="Grupo de revelado" class="raw-mobile-group">${GROUPS.map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select>
      <select aria-label="Ajuste" class="raw-mobile-control"></select>
      <div class="raw-mobile-slider"></div>
    </footer>`;
  document.body.appendChild(root);
  const preview=root.querySelector(".raw-preview canvas");
  const hist=root.querySelector(".raw-hist canvas"), histCtx=hist.getContext("2d");
  const list=root.querySelector(".raw-control-list"), groups=root.querySelector(".raw-groups");
  const mobileGroup=root.querySelector(".raw-mobile-group"), mobileControl=root.querySelector(".raw-mobile-control"), mobileSlider=root.querySelector(".raw-mobile-slider");
  const histSample=document.createElement("canvas");histSample.width=128;histSample.height=80;
  const sampleCtx=histSample.getContext("2d",{willReadFrequently:true});
  const drawHist=canvas=>{
    clearTimeout(histogramTimer);
    if(matchMedia("(max-width:900px)").matches)return;
    histogramTimer=setTimeout(()=>{
      if(closed)return;
      sampleCtx.clearRect(0,0,128,80);sampleCtx.drawImage(canvas,0,0,128,80);
      const data=sampleCtx.getImageData(0,0,128,80).data,bins=new Uint32Array(256);
      for(let i=0;i<data.length;i+=4)bins[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;
      const top=Math.max(1,...bins),w=hist.width,h=hist.height;histCtx.clearRect(0,0,w,h);histCtx.fillStyle="#9ab7ff";
      bins.forEach((v,i)=>histCtx.fillRect(i,h-v/top*h,1,Math.max(1,v/top*h)));
    },160);
  };
  const renderer=new Preview(preview,source,{onDraw:drawHist,onError:error=>toast(error.message,"err")});
  source=null; // workingSource/renderer own it; don't retain the initial RAW.
  const schedule=()=>{if(closed)return;renderer.update(state,showingOriginal);root.querySelector(".raw-zoom").textContent=`${Math.round(previewZoom*100)} %`;};
  const engineChange=(next,item)=>{
    if(!item.engine||!onSettingChange||closed)return;
    enginePending={next,item,version:++engineVersion};
    clearTimeout(engineTimer);
    const launch=async()=>{
      if(closed||engineBusy||!enginePending)return;
      const pending=enginePending;enginePending=null;engineBusy=true;
      try{
        const result=await onSettingChange(pending.next,pending.item);
        if(result&&pending.version===engineVersion&&!closed){workingSource=result;renderer.setSource(result);schedule();}
      }catch(error){if(!closed)toast(error?.message||"No se pudo actualizar el motor RAW","err");}
      finally{engineBusy=false;if(enginePending&&!closed){clearTimeout(engineTimer);engineTimer=setTimeout(launch,180);}}
    };
    engineTimer=setTimeout(launch,180);
  };
  const remember=()=>{ history.push(structuredClone(state)); if(history.length>50)history.shift(); future.length=0; };
  const setValue=(item,value,{track=false}={})=>{
    if(accepting||closed)return;
    const next=item.type==='choice'?value:Math.max(item.min,Math.min(item.max,+Number(value).toFixed(6)));
    if(state[item.key]===next)return;
    if(track)remember();state[item.key]=next;sync(false);schedule();
  };
  const groupButtons=()=>{ groups.innerHTML=GROUPS.map(([key,label])=>`<button type="button" class="${key===activeGroup?"on":""}" data-group="${key}">${label}</button>`).join(""); groups.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{activeGroup=button.dataset.group; activeKey=controlsFor(activeGroup)[0].key; sync();})); };
  const field=(item,mobile=false)=>{
    if(item.type==="choice") return `<label class="raw-field raw-choice"><span>${mobile?"":item.label}</span><select data-key="${item.key}">${item.options.map(([v,label])=>`<option value="${v}"${state[item.key]===v?" selected":""}>${label}</option>`).join("")}</select></label>`;
    if(item.type==="toggle") return `<label class="raw-field raw-toggle"><span>${item.label}<b>${valueText(item,state[item.key])}</b></span><input aria-label="${item.label}" data-key="${item.key}" type="checkbox"${state[item.key]?" checked":""}></label>`;
    if(item.type==="text") return `<label class="raw-field raw-text"><span>${item.label}<b>${valueText(item,state[item.key])}</b></span><input aria-label="${item.label}" data-key="${item.key}" type="text" value="${String(state[item.key]||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" placeholder="Opcional"></label>`;
    return `<div class="raw-field" role="group" aria-label="${item.label}"><span>${mobile?"":item.label}<b>${valueText(item,state[item.key])}</b></span><div class="raw-slider-row"><button type="button" class="raw-step" data-step="-1" aria-label="Disminuir ${item.label}" title="Disminuir ${item.label}">−</button><input aria-label="${item.label}" title="Doble clic o doble toque: restablecer a cero" data-key="${item.key}" type="range" min="${item.min}" max="${item.max}" step="${item.step||1}" value="${state[item.key]}"><button type="button" class="raw-step" data-step="1" aria-label="Aumentar ${item.label}" title="Aumentar ${item.label}">+</button></div></div>`;
  };
  const wireFields=host=>host.querySelectorAll('[data-key]').forEach(input=>{
    const item=control(input.dataset.key);
    if(item.type==='choice'){input.addEventListener('change',()=>{setValue(item,input.value,{track:true});engineChange(structuredClone(state),item);});return;}
    if(item.type==='toggle'){input.addEventListener('change',()=>{remember();state[item.key]=input.checked;sync(false);schedule();engineChange(structuredClone(state),item);});return;}
    if(item.type==='text'){input.addEventListener('change',()=>{remember();state[item.key]=input.value.trim();sync(false);schedule();engineChange(structuredClone(state),item);});return;}
    let started=false,tap=null,down=null,suppressTap=false;
    const reset=()=>{setValue(item,0,{track:true});started=false;};
    input.addEventListener('input',()=>{
      if(accepting||closed)return;
      if(suppressTap){input.value='0';reset();return;}
      if(!started&&+input.value!==state[item.key]){remember();started=true;}
      setValue(item,input.value);
      engineChange(structuredClone(state),item);
    });
    input.addEventListener('change',()=>{if(suppressTap){input.value='0';reset();return;}setValue(item,input.value,{track:!started});started=false;engineChange(structuredClone(state),item);});
    input.addEventListener('dblclick',event=>{event.preventDefault();reset();});
    input.addEventListener('pointerdown',event=>{
      started=false;
      if(event.pointerType!=='touch'){suppressTap=false;return;}
      const now=performance.now();
      suppressTap=!!tap&&now-tap.time<350&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<28;
      down={x:event.clientX,y:event.clientY,time:now};
      if(suppressTap){event.preventDefault();tap=null;reset();}
    });
    input.addEventListener('pointerup',event=>{
      if(event.pointerType==='touch'&&down){
        if(!suppressTap&&performance.now()-down.time<250&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<12)tap={x:event.clientX,y:event.clientY,time:performance.now()};
        else tap=null;
      }
      down=null;started=false;
      if(suppressTap){input.value='0';reset();}
    });
    input.addEventListener('pointercancel',()=>{tap=null;down=null;started=false;});
    input.addEventListener('keydown',event=>{suppressTap=false;if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();reset();}});
    input.closest('.raw-field').querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>setValue(item,state[item.key]+Number(button.dataset.step)*(item.step||1),{track:true})));
  });
  const mobileOptions=()=>{ mobileControl.innerHTML=controlsFor(activeGroup).map(item=>`<option value="${item.key}">${item.label}</option>`).join(""); mobileControl.value=activeKey; const item=control(activeKey); mobileSlider.innerHTML=field(item,true); wireFields(mobileSlider); };
  const sync=(full=true)=>{
    if(full){ groupButtons(); list.innerHTML=controlsFor(activeGroup).map(item=>field(item)).join(""); wireFields(list); mobileGroup.value=activeGroup; mobileOptions(); }
    root.querySelectorAll(".raw-field input").forEach(input=>{const item=control(input.dataset.key); if(!item)return; if(item.type==='toggle')input.checked=!!state[item.key]; else input.value=state[item.key];});
    root.querySelectorAll('.raw-field select').forEach(input=>input.value=state[input.dataset.key]);
    root.querySelectorAll(".raw-field b").forEach(value=>{const item=control(value.closest(".raw-field")?.querySelector("[data-key]")?.dataset.key); if(item)value.textContent=valueText(item,state[item.key]);});
  };
  mobileGroup.addEventListener("change",()=>{activeGroup=mobileGroup.value;activeKey=controlsFor(activeGroup)[0].key;sync();});
  mobileControl.addEventListener("change",()=>{activeKey=mobileControl.value;mobileOptions();});
  root.querySelector(".raw-cancel").addEventListener("click",()=>close());
  root.querySelector("[data-action=undo]").addEventListener("click",()=>{const previous=history.pop();if(!previous)return;future.push(structuredClone(state));Object.assign(state,previous);sync();schedule();});
  root.querySelector("[data-action=redo]").addEventListener("click",()=>{const next=future.pop();if(!next)return;history.push(structuredClone(state));Object.assign(state,next);sync();schedule();});
  root.querySelector("[data-action=accept]").addEventListener("click",async()=>{
    if(accepting||closed)return;accepting=true;
    const button=root.querySelector("[data-action=accept]"),settings=structuredClone(state);
    button.disabled=true;button.textContent="Revelando…";
    root.querySelectorAll("input,select,.raw-step,.raw-groups button,[data-action=undo],[data-action=redo]").forEach(input=>input.disabled=true);
    let bitmap;
    try{
      // Never export an obsolete source while LibRaw is decoding an
      // engine change (or start both expensive operations together).
      while((engineBusy||enginePending)&&!closed)await new Promise(resolve=>setTimeout(resolve,30));
      if(closed)return;
      finalWorker=new RenderWorker();
      let result;
      if(workingSource.linear){
        const {width,height}=workingSource;
        renderer.dispose();
        await finalWorker.setSource(workingSource,{transfer:true});
        workingSource=null;
        result=await finalWorker.renderToCanvas(settings,width,height,percent=>{if(!closed)button.textContent=`Revelando… ${percent} %`;});
      }else{
        await finalWorker.setSource(workingSource);
        bitmap=await finalWorker.render(settings);
        if(closed)return;
        result=canvasCopy(bitmap);
        bitmap.close();bitmap=null;
      }
      if(closed){result.width=result.height=1;return;}
      finalWorker.dispose();finalWorker=null;
      renderer.dispose();workingSource=null;
      await onAccept(result,settings);close();
    }catch(error){if(!closed){toast(error?.message||"No se pudo aplicar el revelado","err");if(renderer.closed)close();}}
    finally{bitmap?.close();finalWorker?.dispose();finalWorker=null;accepting=false;if(!closed){root.querySelectorAll("input,select,button").forEach(input=>input.disabled=false);button.textContent="Abrir en Realify";}}
  });
  const rawPreview=root.querySelector(".raw-preview");
  const previewPointers=new Map();let previewPinch=null,previewDrag=null;
  let previewPan={x:0,y:0};
  const paintPreviewTransform=()=>{renderer.canvas.style.transform=`translate(${previewPan.x}px,${previewPan.y}px) scale(${previewZoom})`;root.querySelector(".raw-zoom").textContent=`${Math.round(previewZoom*100)} %`;};
  const setPreviewZoom=(next)=>{previewZoom=Math.max(1,Math.min(4,next));if(previewZoom===1)previewPan={x:0,y:0};paintPreviewTransform();};
  root.querySelector(".raw-fit").addEventListener("click",()=>{zoom=1;previewPan={x:0,y:0};setPreviewZoom(1);});
  root.querySelector(".raw-preview").addEventListener("dblclick",()=>setPreviewZoom(previewZoom===1?1.8:1));
  rawPreview.addEventListener("wheel",event=>{event.preventDefault();setPreviewZoom(previewZoom*(event.deltaY<0?1.12:1/1.12));},{passive:false});
  rawPreview.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;
    if(event.pointerType==="mouse"){
      if(event.button!==0||previewZoom<=1)return;
      event.preventDefault();previewDrag={id:event.pointerId,x:event.clientX,y:event.clientY,px:previewPan.x,py:previewPan.y};rawPreview.classList.add("is-panning");
      try{rawPreview.setPointerCapture(event.pointerId);}catch{};
      return;
    }
    if(event.pointerType!=="touch")return;
    previewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    try{rawPreview.setPointerCapture(event.pointerId);}catch{}
    if(previewPointers.size===2){event.preventDefault();showingOriginal=false;previewDrag=null;rawPreview.classList.add("is-panning");const [a,b]=[...previewPointers.values()];previewPinch={d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z:previewZoom,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,px:previewPan.x,py:previewPan.y};schedule();}
    else if(previewZoom>1){event.preventDefault();previewDrag={id:event.pointerId,x:event.clientX,y:event.clientY,px:previewPan.x,py:previewPan.y};rawPreview.classList.add("is-panning");}
    else{showingOriginal=true;schedule();}
  });
  rawPreview.addEventListener("pointermove",event=>{
    if(previewDrag?.id===event.pointerId&&previewPointers.size<2){previewPan={x:previewDrag.px+event.clientX-previewDrag.x,y:previewDrag.py+event.clientY-previewDrag.y};paintPreviewTransform();return;}
    if(event.pointerType!=="touch")return;
    if(previewPointers.has(event.pointerId))previewPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(previewPinch&&previewPointers.size===2){const [a,b]=[...previewPointers.values()];const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;previewPan={x:previewPinch.px+cx-previewPinch.cx,y:previewPinch.py+cy-previewPinch.cy};setPreviewZoom(previewPinch.z*Math.hypot(a.x-b.x,a.y-b.y)/previewPinch.d);}
  });
  const endPreviewPointer=event=>{
    if(event.pointerType==="mouse"){if(previewDrag?.id===event.pointerId){previewDrag=null;rawPreview.classList.remove("is-panning");}return;}
    if(event.pointerType!=="touch")return;
    previewPointers.delete(event.pointerId);if(previewPointers.size<2){previewPinch=null;if(previewZoom<=1)rawPreview.classList.remove("is-panning");}
    if(previewPointers.size<2&&previewZoom>1&&previewPointers.size===1){const [p]=[...previewPointers.entries()];previewDrag={id:p[0],x:p[1].x,y:p[1].y,px:previewPan.x,py:previewPan.y};}
    if(!previewPointers.size){previewDrag=null;rawPreview.classList.remove("is-panning");showingOriginal=false;schedule();}
  };
  rawPreview.addEventListener("pointerup",endPreviewPointer);rawPreview.addEventListener("pointercancel",endPreviewPointer);
  const onKey=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();root.querySelector(event.shiftKey?"[data-action=redo]":"[data-action=undo]").click();}if(event.key==="Escape")close();if(event.key==="0")root.querySelector(".raw-fit").click();};
  const close=()=>{if(closed)return;closed=true;clearTimeout(histogramTimer);clearTimeout(engineTimer);enginePending=null;workingSource=null;renderer.dispose();finalWorker?.dispose();document.removeEventListener("keydown",onKey,true);root.remove();onClose?.();};
  document.addEventListener("keydown",onKey,true); sync(); schedule();
  return { close, state, initialState };
}
