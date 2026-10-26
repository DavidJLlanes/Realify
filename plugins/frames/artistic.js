/* Marcos de autor: materiales, relieve y geometrías propios, sin imágenes externas.
   render.js mantiene el recorte exterior durante todas estas operaciones. */
import { borderSides, borderMotifs, mixColor, seededRandom } from './geometry.js';

const TAU=Math.PI*2;
const line=(c,W,H,t,inset,color,width=.025)=>{
  c.strokeStyle=color;c.lineWidth=Math.max(.5,t*width);
  c.strokeRect(t*inset,t*inset,W-2*t*inset,H-2*t*inset);
};
const polygon=(c,points,color)=>{
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();c.fillStyle=color;c.fill();
};
const gradient=(c,length,t,colors,vertical=false)=>{
  const g=c.createLinearGradient(0,0,vertical?0:length,vertical?t:0);
  colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g;
};

function aurora(c,W,H,t,a,b){
  c.fillStyle=mixColor(a,'#050b18',.72);c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const fill=gradient(ctx,L,T,[mixColor(a,'#000000',.65),mixColor(a,b,.5),mixColor(b,'#000000',.4)]);
    ctx.fillStyle=fill;ctx.fillRect(0,0,L,T);
    for(let k=0;k<15;k++){
      ctx.beginPath();
      for(let s=0;s<=100;s++){
        const x=L*s/100,y=T*(.12+k*.049)+Math.sin(s*.065+side+k*.21)*T*.13+Math.sin(s*.16+k*.13)*T*.07;
        s?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.strokeStyle=mixColor(a,b,k/14);ctx.lineWidth=T*(k%4===0?.025:.013);
      ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=T*.08;ctx.stroke();
    }
  });
  line(c,W,H,t,.93,mixColor(b,'#ffffff',.6),.018);
}

function prism(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T)=>{
    const count=Math.max(2,Math.ceil(L/(T*1.4))),step=L/count;
    for(let i=0;i<count;i++){
      const x=i*step,m=x+step*.5;
      polygon(ctx,[[x,0],[x+step,0],[m,T*.52]],mixColor(a,'#ffffff',.45));
      polygon(ctx,[[x,0],[m,T*.52],[x,T]],mixColor(a,b,.28));
      polygon(ctx,[[x+step,0],[x+step,T],[m,T*.52]],mixColor(b,'#000000',.3));
      polygon(ctx,[[x,T],[m,T*.52],[x+step,T]],mixColor(a,b,.78));
      ctx.strokeStyle='#ffffff66';ctx.lineWidth=T*.012;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(m,T*.52);ctx.lineTo(x+step,T);ctx.stroke();
    }
  });
  line(c,W,H,t,.95,'#ffffffaa',.02);
}

function eclipse(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const colors=[a,a,mixColor(a,b,.5),mixColor(b,'#ffffff',.6),b,mixColor(a,b,.25),a,a];
    ctx.fillStyle=gradient(ctx,L,T,side%2?colors.slice().reverse():colors,true);ctx.fillRect(0,0,L,T);
    ctx.strokeStyle=mixColor(a,b,.65);ctx.lineWidth=T*.008;
    for(let k=0;k<7;k++){ctx.beginPath();ctx.moveTo(0,T*(.49+k*.025));ctx.lineTo(L,T*(.49+k*.025));ctx.stroke();}
  });
  line(c,W,H,t,.88,b,.024);line(c,W,H,t,.96,mixColor(a,b,.3),.04);
}

