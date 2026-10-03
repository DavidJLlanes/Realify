import { FRAME_CATEGORIES, FRAME_PRESETS, frameById, framesInCategory } from "./presets.js";
import { drawFrame } from "./render.js";

const mobile=()=>matchMedia("(max-width:900px)").matches;
function el(tag,cls){const n=document.createElement(tag);if(cls)n.className=cls;return n;}

function thumb(p){
  const c=el("canvas");c.width=180;c.height=126;const x=c.getContext("2d");
  x.fillStyle="#404854";x.fillRect(0,0,c.width,c.height);
  drawFrame(x,p,c.width,c.height,{width:p.width});
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

  const fitPreview=()=>{
    const max=1000, k=Math.min(1,max/source.width,max/source.height);
    preview.width=Math.max(1,Math.round(source.width*k));preview.height=Math.max(1,Math.round(source.height*k));
    const x=preview.getContext("2d");x.clearRect(0,0,preview.width,preview.height);x.drawImage(source,0,0,preview.width,preview.height);
    drawFrame(x,preset,preview.width,preview.height,{width,primary,secondary,clear:false});
  };
  const renderGrid=()=>{
    grid.textContent="";
    framesInCategory(category).forEach(p=>{
      const b=el("button","fr-card"+(p.id===preset.id?" on":""));b.append(thumb(p));const s=el("span");s.textContent=p.label;b.append(s);
      b.onclick=()=>{preset=p;width=p.width;primary=p.primary;secondary=p.secondary;renderGrid();renderControls();fitPreview();};grid.append(b);
    });
  };
  left.innerHTML="<h3>Categorías</h3>";const cats=el("div","fr-cats");left.append(cats);
  FRAME_CATEGORIES.forEach(([id,label])=>{const b=el("button",id===category?"on":"");b.textContent=label;b.onclick=()=>{category=id;preset=framesInCategory(id)[0];width=preset.width;primary=preset.primary;secondary=preset.secondary;[...cats.children].forEach(x=>x.classList.toggle("on",x===b));renderGrid();renderControls();fitPreview();};cats.append(b);});

  function controlsHTML(){
    return `<h3>Ajustes</h3>
      <div class="fr-field"><label>Grosor · <b data-wv>${Math.round(width)}%</b></label><input data-width type="range" min="1" max="24" step=".5" value="${width}"></div>
      <div class="fr-field"><label>Color principal</label><div class="fr-color"><span>${primary}</span><input data-primary type="color" value="${primary}"></div></div>
      <div class="fr-field"><label>Color secundario</label><div class="fr-color"><span>${secondary}</span><input data-secondary type="color" value="${secondary}"></div></div>
      <p class="fr-note">El marco se añade como una capa independiente. La imagen original y su origen de 16 bits no se modifican.</p>`;
  }
  function wireControls(host){
    host.querySelector("[data-width]")?.addEventListener("input",e=>{width=+e.target.value;host.querySelector("[data-wv]").textContent=Math.round(width)+"%";fitPreview();});
    host.querySelector("[data-primary]")?.addEventListener("input",e=>{primary=e.target.value;fitPreview();});
    host.querySelector("[data-secondary]")?.addEventListener("input",e=>{secondary=e.target.value;fitPreview();});
  }
  function renderControls(){right.innerHTML=controlsHTML();wireControls(right);}
  renderControls();renderGrid();fitPreview();

  const catSel=el("select"), frameSel=el("select");
  FRAME_CATEGORIES.forEach(([id,label])=>{const o=new Option(label,id);catSel.add(o);});
  const refill=()=>{frameSel.textContent="";framesInCategory(category).forEach(p=>frameSel.add(new Option(p.label,p.id)));frameSel.value=preset.id;};
  catSel.value=category;refill();
  const range=el("input");range.type="range";range.min="1";range.max="24";range.step=".5";range.value=width;
  const row=el("div","fr-mobile-row"), closeM=el("button","fr-btn"), applyM=el("button","fr-btn primary");closeM.textContent="Cancelar";applyM.textContent="Aplicar";row.append(closeM,applyM);
  mobileBar.append(catSel,frameSel,range,row);
  catSel.onchange=()=>{category=catSel.value;preset=framesInCategory(category)[0];width=preset.width;primary=preset.primary;secondary=preset.secondary;refill();range.value=width;renderGrid();renderControls();fitPreview();};
  frameSel.onchange=()=>{preset=frameById(frameSel.value);width=preset.width;primary=preset.primary;secondary=preset.secondary;range.value=width;fitPreview();};
  range.oninput=()=>{width=+range.value;fitPreview();};

  const cleanup=()=>{root.remove();window.removeEventListener("keydown",key);};
  const key=e=>{if(e.key==="Escape")cleanup();};window.addEventListener("keydown",key);
  cancel.onclick=closeM.onclick=cleanup;
  const accept=async()=>{apply.disabled=applyM.disabled=true;try{await onAccept(preset,{width,primary,secondary});cleanup();}catch(e){console.error(e);apply.disabled=applyM.disabled=false;}};
  apply.onclick=applyM.onclick=accept;
}
