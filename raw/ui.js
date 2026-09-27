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
  let workingSource=source, engineTimer=0, engineVersion=0;
  state.autoWb=autoWhiteBalance(source);
  let activeGroup="luz", activeKey="exposure", showingOriginal=false, zoom=1, closed=false, accepting=false, histogramTimer=0, finalWorker=null;
  const root=document.createElement("section"); root.id="rawDeveloper"; root.className="raw-developer";
  root.innerHTML=`
    <header class="raw-topbar">
      <button class="raw-cancel" type="button">Cancelar</button>
      <div class="raw-title"><b>${title}</b><span>${metaLine(metadata)}</span></div>
      <div class="raw-actions"><button type="button" data-action="undo" aria-label="Deshacer">↶</button><button type="button" data-action="redo" aria-label="Rehacer">↷</button><button class="primary" type="button" data-action="accept">Abrir en Reality</button></div>
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
  const schedule=()=>{if(closed)return;renderer.update(state,showingOriginal);root.querySelector(".raw-zoom").textContent=`${Math.round(zoom*100)} %`;};
  const engineChange=async(next,item)=>{
    if(!item.engine||!onSettingChange||closed)return;
    const version=++engineVersion;clearTimeout(engineTimer);
    engineTimer=setTimeout(async()=>{
      try{const result=await onSettingChange(next,item);if(result&&version===engineVersion&&!closed){workingSource=result;renderer.setSource(result);schedule();}}
      catch(error){if(!closed)toast(error?.message||"No se pudo actualizar el motor RAW","err");}
    },120);
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
      finalWorker=new RenderWorker();await finalWorker.setSource(workingSource);
      bitmap=await finalWorker.render(settings);
      if(closed)return;
      await onAccept(canvasCopy(bitmap),settings);close();
    }catch(error){if(!closed)toast(error?.message||"No se pudo aplicar el revelado","err");}
    finally{bitmap?.close();finalWorker?.dispose();finalWorker=null;accepting=false;if(!closed){root.querySelectorAll("input,select,button").forEach(input=>input.disabled=false);button.textContent="Abrir en Reality";}}
  });
  root.querySelector(".raw-fit").addEventListener("click",()=>{zoom=1;renderer.canvas.style.transform="";root.querySelector(".raw-zoom").textContent="100 %";});
  root.querySelector(".raw-preview").addEventListener("dblclick",()=>{zoom=zoom===1?1.8:1;renderer.canvas.style.transform=`scale(${zoom})`;root.querySelector(".raw-zoom").textContent=`${Math.round(zoom*100)} %`;});
  root.querySelector(".raw-preview").addEventListener("pointerdown",event=>{if(event.pointerType!=="touch")return; showingOriginal=true;schedule(); root.querySelector(".raw-preview").setPointerCapture(event.pointerId);});
  root.querySelector(".raw-preview").addEventListener("pointerup",()=>{showingOriginal=false;schedule();});
  root.querySelector(".raw-preview").addEventListener("pointercancel",()=>{showingOriginal=false;schedule();});
  const onKey=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();root.querySelector(event.shiftKey?"[data-action=redo]":"[data-action=undo]").click();}if(event.key==="Escape")close();if(event.key==="0")root.querySelector(".raw-fit").click();};
  const close=()=>{if(closed)return;closed=true;clearTimeout(histogramTimer);clearTimeout(engineTimer);renderer.dispose();finalWorker?.dispose();document.removeEventListener("keydown",onKey,true);root.remove();onClose?.();};
  document.addEventListener("keydown",onKey,true); sync(); schedule();
  return { close, state, initialState };
}