function kintsugi(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const random=seededRandom(730+side),count=Math.max(3,Math.ceil(L/(T*1.7)));
    for(let k=0;k<count;k++){
      const center=L*(k+.5)/count;const pts=[];
      for(let i=0;i<7;i++)pts.push([center+(random()-.5)*T*.5,T*i/6]);
      for(const [color,width] of [[mixColor(b,'#423011',.6),.055],[b,.031],[mixColor(b,'#ffffff',.55),.009]]){
        ctx.strokeStyle=color;ctx.lineWidth=T*width;ctx.lineJoin='round';ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
      }
      ctx.strokeStyle=b;ctx.lineWidth=T*.022;ctx.beginPath();ctx.moveTo(...pts[3]);ctx.lineTo(center+T*.5,T*.36);ctx.lineTo(center+T*.8,T*.16);ctx.stroke();
    }
  });
  line(c,W,H,t,.94,mixColor(a,b,.7),.014);
}

function topography(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    for(let k=-5;k<26;k++){
      ctx.beginPath();
      for(let i=0;i<=120;i++){
        const x=L*i/120,y=T*(k*.06+.22*Math.sin(i*.08+side)+.10*Math.sin(i*.19+k*.05));
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.strokeStyle=mixColor(a,b,k%5===0?.95:.52);ctx.lineWidth=T*(k%5===0?.018:.008);ctx.stroke();
    }
  });
  line(c,W,H,t,.96,b,.017);
}

function arcades(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T)=>{
    const count=Math.max(2,Math.round(L/(T*1.15))),step=L/count;
    for(let i=0;i<count;i++)for(let k=0;k<4;k++){
      const cx=(i+.5)*step,r=step*(.40-k*.07);
      ctx.beginPath();ctx.moveTo(cx-r,T);ctx.lineTo(cx-r,T*.48);
      ctx.bezierCurveTo(cx-r,T*.05,cx+r,T*.05,cx+r,T*.48);ctx.lineTo(cx+r,T);
      ctx.strokeStyle=mixColor(a,b,k===0?1:.6);ctx.lineWidth=T*(k===0?.026:.014);ctx.stroke();
    }
  });
  line(c,W,H,t,.08,b,.03);line(c,W,H,t,.96,b,.027);
}

function glass(c,W,H,t,a,b){
  c.fillStyle='#17232a';c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const random=seededRandom(210+side),count=Math.max(3,Math.ceil(L/(T*.8))),step=L/count;
    const colors=[a,b,mixColor(a,b,.4),mixColor(a,'#f6d7ad',.55),mixColor(b,'#071625',.35)];
    for(let i=0;i<count;i++){
      const x=i*step,y=T*(.3+random()*.4),center=x+step*(.35+random()*.3);
      const shapes=[[[x,0],[x+step,0],[center,y]],[[x,0],[center,y],[x,T]],[[x+step,0],[x+step,T],[center,y]],[[x,T],[center,y],[x+step,T]]];
      shapes.forEach((points,k)=>{
        polygon(ctx,points,colors[(i+k+side)%colors.length]);ctx.strokeStyle='#182226';ctx.lineWidth=Math.max(.6,T*.023);ctx.stroke();
      });
      ctx.strokeStyle='#ffffff66';ctx.lineWidth=T*.012;ctx.beginPath();ctx.moveTo(x+step*.1,T*.08);ctx.lineTo(center,y-T*.055);ctx.stroke();
    }
  });
  line(c,W,H,t,.96,'#182226',.05);
}

function origami(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T)=>{
    const count=Math.max(2,Math.ceil(L/T)),step=L/count;
    for(let i=0;i<count;i++){
      const x=i*step;
      polygon(ctx,[[x,0],[x+step,0],[x+step*.25,T*.55]],mixColor(a,'#ffffff',.35));
      polygon(ctx,[[x,0],[x+step*.25,T*.55],[x,T]],mixColor(a,'#000000',.17));
      polygon(ctx,[[x+step,0],[x+step,T],[x+step*.25,T*.55]],b);
      polygon(ctx,[[x,T],[x+step*.25,T*.55],[x+step,T]],mixColor(b,'#000000',.3));
      ctx.strokeStyle='#ffffff80';ctx.lineWidth=T*.014;ctx.beginPath();ctx.moveTo(x+step*.25,T*.55);ctx.lineTo(x+step,0);ctx.stroke();
    }
  });
}

