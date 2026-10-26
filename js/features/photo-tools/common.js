/* ═══════════════════════════════════════════════════════════════
   photo-tools · piezas que usan varios bloques
   Parte de js/features/photo-tools.js, que conserva la API y reexporta lo de aquí.
   ═══════════════════════════════════════════════════════════════ */

import { activeLayer, doc } from "../../core/doc.js";
import { toast } from "../../core/toast.js";

export function rasterLayer(){
  const layer = activeLayer();
  if(!layer) { toast("No hay capa activa"); return null; }
  if(layer.locked) { toast("La capa está bloqueada"); return null; }
  if(layer.type === "adjust") { toast("Selecciona una capa de imagen"); return null; }
  return layer;
}

export function sliderRow(id, label, min, max, value, unit = "", step = 1){
  return `<div class="field"><label for="${id}">${label}</label>` +
    `<input class="grow" type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">` +
    `<span class="unit mono" data-for="${id}">${value}${unit}</span></div>`;
}

function wireValues(body, units = {}){
  body.querySelectorAll('input[type="range"]').forEach(r => r.addEventListener("input", () => {
    const out = body.querySelector(`[data-for="${r.id}"]`);
    if(out) out.textContent = r.value + (units[r.id] || "");
  }));
}

const UNITS = { bgTol:"", bgFeather:" px", dnLum:"%", dnChroma:"%",
  lensDist:"", lensCA:" px", lensVig:"%", ssAmount:"%", ssRadius:" px",
  ssThreshold:"", maskFeather:" px", portraitSmooth:"%", portraitShine:"%",
  portraitEye:"%", trScale:"%", trRotate:"°", trSkewX:"°", trSkewY:"°",
  wmOpacity:"%", wmSize:" px", aiStrength:"%" };

const BUILTIN_LENS_PROFILES={
  "apple-iphone15-main":{name:"Apple iPhone 15 Pro · principal",make:"Apple",model:"iPhone 15 Pro",lens:"iPhone 15 Pro back camera",distortion:-8,ca:.35,vignette:7},
  "canon-ef2470-24":{name:"Canon EF 24-70mm f/2.8L II · 24 mm",make:"Canon",lens:"EF24-70mm f/2.8L II USM",distortion:-6,ca:.3,vignette:6},
  "nikon-z1424-14":{name:"NIKKOR Z 14-24mm f/2.8 S · 14 mm",make:"Nikon",lens:"NIKKOR Z 14-24mm f/2.8 S",distortion:-14,ca:.55,vignette:12},
  "sony-fe1635-16":{name:"Sony FE 16-35mm F2.8 GM · 16 mm",make:"Sony",lens:"FE 16-35mm F2.8 GM",distortion:-11,ca:.45,vignette:9},
  "gopro-hero12":{name:"GoPro HERO12 Black · gran angular",make:"GoPro",model:"HERO12 Black",distortion:-36,ca:1.4,vignette:25}
};

function lensProfiles(){let custom={};try{custom=JSON.parse(localStorage.getItem("realify.lensProfiles")||"{}");}catch{}return{...BUILTIN_LENS_PROFILES,...custom};}

/* Cableado compartido por los dos tipos de diálogo: la etiqueta junto
   a cada deslizador, el interruptor de modo de la máscara por rango, y
   el selector de perfil de lente que rellena sus tres deslizadores.
   `settingsDialog` (aplica al cerrar) y `liveDialog` (vista previa en
   marcha) montan sobre el mismo HTML, así que comparten este cableado
   en vez de duplicarlo. */
export function wireCommon(host){
  wireValues(host, UNITS);
  const mode=host.querySelector("#maskMode");
  if(mode) mode.addEventListener("change",()=>{
    host.querySelector("#maskLum").hidden=mode.value!=="lum";
    host.querySelector("#maskColor").hidden=mode.value!=="color";
  });
  const bgMethod=host.querySelector("#bgMethod");
  if(bgMethod){
    const sync=()=>{host.querySelector("#bgTolRow").hidden=bgMethod.value!=="color";};
    bgMethod.addEventListener("change",sync);sync();
  }
  const profile=host.querySelector("#lensProfile");
  if(profile){
    const profiles=lensProfiles();for(const [id,p] of Object.entries(profiles)){const o=document.createElement("option");o.value=id;o.textContent=p.name||id;profile.appendChild(o);}
    const applyProfile=id=>{let p=profiles[id];if(id==="auto"){const meta=doc.source?.exif||{},hay=(meta.make+" "+meta.model+" "+meta.lens).toLowerCase();p=Object.values(profiles).find(q=>hay&&[q.make,q.model,q.lens].some(v=>v&&hay.includes(v.toLowerCase())));if(!p){toast("No se encontró un perfil coincidente en los EXIF", "err");return;}}if(!p)return;[["lensDist",p.distortion],["lensCA",p.ca],["lensVig",p.vignette]].forEach(([id,v])=>{const el=host.querySelector("#"+id);el.value=v;el.dispatchEvent(new Event("input"));});};
    profile.addEventListener("change",()=>applyProfile(profile.value));
    const input=host.querySelector("#lensProfileFile"),button=host.querySelector("#lensImport");if(button&&input){button.onclick=()=>input.click();input.onchange=async()=>{try{const raw=JSON.parse(await input.files[0].text()),items=Array.isArray(raw)?raw:[raw],saved=JSON.parse(localStorage.getItem("realify.lensProfiles")||"{}");for(const q of items){if(!q.name||![q.distortion,q.ca,q.vignette].every(Number.isFinite))throw new Error("Formato inválido");saved[q.id||q.name.toLowerCase().replace(/\W+/g,"-")]=q;}localStorage.setItem("realify.lensProfiles",JSON.stringify(saved));toast("Perfil óptico importado; vuelve a abrir el filtro","ok");}catch(e){toast("No se pudo importar el perfil: "+e.message,"err");}};}
  }
}
