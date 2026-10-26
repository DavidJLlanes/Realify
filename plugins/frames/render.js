import { diamondPath, heartPath, borderMotifs, mixColor } from "./geometry.js";
import { drawArtisticFrame } from "./artistic.js";

/* Marcos procedurales de Realify.
   Todo el dibujo queda recortado a la corona exterior de contentRect:
   ningún preset puede invadir la fotografía. */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=s=>{let x=(s+1)*2654435761>>>0;return()=>((x=Math.imul(x^(x>>>15),2246822519)>>>0)>>>0)/4294967296};

function clipRing(c,W,H,r){
  if(!r)return;
  c.beginPath();c.rect(0,0,W,H);c.rect(r.x,r.y,r.w,r.h);c.clip("evenodd");
}
function bands(c,W,H,t,color){c.fillStyle=color;c.fillRect(0,0,W,t);c.fillRect(0,H-t,W,t);c.fillRect(0,t,t,H-2*t);c.fillRect(W-t,t,t,H-2*t);}
function rect(c,W,H,t,off=.12,lw=.06,color="#fff",dash=[]){
  c.save();c.strokeStyle=color;c.lineWidth=Math.max(1,t*lw);c.setLineDash(dash.map(n=>n*t));
  const d=t*off;c.strokeRect(d,d,W-d*2,H-d*2);c.restore();
}
function grad(c,W,H,t,a,b,vertical=false){
  const g=c.createLinearGradient(0,0,vertical?0:W,vertical?H:0);g.addColorStop(0,a);g.addColorStop(1,b);bands(c,W,H,t,g);
}
function dots(c,W,H,t,color,step=.5,r=.07){
  c.save();c.fillStyle=color;const s=Math.max(6,t*step),rr=Math.max(1,t*r);
  for(let x=s/2;x<W;x+=s)for(const y of [t*.5,H-t*.5]){c.beginPath();c.arc(x,y,rr,0,TAU);c.fill();}
  for(let y=s/2;y<H;y+=s)for(const x of [t*.5,W-t*.5]){c.beginPath();c.arc(x,y,rr,0,TAU);c.fill();}
  c.restore();
}
function corners(c,W,H,t,color,round=false){
  c.save();c.strokeStyle=color;c.lineWidth=Math.max(1,t*.08);c.lineCap="round";const m=t*.18,l=t*.55;
  for(const [x,y,sx,sy] of [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]]){
    c.beginPath();c.moveTo(x+sx*l,y);round?c.quadraticCurveTo(x,y,x,y+sy*l):c.lineTo(x,y);c.lineTo(x,y+sy*l);c.stroke();
  }c.restore();
}
function grain(c,W,H,t,color,seed,n=130){
  const r=rnd(seed);c.save();c.fillStyle=color;
  for(let i=0;i<n;i++){const e=(r()*4)|0,s=1+r()*Math.max(1,t*.07);let x,y;
    if(e<2){x=r()*W;y=e?r()*t+H-t:r()*t}else{x=e===2?r()*t:W-r()*t;y=r()*H}
    c.globalAlpha=.06+r()*.22;c.fillRect(x,y,s,s);
  }c.restore();
}
function stripes(c,W,H,t,a,b,diag=false){
  bands(c,W,H,t,a);c.save();c.strokeStyle=b;c.lineWidth=Math.max(1,t*.06);const s=Math.max(6,t*.22);
  if(diag){for(let x=-H;x<W+H;x+=s){c.beginPath();c.moveTo(x,0);c.lineTo(x+H,H);c.stroke();}}
  else{for(let x=0;x<W;x+=s){c.beginPath();c.moveTo(x,0);c.lineTo(x,t);c.moveTo(x,H-t);c.lineTo(x,H);c.stroke();}}
  c.restore();
}
function holes(c,W,H,t,color,rounded=false){
  c.save();c.fillStyle=color;const w=Math.max(3,t*.2),h=Math.max(3,t*.34),g=w*.75;
  for(let x=t*.18;x<W-t*.18;x+=w+g)for(const y of [t*.14,H-t*.48]){
    if(rounded){c.beginPath();c.roundRect(x,y,w,h,w*.3);c.fill();}else c.fillRect(x,y,w,h);
  }c.restore();
}
function confetti(c,W,H,t,colors,seed,n=80){
  const r=rnd(seed);c.save();
  for(let i=0;i<n;i++){const e=(r()*4)|0;let x,y;if(e<2){x=r()*W;y=e?H-r()*t:r()*t}else{x=e===2?r()*t:W-r()*t;y=r()*H}
    c.save();c.translate(x,y);c.rotate(r()*TAU);c.fillStyle=colors[i%colors.length];c.fillRect(-t*.035,-t*.12,t*.07,t*.24);c.restore();
  }c.restore();
}
function scallop(c,W,H,t,color){
  c.save();c.strokeStyle=color;c.lineWidth=Math.max(1,t*.055);const r=Math.max(3,t*.14);
  for(let x=r;x<W;x+=r*2){c.beginPath();c.arc(x,t*.24,r,0,Math.PI);c.stroke();c.beginPath();c.arc(x,H-t*.24,r,Math.PI,TAU);c.stroke();}
  c.restore();
}