function constellation(c,W,H,t,a,b){
  c.fillStyle=mixColor(a,'#02040d',.3);c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const random=seededRandom(481+side),count=Math.max(3,Math.round(L/(T*.9))),points=[];
    for(let i=0;i<count;i++)points.push([L*(i+.5)/count,T*(.26+random()*.48)]);
    ctx.strokeStyle=mixColor(a,b,.5);ctx.lineWidth=T*.015;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    points.forEach(([x,y],i)=>{
      ctx.fillStyle=b;ctx.shadowColor=b;ctx.shadowBlur=T*.10;ctx.beginPath();ctx.arc(x,y,T*(i%3?.022:.045),0,TAU);ctx.fill();
      if(i%3===0){ctx.strokeStyle=mixColor(b,'#ffffff',.55);ctx.lineWidth=T*.012;ctx.beginPath();ctx.moveTo(x-T*.095,y);ctx.lineTo(x+T*.095,y);ctx.moveTo(x,y-T*.095);ctx.lineTo(x,y+T*.095);ctx.stroke();}
    });
    ctx.shadowBlur=0;
    for(let i=0;i<count*5;i++){ctx.globalAlpha=.3+random()*.6;ctx.fillStyle=b;ctx.fillRect(random()*L,random()*T,T*.012,T*.012);}
    ctx.globalAlpha=1;
  });
  line(c,W,H,t,.95,mixColor(a,b,.6),.018);
}

function moire(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    for(let family=0;family<2;family++)for(let k=-12;k<38;k++){
      ctx.beginPath();
      for(let i=0;i<=90;i++){
        const x=L*i/90,y=T*(k*.044+.17*Math.sin(i*(family?.085:.075)+side+family*.8)+family*.014*i);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.strokeStyle=family?mixColor(a,b,.64):b;ctx.lineWidth=T*.009;ctx.stroke();
    }
  });
  line(c,W,H,t,.95,b,.022);
}

function ripple(c,W,H,t,a,b){
  const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,a);g.addColorStop(.5,b);g.addColorStop(1,a);
  c.fillStyle=g;c.fillRect(0,0,W,H);
  for(let k=0;k<22;k++){
    const inset=t*(.04+k*.043);c.beginPath();
    c.roundRect(inset,inset,W-inset*2,H-inset*2,Math.min(t*.8,W*.1,H*.1));
    c.strokeStyle=k%3===0?mixColor(b,'#ffffff',.7):mixColor(a,'#000000',.3);c.lineWidth=t*(k%3===0?.02:.009);c.stroke();
  }
}

function circuit(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const count=Math.max(3,Math.round(L/(T*.7))),step=L/count;
    for(let i=0;i<count;i++){
      const x=i*step,y=T*(.23+((i+side)%3)*.22),dest=x+step*.84;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+step*.3,y);ctx.lineTo(x+step*.52,T-y);ctx.lineTo(dest,T-y);
      ctx.strokeStyle=mixColor(a,b,.7);ctx.lineWidth=T*.024;ctx.stroke();
      for(const [cx,cy] of [[x,y],[dest,T-y]]){ctx.beginPath();ctx.arc(cx,cy,T*.042,0,TAU);ctx.fillStyle=b;ctx.fill();ctx.beginPath();ctx.arc(cx,cy,T*.021,0,TAU);ctx.fillStyle=a;ctx.fill();}
      if(i%3===1){ctx.fillStyle=mixColor(a,'#000000',.4);ctx.fillRect(x+step*.12,T*.35,step*.26,T*.3);ctx.strokeStyle=b;ctx.lineWidth=T*.012;ctx.strokeRect(x+step*.12,T*.35,step*.26,T*.3);}
    }
  });
  line(c,W,H,t,.95,b,.017);
}

