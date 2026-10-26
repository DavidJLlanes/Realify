/* Zoom de la vista previa: los gestos nunca modifican la foto ni el marco aplicado. */
export function createFrameViewport(stage,canvas,{onZoom,onChange}={}){
  let zoom=1,x=0,y=0,fitW=1,fitH=1;
  const points=new Map();
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function fit(){
    const css=getComputedStyle(stage);
    const w=Math.max(1,stage.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight));
    const h=Math.max(1,stage.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom));
    const scale=Math.min(w/canvas.width,h/canvas.height);
    fitW=canvas.width*scale;fitH=canvas.height*scale;
    canvas.style.width=fitW+'px';canvas.style.height=fitH+'px';
    x=clamp(x,-Math.max(0,(fitW*zoom-w)/2),Math.max(0,(fitW*zoom-w)/2));
    y=clamp(y,-Math.max(0,(fitH*zoom-h)/2),Math.max(0,(fitH*zoom-h)/2));
    canvas.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${zoom})`;
    stage.classList.toggle('fr-zoomed',zoom>1);
    stage.classList.toggle('fr-dragging',points.size>0&&zoom>1);
    onChange?.(zoom);
  }
  function local(clientX,clientY){
    const r=stage.getBoundingClientRect();return {x:clientX-r.left-r.width/2,y:clientY-r.top-r.height/2};
  }
  function magnify(value,from,to=from){
    const next=clamp(value,1,8),ratio=next/zoom,changed=next!==zoom;
    x=to.x-(from.x-x)*ratio;y=to.y-(from.y-y)*ratio;zoom=next;
    fit();if(changed)onZoom?.(zoom);
  }
  function wheel(e){
    e.preventDefault();
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);
    magnify(zoom*Math.exp(-clamp(delta,-240,240)*.0025),local(e.clientX,e.clientY));
  }
  function pair(){
    const [a,b]=[...points.values()];
    return {center:local((a.x+b.x)/2,(a.y+b.y)/2),distance:Math.hypot(a.x-b.x,a.y-b.y)};
  }
  function down(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    stage.setPointerCapture(e.pointerId);fit();
  }
  function move(e){
    if(!points.has(e.pointerId))return;
    e.preventDefault();const previous=points.get(e.pointerId),before=points.size>=2?pair():null;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(before){const after=pair();if(before.distance>0)magnify(zoom*after.distance/before.distance,before.center,after.center);}
    else{x+=e.clientX-previous.x;y+=e.clientY-previous.y;fit();}
  }
  function up(e){points.delete(e.pointerId);fit();}
  function reset(){points.clear();zoom=1;x=y=0;fit();onZoom?.(zoom);}
  stage.addEventListener('wheel',wheel,{passive:false});
  stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,up);
  stage.addEventListener('dblclick',reset);
  return {fit,reset,get zoom(){return zoom;},destroy(){
    stage.removeEventListener('wheel',wheel);stage.removeEventListener('pointerdown',down);
    stage.removeEventListener('pointermove',move);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.removeEventListener(name,up);
    stage.removeEventListener('dblclick',reset);points.clear();
  }};
}