function hearts(c,W,H,t,color){
  borderMotifs(c,W,H,t,1.05,x=>{
    x.fillStyle=color;heartPath(x,t*.62);x.fill();
  });
}

export function drawFrame(c,p,W,H,o={}){
  if(o.clear!==false)c.clearRect(0,0,W,H);
  const pct=clamp(o.width??p.width,1,24),t=Math.max(2,o.borderPx??Math.min(W,H)*pct/100);
  const a=o.primary||p.primary,b=o.secondary||p.secondary,v=p.variant||0;
  c.save();clipRing(c,W,H,o.contentRect);

  switch(p.family){
    case "basic":
      bands(c,W,H,t,a);
      break;
    case "artistic":
      drawArtisticFrame(c,p.style,W,H,t,a,b);
      break;
    case "minimal":
      if(v===0)rect(c,W,H,t,.5,.035,a);
      else if(v===1){rect(c,W,H,t,.18,.045,a);rect(c,W,H,t,.72,.035,b);}
      else if(v===2){rect(c,W,H,t,.14,.035,a);rect(c,W,H,t,.47,.035,b);rect(c,W,H,t,.8,.035,a);}
      else if(v===3){bands(c,W,H,t*.22,a);corners(c,W,H,t,b,true);}
      else if(v===4)rect(c,W,H,t,.82,.02,a);
      else if(v===5)grad(c,W,H,t,"#0000",a,true);
      else if(v===6)bands(c,W,H,t,a);
      else if(v===7){bands(c,W,H,t*.3,a);rect(c,W,H,t,.66,.05,b);}
      else if(v===8)corners(c,W,H,t,a,false);
      else if(v===9){c.shadowColor="#0009";c.shadowBlur=t*.2;rect(c,W,H,t,.32,.12,a);}
      else if(v===10){bands(c,W,H,t,a);rect(c,W,H,t,.78,.025,b);}
      else{bands(c,W,H,t,a);rect(c,W,H,t,.78,.025,b);}
      break;

    case "classic":{
      const base=a;
      bands(c,W,H,t,base);
      if(v<4){grain(c,W,H,t,b,v+10,170);rect(c,W,H,t,.24,.035,"#ffffff55");rect(c,W,H,t,.7,.06,"#0008");}
      else if(v===4){grad(c,W,H,t,mixColor(a,"#000000",.25),mixColor(b,"#ffffff",.25));rect(c,W,H,t,.7,.05,b);}
      else if(v===5){grad(c,W,H,t,mixColor(a,"#000000",.25),mixColor(b,"#ffffff",.25));rect(c,W,H,t,.7,.045,b);}
      else if(v===6){grain(c,W,H,t,b,26,120);rect(c,W,H,t,.6,.08,b);}
      else if(v===7){rect(c,W,H,t,.2,.03,b);rect(c,W,H,t,.75,.035,b);}
      else if(v===8){rect(c,W,H,t,.18,.025,"#fff7");rect(c,W,H,t,.75,.1,b);}
      else if(v===9){grad(c,W,H,t,mixColor(a,"#000000",.25),mixColor(b,"#ffffff",.25));rect(c,W,H,t,.66,.12,b);}
      else if(v===10){rect(c,W,H,t,.18,.035,b);rect(c,W,H,t,.48,.1,b);rect(c,W,H,t,.8,.025,b);}
      else grain(c,W,H,t,b,31,70);
      break;}

    case "mat":{
      const m=a;bands(c,W,H,t,m);
      if(v===9){rect(c,W,H,t,.55,.06,b);rect(c,W,H,t,.78,.025,b);}
      else if(v===10){rect(c,W,H,t,.2,.025,b);rect(c,W,H,t,.78,.045,b);}
      else if(v===11)rect(c,W,H,t,.88,.02,b);
      else rect(c,W,H,t,.8,.02,b);
      break;}

    case "film":
      bands(c,W,H,t,a);
      if(v===0)holes(c,W,H,t,b);
      else if(v===1){holes(c,W,H,t,b,true);c.fillStyle=b;c.font=`${Math.max(8,t*.15)}px monospace`;c.fillText("35 REALIFY",t*.7,t*.62);}
      else if(v===2)stripes(c,W,H,t,a,b);
      else if(v===3){holes(c,W,H,t,b);rect(c,W,H,t,.7,.03,b);}
      else if(v===4){rect(c,W,H,t,.15,.03,b);c.fillStyle=b;c.font=`${Math.max(8,t*.14)}px monospace`;c.fillText("SLIDE",t*.55,H-t*.28);}
      else if(v===5){holes(c,W,H,t,b,true);dots(c,W,H,t,b,1.15,.04);}
      else if(v===6){holes(c,W,H,t,b);grain(c,W,H,t,b,46,160);}
      else if(v===7){holes(c,W,H,t,b);grain(c,W,H,t,b,47,130);}
      else if(v===8){holes(c,W,H,t,b);rect(c,W,H,t,.72,.03,b);}
      else if(v===9){holes(c,W,H,t,b);grain(c,W,H,t,b,49,300);}
      else if(v===10){holes(c,W,H,t,b,true);rect(c,W,H,t,.66,.035,b,[.22,.16]);}
      else{holes(c,W,H,t,b);rect(c,W,H,t,.64,.04,b);}
      break;

    case "instant":{
      const q=a;bands(c,W,H,t,q);
      if(v===0)rect(c,W,H,t,.8,.02,b);
      else if(v===1){grain(c,W,H,t,b,61,90);rect(c,W,H,t,.8,.025,b);}
      else if(v===2)rect(c,W,H,t,.76,.03,b);
      else if(v===3){grain(c,W,H,t,b,63,120);rect(c,W,H,t,.2,.025,b);}
      else if(v===4)grad(c,W,H,t,mixColor(a,"#000000",.25),mixColor(b,"#ffffff",.25));
      else if(v===5)grad(c,W,H,t,mixColor(a,"#000000",.25),mixColor(b,"#ffffff",.25));
      else if(v===6){c.fillStyle=b;c.textAlign="center";c.font=`${Math.max(9,t*.16)}px sans-serif`;c.fillText("REALIFY",W/2,H-t*.28);}
      else if(v===7)corners(c,W,H,t,b,true);
      else if(v===8)rect(c,W,H,t,.86,.02,b);
      else if(v===9)rect(c,W,H,t,.9,.015,b);
      else if(v===10){c.shadowColor="#0008";c.shadowBlur=t*.2;rect(c,W,H,t,.15,.08,b);}
      else grain(c,W,H,t,b,69,220);
      break;}

    case "vintage":{
      const q=a;bands(c,W,H,t,q);
      if(v===0)grain(c,W,H,t,b,70,170);
      else if(v===1){grain(c,W,H,t,b,71,270);rect(c,W,H,t,.7,.035,b,[.25,.16]);}
      else if(v===2){grain(c,W,H,t,b,72,120);rect(c,W,H,t,.78,.02,b);}
      else if(v===3)scallop(c,W,H,t,b);
      else if(v===4){bands(c,W,H,t,mixColor(a,"#000000",.3));grain(c,W,H,t,b,74,210);rect(c,W,H,t,.68,.05,b);}
      else if(v===5){rect(c,W,H,t,.7,.035,b,[.28,.18]);c.fillStyle=b;c.font=`${Math.max(8,t*.14)}px serif`;c.fillText("POST",t*.55,t*.58);}
      else if(v===6){corners(c,W,H,t,b,true);grain(c,W,H,t,b,76,90);}
      else if(v===7){corners(c,W,H,t,b);rect(c,W,H,t,.48,.035,b);}
      else if(v===8)stripes(c,W,H,t,q,b,true);
      else if(v===9){rect(c,W,H,t,.68,.03,b,[.2,.14]);dots(c,W,H,t,b,1.15,.035);}
      else if(v===10)stripes(c,W,H,t,q,b);
      else{rect(c,W,H,t,.2,.055,b);rect(c,W,H,t,.7,.025,b);}
      break;}

    case "geometric":
      bands(c,W,H,t,a);
      if(p.motif==="heart")hearts(c,W,H,t,b);
      else if(v===0)stripes(c,W,H,t,a,b);
      else if(v===1)corners(c,W,H,t,b);
      else if(v===2)stripes(c,W,H,t,a,b,true);
      else if(v===3)dots(c,W,H,t,b,.38,.1);
      else if(v===4){c.save();c.strokeStyle=b;c.lineWidth=Math.max(1,t*.055);for(let x=0;x<W;x+=t*.45){c.beginPath();c.moveTo(x,0);c.lineTo(x+t*.22,t*.38);c.lineTo(x+t*.45,0);c.stroke();}c.restore();}
      else if(v===5){for(let k=0;k<5;k++)rect(c,W,H,t,.12+k*.16,.035,k%2?a:b);}
      else if(v===6)dots(c,W,H,t,b,.3,.06);
      else if(v===7){c.fillStyle=b;for(let x=0;x<W;x+=t*.5){c.fillRect(x,0,t*.25,t*.4);c.fillRect(x+t*.25,H-t*.4,t*.25,t*.4);}}
      else if(v===8){for(let k=0;k<4;k++)rect(c,W,H,t,.15+k*.18,.025,k%2?b:a);}
      else if(v===9){for(let k=0;k<4;k++)rect(c,W,H,t,k*.18,.055,b);}
      else if(v===10){
        borderMotifs(c,W,H,t,.9,(x)=>{
          x.strokeStyle=b;x.lineWidth=Math.max(.8,t*.035);
          diamondPath(x,t*.58);x.stroke();
          x.fillStyle=b;diamondPath(x,t*.22);x.fill();
        });
      }
      else{rect(c,W,H,t,.18,.035,b);rect(c,W,H,t,.5,.035,a);rect(c,W,H,t,.82,.035,b);}
      break;

    case "decorative":
      bands(c,W,H,t,a);
      if(v===0){dots(c,W,H,t,b,.5,.1);corners(c,W,H,t,b,true);}
      else if(v===1){scallop(c,W,H,t,b);corners(c,W,H,t,b);}
      else if(v===2)scallop(c,W,H,t,b);
      else if(v===3){corners(c,W,H,t,b,true);rect(c,W,H,t,.7,.03,b,[.22,.16]);}
      else if(v===4){scallop(c,W,H,t,b);dots(c,W,H,t,b,.8,.035);}
      else if(v===5){rect(c,W,H,t,.22,.06,b);corners(c,W,H,t,b);dots(c,W,H,t,b,1,.035);}
      else if(v===6){c.fillStyle=b;c.textAlign="center";c.font=`${Math.max(10,t*.3)}px serif`;c.fillText("❦",W/2,t*.58);c.fillText("❦",W/2,H-t*.3);}
      else if(v===7){c.fillStyle=b;c.textAlign="center";c.font=`${Math.max(10,t*.25)}px serif`;c.fillText("★",W/2,t*.56);c.fillText("★",W/2,H-t*.32);}
      else if(v===8)hearts(c,W,H,t,b);
      else if(v===9)stripes(c,W,H,t,a,b,true);
      else if(v===10)dots(c,W,H,t,b,.32,.08);
      else corners(c,W,H,t,b);
      break;

    case "color":{
      const q=[a,b];grad(c,W,H,t,q[0],q[1],v%2===0);
      if(v===0){for(let k=0;k<6;k++)rect(c,W,H,t,.1+k*.13,.035,mixColor(a,b,k/5));}
      else if(v===4||v===7)dots(c,W,H,t,mixColor(b,b,.4),.42,.055);
      else if(v===5||v===10){c.shadowColor=q[1];c.shadowBlur=t*.28;rect(c,W,H,t,.68,.045,mixColor(b,b,.5));}
      else if(v===6)rect(c,W,H,t,.58,.065,mixColor(b,b,.35));
      else if(v===8)stripes(c,W,H,t,q[0],q[1],true);
      else if(v===9)corners(c,W,H,t,mixColor(b,b,.5),true);
      else if(v===11)grain(c,W,H,t,mixColor(b,b,.5),91,120);
      break;}

    case "festive":{
      const q=[a,b];bands(c,W,H,t,q[0]);
      if(v===0)dots(c,W,H,t,q[1],.55,.1);
      else if(v===1)confetti(c,W,H,t,[q[0],q[1],mixColor(b,b,.5),mixColor(a,b,.3)],101,95);
      else if(v===2){dots(c,W,H,t,mixColor(b,b,.5),.34,.055);grain(c,W,H,t,mixColor(b,b,.5),102,90);}
      else if(v===3){corners(c,W,H,t,q[1],true);dots(c,W,H,t,mixColor(b,b,.45),.55,.04);}
      else if(v===4){rect(c,W,H,t,.22,.05,b);corners(c,W,H,t,b,true);}
      else if(v===5){c.fillStyle=q[1];c.textAlign="center";c.font=`${Math.max(10,t*.23)}px serif`;c.fillText("★",W/2,t*.55);c.fillText("★",W/2,H-t*.32);}
      else if(v===6)hearts(c,W,H,t,b);
      else if(v===7){dots(c,W,H,t,q[1],.4,.065);corners(c,W,H,t,mixColor(b,b,.5),true);}
      else if(v===8)dots(c,W,H,t,mixColor(b,b,.35),.4,.09);
      else if(v===9){grain(c,W,H,t,q[1],109,150);corners(c,W,H,t,mixColor(b,b,.35),true);}
      else if(v===10){grain(c,W,H,t,q[1],110,160);rect(c,W,H,t,.7,.03,mixColor(b,b,.45),[.2,.14]);}
      else confetti(c,W,H,t,[q[0],q[1],mixColor(b,b,.5),mixColor(a,b,.6),mixColor(a,b,.8)],111,130);
      break;}
  }
  c.restore();
}