function hologram(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const colors=[a,mixColor(a,'#ffffff',.45),b,'#ffe0b2',mixColor(b,'#ffffff',.7),a];
    ctx.fillStyle=gradient(ctx,L,T,side%2?colors.slice().reverse():colors);ctx.fillRect(0,0,L,T);
    ctx.fillStyle=gradient(ctx,L,T,['#ffffff70','#ffffff00','#00000040','#ffffff90','#ffffff00'],true);ctx.fillRect(0,0,L,T);
    ctx.strokeStyle='#ffffff55';ctx.lineWidth=T*.01;
    for(let x=-T;x<L+T;x+=T*.16){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+T*.6,T);ctx.stroke();}
  });
  line(c,W,H,t,.90,'#202431',.075);line(c,W,H,t,.97,'#ffffffbb',.018);
}

function marble(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderSides(c,W,H,t,(ctx,L,T,side)=>{
    const random=seededRandom(945+side);
    for(let i=0;i<12;i++){
      const y=random()*T;ctx.beginPath();ctx.moveTo(-T,y);
      ctx.bezierCurveTo(L*.25,y-T*.4+random()*T,L*.65,y+T*.7,L+T,y-T*.6);
      ctx.strokeStyle=mixColor(a,b,.14+random()*.65);ctx.lineWidth=T*(.009+random()*.028);
      ctx.shadowColor=b;ctx.shadowBlur=T*.08;ctx.stroke();
    }
  });
  line(c,W,H,t,.12,mixColor(a,'#ffffff',.6),.03);line(c,W,H,t,.92,mixColor(a,b,.6),.022);
}

function botanical(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  borderMotifs(c,W,H,t,1.15,(ctx,T,i)=>{
    ctx.rotate(i%2?.18:-.18);ctx.strokeStyle=b;ctx.lineWidth=T*.018;
    ctx.beginPath();ctx.moveTo(-T*.5,0);ctx.bezierCurveTo(-T*.1,-T*.08,T*.2,T*.05,T*.5,0);ctx.stroke();
    for(const sign of [-1,1])for(let k=0;k<2;k++){
      const x=(k-.6)*T*.28;ctx.beginPath();ctx.moveTo(x,0);
      ctx.bezierCurveTo(x-T*.03,sign*T*.23,x+T*.2,sign*T*.34,x+T*.26,sign*T*.30);
      ctx.bezierCurveTo(x+T*.25,sign*T*.09,x+T*.15,sign*T*.04,x,0);
      ctx.fillStyle=mixColor(a,b,sign===1?.85:.52);ctx.fill();
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+T*.21,sign*T*.25);ctx.stroke();
    }
  });
  line(c,W,H,t,.08,mixColor(a,b,.6),.02);line(c,W,H,t,.95,b,.025);
}

function deco(c,W,H,t,a,b){
  c.fillStyle=a;c.fillRect(0,0,W,H);
  line(c,W,H,t,.12,b,.018);line(c,W,H,t,.32,b,.023);line(c,W,H,t,.88,b,.03);
  for(const [x,y,angle] of [[t,t,0],[W-t,t,Math.PI/2],[W-t,H-t,Math.PI],[t,H-t,-Math.PI/2]]){
    c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=b;c.lineWidth=t*.016;
    for(let k=0;k<12;k++){
      const radius=t*(.2+k*.095);c.beginPath();c.arc(0,0,radius,Math.PI,Math.PI*1.5);c.stroke();
    }
    for(let k=0;k<=6;k++){const angle=Math.PI+k*Math.PI/12;c.beginPath();c.moveTo(Math.cos(angle)*t*.2,Math.sin(angle)*t*.2);c.lineTo(Math.cos(angle)*t*1.25,Math.sin(angle)*t*1.25);c.stroke();}
    c.restore();
  }
}

const styles={aurora,prism,eclipse,kintsugi,topography,arcades,glass,origami,constellation,moire,ripple,circuit,hologram,marble,botanical,deco};
export function drawArtisticFrame(c,style,W,H,t,a,b){
  const render=styles[style];
  if(!render)throw new Error('Modelo de marco desconocido: '+style);
  render(c,W,H,t,a,b);
}
