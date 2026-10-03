/* Motivos vectoriales y bandas con esquinas a inglete del plugin Marcos. */

export function diamondPath(c, size){
  c.beginPath();
  c.moveTo(0,-size/2);c.lineTo(size/2,0);
  c.lineTo(0,size/2);c.lineTo(-size/2,0);c.closePath();
}

export function heartPath(c, size){
  // Curvas simétricas: el corazón no depende de una fuente ni de un emoji.
  c.beginPath();c.moveTo(0,-size*.18);
  c.bezierCurveTo(-size*.35,-size*.58,-size*.65,-size*.2,-size*.38,size*.1);
  c.bezierCurveTo(-size*.23,size*.28,-size*.06,size*.42,0,size*.5);
  c.bezierCurveTo(size*.06,size*.42,size*.23,size*.28,size*.38,size*.1);
  c.bezierCurveTo(size*.65,-size*.2,size*.35,-size*.58,0,-size*.18);
  c.closePath();
}

export function borderMotifs(c,W,H,t,spacing,draw){
  const edges=[
    [t,t*.5,W-2*t,0],
    [W-t*.5,t,H-2*t,Math.PI/2],
    [W-t,H-t*.5,W-2*t,Math.PI],
    [t*.5,H-t,H-2*t,-Math.PI/2]
  ];
  for(const [x,y,length,angle] of edges){
    const count=Math.max(1,Math.round(length/Math.max(3,t*spacing)));
    const step=length/count;
    for(let i=0;i<count;i++){
      const distance=(i+.5)*step;
      c.save();c.translate(x+Math.cos(angle)*distance,y+Math.sin(angle)*distance);
      c.rotate(angle);draw(c,t,i);c.restore();
    }
  }
}

export function borderSides(c,W,H,t,draw){
  const edges=[[0,0,W,0],[W,0,H,Math.PI/2],[W,H,W,Math.PI],[0,H,H,-Math.PI/2]];
  edges.forEach(([x,y,length,angle],side)=>{
    c.save();c.translate(x,y);c.rotate(angle);
    // Cada banda tiene su propio inglete: los patrones no se pisan en las esquinas.
    c.beginPath();c.moveTo(0,0);c.lineTo(length,0);
    c.lineTo(length-t,t);c.lineTo(t,t);c.closePath();c.clip();
    draw(c,length,t,side);c.restore();
  });
}

export function mixColor(a,b,amount){
  const parse=hex=>{
    const s=hex.slice(1);const value=s.length===3?s.split('').map(x=>x+x).join(''):s;
    return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16));
  };
  const x=parse(a),y=parse(b);
  return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*amount).toString(16).padStart(2,'0')).join('');
}

export function seededRandom(seed){
  let value=seed>>>0;
  return ()=>{
    value=Math.imul(value^(value>>>16),0x45d9f3b);
    value=Math.imul(value^(value>>>16),0x45d9f3b);
    value=(value^(value>>>16))>>>0;
    return value/4294967296;
  };
}
