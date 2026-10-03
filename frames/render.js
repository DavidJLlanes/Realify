/* Render vectorial de marcos. Todo se dibuja en una capa aparte:
   nunca se modifica ni se cuantiza la foto que hay debajo. */

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function strokeRect(ctx,x,y,w,h,width,color,join="miter"){
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineJoin=join;
  ctx.strokeRect(x+width/2,y+width/2,w-width,h-width); ctx.restore();
}
function fillBands(ctx,W,H,t,color){
  ctx.fillStyle=color;
  ctx.fillRect(0,0,W,t); ctx.fillRect(0,H-t,W,t); ctx.fillRect(0,t,t,H-2*t); ctx.fillRect(W-t,t,t,H-2*t);
}
function dotted(ctx,W,H,t,color,step=2){
  ctx.save(); ctx.fillStyle=color;
  const r=Math.max(1,t*.12), s=Math.max(8,t*step);
  for(let x=t*.7;x<W;x+=s){ctx.beginPath();ctx.arc(x,t*.5,r,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(x,H-t*.5,r,0,TAU);ctx.fill();}
  for(let y=t*.7;y<H;y+=s){ctx.beginPath();ctx.arc(t*.5,y,r,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(W-t*.5,y,r,0,TAU);ctx.fill();}
  ctx.restore();
}
function corners(ctx,W,H,t,color,variant=0){
  ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=Math.max(2,t*.22); ctx.lineCap="round";
  const l=t*(1.5+(variant%3)*.45), m=t*.55;
  [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(([x,y,sx,sy])=>{
    ctx.beginPath();ctx.moveTo(x+sx*l,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*l);ctx.stroke();
  }); ctx.restore();
}
function gradient(ctx,W,H,a,b,vertical=false){
  const g=ctx.createLinearGradient(0,0,vertical?0:W,vertical?H:0); g.addColorStop(0,a); g.addColorStop(1,b); return g;
}
function seed(i){let x=(i+1)*2654435761>>>0;return()=>((x=Math.imul(x^(x>>>15),2246822519)>>>0)>>>0)/4294967296;}

export function drawFrame(ctx,p,W,H,opts={}){
  if(opts.clear !== false) ctx.clearRect(0,0,W,H);
  const scale=Math.min(W,H), pct=clamp(opts.width ?? p.width,1,24);
  const t=Math.max(2,scale*pct/100);
  const a=opts.primary||p.primary, b=opts.secondary||p.secondary, v=p.variant||0;
  ctx.save();

  if(p.family==="minimal"){
    const mode=v%12;
    if(mode===0) strokeRect(ctx,0,0,W,H,t,a);
    else if(mode===1){strokeRect(ctx,0,0,W,H,t*.65,a);strokeRect(ctx,t*1.3,t*1.3,W-t*2.6,H-t*2.6,t*.22,b);}
    else if(mode===2){for(let k=0;k<3;k++)strokeRect(ctx,t*k*.75,t*k*.75,W-t*k*1.5,H-t*k*1.5,t*.18,a);}
    else if(mode===3) strokeRect(ctx,t*.8,t*.8,W-t*1.6,H-t*1.6,t*.35,a,"round");
    else if(mode===4) strokeRect(ctx,0,0,W,H,Math.max(1,t*.12),a);
    else if(mode===5){ctx.shadowColor="#0008";ctx.shadowBlur=t*.7;strokeRect(ctx,t*.35,t*.35,W-t*.7,H-t*.7,t*.3,a,"round");}
    else if(mode===6) strokeRect(ctx,0,0,W,H,t*1.55,a);
    else if(mode===7){strokeRect(ctx,t*.6,t*.35,W-t*1.2,H-t*.7,t*.3,a);corners(ctx,W,H,t,b,v);}
    else if(mode===8) corners(ctx,W,H,t,a,v);
    else if(mode===9){fillBands(ctx,W,H,t*.5,"#0008");strokeRect(ctx,t*.45,t*.45,W-t*.9,H-t*.9,t*.16,a);}
    else fillBands(ctx,W,H,t,mode===10?"#fff":"#111");
  }

  else if(p.family==="classic"){
    const woods=["#18130f","#6f4429","#b7834b","#522b22","#b38a30","#a9adb3","#8c6a3a","#eee7d6","#252525","#8f6c4d","#4f2f20","#111"];
    const c=woods[v%woods.length]; fillBands(ctx,W,H,t,c);
    strokeRect(ctx,t*.15,t*.15,W-t*.3,H-t*.3,t*.12,"#ffffff55");
    strokeRect(ctx,t*.72,t*.72,W-t*1.44,H-t*1.44,t*.16,v===4?"#f7df8d":"#00000088");
    strokeRect(ctx,t*1.08,t*1.08,W-t*2.16,H-t*2.16,t*.08,"#ffffff66");
  }

  else if(p.family==="mat"){
    const mats=["#fff","#f5efe4","#e8ddc8","#a9adb3","#111","#1f304d","#87967b","#cfa6aa","#d8c5a5","#f7f2e9","#ece7dd","#fafafa"];
    const c=mats[v%mats.length]; fillBands(ctx,W,H,t,c);
    const inner=t*(v===11?1.6:.78);
    strokeRect(ctx,inner,inner,W-inner*2,H-inner*2,Math.max(1,t*.08),v===4?"#777":"#7776");
    if(v===9||v===10) strokeRect(ctx,inner+t*.35,inner+t*.35,W-(inner+t*.35)*2,H-(inner+t*.35)*2,t*.12,b);
  }

  else if(p.family==="film"){
    const dark=v===6?"#222":"#0b0b0b"; fillBands(ctx,W,H,t,dark);
    const hole=Math.max(3,t*.34), gap=hole*.75;
    ctx.fillStyle=v===7?"#d8b07c":"#eee";
    for(let x=t*.25;x<W-t*.25;x+=hole+gap){ctx.fillRect(x,t*.18,hole,t*.34);ctx.fillRect(x,H-t*.52,hole,t*.34);}
    if(v===1||v===4){ctx.fillStyle="#eee";ctx.font=`${Math.max(8,t*.23)}px monospace`;ctx.fillText("REALIFY · 35",t*.8,t*.78);ctx.fillText("FRAME",W-t*2.2,H-t*.28);}
    if(v===9){const rnd=seed(v);ctx.fillStyle="#fff3";for(let i=0;i<180;i++)ctx.fillRect(rnd()*W,rnd()*H,1+rnd()*2,1+rnd()*2);}
  }

  else if(p.family==="instant"){
    const c=["#f8f6ef","#efe8da","#111","#f2eadc","#f4e2c6","#e7f0ef","#fff","#fafafa","#f7f4ec","#fdfcf7","#f8f8f8","#e6dcc8"][v];
    const top=t*.7, side=t*.7, bottom=t*(v===7?1.8:2.15);
    ctx.fillStyle=c;ctx.fillRect(0,0,W,top);ctx.fillRect(0,H-bottom,W,bottom);ctx.fillRect(0,top,side,H-top-bottom);ctx.fillRect(W-side,top,side,H-top-bottom);
    if(v===6){ctx.fillStyle="#777";ctx.font=`${Math.max(10,t*.28)}px sans-serif`;ctx.textAlign="center";ctx.fillText("REALIFY",W/2,H-bottom*.42);}
    if(v===11){ctx.globalAlpha=.22;ctx.fillStyle="#8c6b45";for(let y=0;y<H;y+=Math.max(6,t*.28))ctx.fillRect(0,y,W,1);}
  }

  else if(p.family==="vintage"){
    const papers=["#b98f5e","#c9a878","#d8c19b","#8b6b4a","#a45b38","#ccb58a","#cab087","#c29b74","#bda989","#8b745e","#b8a27f","#9d8360"];
    fillBands(ctx,W,H,t,papers[v]);
    const rnd=seed(v+20);ctx.globalAlpha=.28;ctx.fillStyle="#3b2617";
    for(let i=0;i<120;i++){const s=1+rnd()*Math.max(2,t*.12);ctx.fillRect(rnd()*W,rnd()*H,s,s);}
    ctx.globalAlpha=1;
    if(v===3||v===4){ctx.setLineDash([t*.35,t*.22]);strokeRect(ctx,t*.3,t*.3,W-t*.6,H-t*.6,t*.12,"#f0dfbf");ctx.setLineDash([]);}
    if(v===7) corners(ctx,W,H,t,"#51351f",v);
  }

  else if(p.family==="geometric"){
    fillBands(ctx,W,H,t,a);ctx.save();ctx.strokeStyle=b;ctx.fillStyle=b;ctx.lineWidth=Math.max(1,t*.15);
    const step=Math.max(10,t*(.65+(v%4)*.2));
    if(v===0||v===7){for(let x=0;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+t,H);ctx.stroke();}}
    else if(v===1) corners(ctx,W,H,t,b,v);
    else if(v===2){for(let x=-H;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+H,H);ctx.stroke();}}
    else if(v===3||v===10){for(let x=step/2;x<W;x+=step)for(let y=step/2;y<H;y+=step){ctx.beginPath();ctx.arc(x,y,t*.12,0,TAU);ctx.fill();}}
    else if(v===4){for(let x=0;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+step*.5,t*.5);ctx.lineTo(x+step,0);ctx.stroke();ctx.beginPath();ctx.moveTo(x,H);ctx.lineTo(x+step*.5,H-t*.5);ctx.lineTo(x+step,H);ctx.stroke();}}
    else if(v===5||v===6){for(let k=0;k<5;k++)strokeRect(ctx,k*t*.34,k*t*.34,W-k*t*.68,H-k*t*.68,t*.08,k%2?a:b);}
    else {strokeRect(ctx,t*.5,t*.5,W-t,H-t,t*.18,b);dotted(ctx,W,H,t,b,1.3);}
    ctx.restore();
  }

  else if(p.family==="decorative"){
    strokeRect(ctx,0,0,W,H,t*.35,a,"round"); corners(ctx,W,H,t,b,v);
    ctx.fillStyle=b; const r=Math.max(2,t*.16), gap=Math.max(12,t*(.8+(v%3)*.2));
    if(v===0||v===2||v===8||v===10) dotted(ctx,W,H,t,b,.95);
    if(v===1||v===3||v===5||v===9){for(let x=t;x<W;x+=gap){ctx.beginPath();ctx.arc(x,t*.48,r,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(x,H-t*.48,r,0,TAU);ctx.fill();}}
    if(v===6||v===7){ctx.font=`${Math.max(10,t*.55)}px serif`;ctx.textAlign="center";ctx.fillText(v===7?"★":"❧",W/2,t*.7);ctx.fillText(v===7?"★":"❧",W/2,H-t*.25);}
  }

  else if(p.family==="color"){
    const pairs=[["#ff416c","#ff4b2b"],["#ff9966","#ff5e62"],["#2193b0","#6dd5ed"],["#134e5e","#71b280"],["#ffafbd","#ffc3a0"],["#00f2fe","#4facfe"],["#8e2de2","#4a00e0"],["#fbc2eb","#a6c1ee"],["#f953c6","#b91d73"],["#00c6ff","#0072ff"],["#12c2e9","#c471ed"],["#111","#777"]];
    const [c1,c2]=pairs[v];ctx.fillStyle=gradient(ctx,W,H,c1,c2,v%2===0);fillBands(ctx,W,H,t,ctx.fillStyle);
    if(v===4||v===7) dotted(ctx,W,H,t,"#ffffffaa",1.2);
    if(v===5||v===10){ctx.shadowColor=c2;ctx.shadowBlur=t*.9;strokeRect(ctx,t*.3,t*.3,W-t*.6,H-t*.6,t*.18,"#fff");}
  }

  else if(p.family==="festive"){
    const pairs=[["#ff7a59","#ffd166"],["#ff4e50","#f9d423"],["#8ec5fc","#e0c3fc"],["#d4fc79","#96e6a1"],["#c31432","#240b36"],["#f7971e","#ffd200"],["#ff758c","#ff7eb3"],["#a8edea","#fed6e3"],["#4facfe","#00f2fe"],["#f6d365","#fda085"],["#ee9ca7","#ffdde1"],["#654ea3","#eaafc8"]];
    const [c1,c2]=pairs[v];strokeRect(ctx,0,0,W,H,t*.55,c1,"round"); const rnd=seed(v+80);
    ctx.fillStyle=c2;
    for(let i=0;i<70;i++){const x=rnd()*W,y=rnd()*H;if(x>t*1.5&&x<W-t*1.5&&y>t*1.5&&y<H-t*1.5)continue;ctx.save();ctx.translate(x,y);ctx.rotate(rnd()*TAU);ctx.fillRect(-t*.08,-t*.18,t*.16,t*.36);ctx.restore();}
    if(v===2||v===3){ctx.fillStyle="#fff";for(let i=0;i<34;i++){ctx.beginPath();ctx.arc(rnd()*W,rnd()*H,t*(.05+rnd()*.12),0,TAU);ctx.fill();}}
  }
  ctx.restore();
}
