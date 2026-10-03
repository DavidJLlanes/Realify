import { FRAME_CATEGORIES, FRAME_PRESETS, frameById, framesInCategory } from "./presets.js";
import { drawFrame } from "./render.js";
import { createFrameViewport } from "./viewport.js";

function el(tag,cls){const n=document.createElement(tag);if(cls)n.className=cls;return n;}
const padFor=(w,h,pct)=>Math.max(2,Math.round(Math.min(w,h)*Math.max(1,Math.min(24,pct))/100));

function thumb(p){
  const c=el("canvas");c.width=180;c.height=126;const x=c.getContext("2d");
  const pad=Math.max(5,Math.min(24,Math.round(Math.min(c.width,c.height)*p.width/100)));
  x.fillStyle="#404854";x.fillRect(pad,pad,c.width-pad*2,c.height-pad*2);
  drawFrame(x,p,c.width,c.height,{clear:false,width:p.width,borderPx:pad,contentRect:{x:pad,y:pad,w:c.width-pad*2,h:c.height-pad*2}});
  return c;
}

export function openFramesEditor({ source, onAccept }){
  let preset=FRAME_PRESETS[0], category=preset.category, width=preset.width, primary=preset.primary, secondary=preset.secondary;
  const root=el("div","fr-root"); const head=el("div","fr-head"); const body=el("div","fr-body");
  const left=el("aside","fr-side left"), center=el("main","fr-center"), right=el("aside","fr-side right"), mobileBar=el("div","fr-mobile");
  const stage=el("div","fr-stage"), grid=el("div","fr-grid"), preview=el("canvas");
  const cancel=el("button","fr-btn"), apply=el("button","fr-btn primary");
  cancel.textContent="Cancelar";apply.textContent="Aplicar";head.innerHTML="<b>Marcos</b><div class='spacer'></div>";head.append(cancel,apply);
  stage.append(preview);center.append(stage,grid);body.append(left,center,right);root.append(head,body,mobileBar);document.body.append(root);

  const fit=el("button","fr-btn");fit.textContent="Encajar";fit.title="Restablecer zoom";
  head.insertBefore(fit,cancel);
  let renderRequest=0;
  const imageView=createFrameViewport(stage,preview,{
    onZoom:()=>{cancelAnimationFrame(renderRequest);renderRequest=requestAnimationFrame(fitPreview);},
    onChange:zoom=>{fit.disabled=zoom===1;}
  });
  fit.onclick=()=>imageView.reset();
  function fitStage(){imageView.fit();}
  const fitPreview=()=>{
    const sourcePad=padFor(source.width,source.height,width);
    const outerW=source.width+sourcePad*2,outerH=source.height+sourcePad*2;
    const max=Math.min(4096,1000*imageView.zoom),k=Math.min(1,max/outerW,max/outerH,Math.sqrt(8000000/(outerW*outerH))),pad=Math.max(1,Math.round(sourcePad*k));
    preview.width=Math.max(1,Math.round(outerW*k));preview.height=Math.max(1,Math.round(outerH*k));
    const imgW=Math.max(1,preview.width-pad*2),imgH=Math.max(1,preview.height-pad*2);
    const x=preview.getContext("2d");x.clearRect(0,0,preview.width,preview.height);
    x.drawImage(source,pad,pad,imgW,imgH);
    drawFrame(x,preset,preview.width,preview.height,{
      width,primary,secondary,clear:false,borderPx:pad,
      contentRect:{x:pad,y:pad,w:imgW,h:imgH}
    });
    fitStage();
  };
  const renderGrid=()=>{
    grid.textContent="";
    framesInCategory(category).forEach(p=>{
      const b=el("button","fr-card"+(p.id===preset.id?" on":""));b.append(thumb(p));const s=el("span");s.textContent=p.label;b.append(s);
      b.onclick=()=>choose(p);grid.append(b);
    });
  };
  left.innerHTML="<h3>Categorías</h3>";const cats=el("div","fr-cats");left.append(cats);
  FRAME_CATEGORIES.forEach(([id,label])=>{
    const b=el("button",id===category?"on":"");b.textContent=label;b.dataset.category=id;
    b.onclick=()=>choose(framesInCategory(id)[0]);cats.append(b);
  });

  function controlsHTML(){
    return `<h3>Ajustes</h3>
      <div class="fr-field"><label>Anchura exterior · <b data-wv>${Math.round(width)}%</b></label><input data-width type="range" min="1" max="24" step=".5" value="${width}"></div>
      <div class="fr-field"><label>Color principal</label><div class="fr-color"><span>${primary}</span><input data-primary type="color" value="${primary}"></div></div>
      <div class="fr-field" ${preset.singleColor?"hidden":""}><label>Color secundario</label><div class="fr-color"><span>${secondary}</span><input data-secondary type="color" value="${secondary}"></div></div>
      <p class="fr-note">El marco amplía el lienzo y se añade fuera de la fotografía. Nunca tapa píxeles de la imagen y queda como una capa independiente.</p>`;
  }
  function wireControls(host){
    host.querySelector("[data-width]")?.addEventListener("input",e=>{width=+e.target.value;syncValues();fitPreview();});
    host.querySelector("[data-primary]")?.addEventListener("input",e=>{primary=e.target.value;syncValues();fitPreview();});
    host.querySelector("[data-secondary]")?.addEventListener("input",e=>{secondary=e.target.value;syncValues();fitPreview();});
  }
  function renderControls(){right.innerHTML=controlsHTML();wireControls(right);}

  const catSel=el("select"),frameSel=el("select");
  catSel.setAttribute("aria-label","Categoría de marcos");frameSel.setAttribute("aria-label","Modelo de marco");
  FRAME_CATEGORIES.forEach(([id,label])=>catSel.add(new Option(label,id)));
  const refill=()=>{frameSel.textContent="";framesInCategory(category).forEach(p=>frameSel.add(new Option(p.label,p.id)));frameSel.value=preset.id;};
  const adjustments=el("div","fr-mobile-adjustments"),range=el("input"),widthValue=el("span","fr-width-value");
  range.type="range";range.min="1";range.max="24";range.step=".5";range.setAttribute("aria-label","Anchura exterior");
  const colors=["primary","secondary"].map((name,i)=>{
    const input=el("input");input.type="color";input.dataset[name]="";
    input.setAttribute("aria-label",i?"Color secundario":"Color principal");
    input.title=i?"Color secundario":"Color principal";return input;
  });
  adjustments.append(range,widthValue,...colors);
  const row=el("div","fr-mobile-row"),closeM=el("button","fr-btn"),applyM=el("button","fr-btn primary");closeM.textContent="Cancelar";applyM.textContent="Aplicar";row.append(closeM,applyM);
  mobileBar.append(catSel,frameSel,adjustments,row);
  // Los mandos de ambos modos comparten estado incluso al girar la pantalla.
  function syncValues(){
    root.querySelectorAll("[data-width]").forEach(n=>n.value=width);range.value=width;
    root.querySelectorAll("[data-wv]").forEach(n=>n.textContent=width+"%");widthValue.textContent=width+"%";
    for(const [name,value] of [["primary",primary],["secondary",secondary]]){
      root.querySelectorAll(`[data-${name}]`).forEach(n=>{
        n.value=value;if(n.parentElement.classList.contains("fr-color"))n.previousElementSibling.textContent=value;
      });
    }
    colors[1].hidden=!!preset.singleColor;
  }
  function choose(p){
    preset=p;category=p.category;width=p.width;primary=p.primary;secondary=p.secondary;
    catSel.value=category;refill();
    [...cats.children].forEach(n=>n.classList.toggle("on",n.dataset.category===category));
    renderGrid();renderControls();syncValues();fitPreview();
  }
  catSel.onchange=()=>{choose(framesInCategory(catSel.value)[0]);catSel.blur();};
  frameSel.onchange=()=>{choose(frameById(frameSel.value));frameSel.blur();};
  range.oninput=()=>{width=+range.value;syncValues();fitPreview();};
  colors[0].oninput=()=>{primary=colors[0].value;syncValues();fitPreview();};
  colors[1].oninput=()=>{secondary=colors[1].value;syncValues();fitPreview();};
  colors.forEach(input=>input.onchange=()=>input.blur());
  choose(preset);
  // iOS puede reducir la zona visible al mostrar sus barras o selectores nativos.
  const viewport=window.visualViewport;
  function fitViewport(){
    if(viewport&&viewport.scale===1){
      root.style.top=viewport.offsetTop+"px";root.style.left=viewport.offsetLeft+"px";
      root.style.width=viewport.width+"px";root.style.height=viewport.height+"px";
      root.style.bottom="auto";root.style.right="auto";
    }else{
      for(const key of ["top","left","width","height","bottom","right"])root.style[key]="";
    }
    fitStage();
  }
  viewport?.addEventListener("resize",fitViewport);viewport?.addEventListener("scroll",fitViewport);
  fitViewport();
  const resize=new ResizeObserver(fitStage);resize.observe(stage);

  const cleanup=()=>{cancelAnimationFrame(renderRequest);imageView.destroy();viewport?.removeEventListener("resize",fitViewport);viewport?.removeEventListener("scroll",fitViewport);resize.disconnect();root.remove();window.removeEventListener("keydown",key);};
  const key=e=>{if(e.key==="Escape")cleanup();};window.addEventListener("keydown",key);
  cancel.onclick=closeM.onclick=cleanup;
  const accept=async()=>{apply.disabled=applyM.disabled=true;try{await onAccept(preset,{width,primary,secondary});cleanup();}catch(e){console.error(e);apply.disabled=applyM.disabled=false;}};
  apply.onclick=applyM.onclick=accept;
}
