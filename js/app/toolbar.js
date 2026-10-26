/* ═══════════════════════════════════════════════════════════════
   APP · barra de herramientas del escritorio (grupos, menú emergente y pulsación larga)
   Parte de js/main.js (el arranque), que importa este módulo.
   ═══════════════════════════════════════════════════════════════ */

import { TOOLS, setTool, current } from "../editor/tools/tools.js";
import { run } from "../core/commands.js";
import { on } from "../core/bus.js";
import { haptic } from "../core/device.js";
import { stage } from "./dom.js";

/* ═══ barra de herramientas ═══ */
export function buildTools(){
  const host = document.getElementById("tools");
  host.innerHTML = "";
  // Separadores por grupo, no por indice: al anadir una herramienta
  // los indices bailan y los separadores acaban en cualquier sitio.
  const GROUPS = new Set(["select-rect", "brush", "clone", "picker", "liquify", "compare"]);

  /* Doble clic en el botón de una herramienta: la convención de
     Photoshop. En la mano equivale a «ajustar a la ventana» y en la
     lupa a «tamaño real», que son las dos cosas que se piden a diario
     y que si no hay que ir a buscar al menú Ver. */
  const DBL = { pan: "view.fit", zoom: "view.zoom100", move: "layer.centerContent" };

  const bundles=[
    ["pan","zoom"], ["crop","transform","perspective"],
    ["brush","eraser","smudge"], ["fill","gradient","shape"],
    ["clone","heal"], ["expose","dodgeburn"],
    ["select-rect","select-ellipse","select-lasso","select-wand","pen"]
  ];
  const bundled=new Set(bundles.flat());
  const byId=id=>TOOLS.find(t=>t.id===id);
  const configure=(b,t)=>{
    b.dataset.tool=t.id;
    const extra=t.id==="pan"?" · doble clic: ajustar a la ventana":t.id==="zoom"?" · doble clic: tamaño real":t.id==="move"?" · doble clic: centrar en el lienzo":"";
    b.title=`${t.name}${t.key?` (${t.key.toUpperCase()})`:""}${extra}`;
    b.setAttribute("aria-label",t.name);b.innerHTML=t.icon;
  };
  const popup=(button,tools)=>{
    document.querySelector(".tool-flyout")?.remove();
    const p=document.createElement("div");p.className="tool-flyout";
    for(const t of tools){const x=document.createElement("button");x.innerHTML=t.icon+`<span>${t.name}</span>`;x.onclick=()=>{setTool(t.id);configure(button,t);p.remove();};p.appendChild(x);}
    document.body.appendChild(p);const r=button.getBoundingClientRect();p.style.left=Math.min(innerWidth-p.offsetWidth-8,r.right+5)+"px";p.style.top=Math.min(innerHeight-p.offsetHeight-8,r.top)+"px";
    setTimeout(()=>document.addEventListener("pointerdown",e=>{if(!p.contains(e.target))p.remove();},{once:true}),0);
  };
  const addButton=t=>{
    if(GROUPS.has(t.id)){
      const s = document.createElement("div");
      s.className = "tool-sep";
      host.appendChild(s);
    }
    const b = document.createElement("button");
    b.className = "tool" + (t === current ? " on" : "");
    configure(b,t);
    /* El icono de un grupo puede cambiar de herramienta. El clic debe
       activar la que muestra ahora, no la primera con la que se creó el
       botón. Tras una pulsación larga tampoco debe dispararse el clic
       sintético que llega al soltar el ratón o el dedo. */
    b.addEventListener("click", e => {
      if(b._longPressOpened){
        b._longPressOpened = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      setTool(b.dataset.tool);
    });
    if(DBL[t.id]) b.addEventListener("dblclick", e => {
      e.preventDefault();
      run(DBL[t.id]);
    });
    host.appendChild(b);
    return b;
  };
  const emitted=new Set();
  for(const t of TOOLS){
    const ids=bundles.find(g=>g.includes(t.id));
    if(!ids){addButton(t);continue;}
    if(emitted.has(ids))continue;emitted.add(ids);
    const tools=ids.map(byId).filter(Boolean),chosen=tools.includes(current)?current:tools[0],b=addButton(chosen);
    b.dataset.bundle=ids.join(",");b.classList.add("has-flyout");b.title+=" · mantén pulsado para ver herramientas agrupadas";
    b.oncontextmenu=e=>{e.preventDefault();popup(b,tools);};
    let timer=0,startX=0,startY=0;
    const cancelHold=()=>{if(timer){clearTimeout(timer);timer=0;}};
    b.onpointerdown=e=>{
      /* Photoshop abre el grupo manteniendo pulsado el botón principal,
         tanto con ratón como con lápiz o dedo. */
      if(e.button!==0)return;
      startX=e.clientX;startY=e.clientY;
      cancelHold();
      timer=setTimeout(()=>{
        timer=0;
        b._longPressOpened=true;
        popup(b,tools);
      },450);
    };
    b.onpointermove=e=>{
      if(timer&&Math.hypot(e.clientX-startX,e.clientY-startY)>8)cancelHold();
    };
    b.onpointerup=b.onpointercancel=b.onpointerleave=cancelHold;
  }
}

on("tool:change", () => {
  document.querySelectorAll(".tool").forEach(b => {
    const ids=(b.dataset.bundle||"").split(",");
    if(ids.includes(current.id)){
      const t=TOOLS.find(x=>x.id===current.id);if(t){b.dataset.tool=t.id;b.innerHTML=t.icon;b.setAttribute("aria-label",t.name);}
    }
    b.classList.toggle("on", b.dataset.tool === current.id);
  });
  stage.style.cursor = current.cursor === "none" ? "none" : (current.cursor || "default");
  haptic(6);
});
