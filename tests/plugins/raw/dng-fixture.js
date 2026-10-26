// Small uncompressed Bayer DNG fixture, generated locally for decoder tests.
export function dngFixture(){
  const w=256,h=192,entries=[];
  const tag=(id,type,values)=>entries.push({id,type,values});
  tag(254,4,[0]);tag(256,4,[w]);tag(257,4,[h]);tag(258,3,[16]);tag(259,3,[1]);tag(262,3,[32803]);
  tag(271,2,'Realify\0');tag(272,2,'Test camera\0');tag(273,4,[0]);tag(274,3,[1]);tag(277,3,[1]);tag(278,4,[h]);tag(279,4,[w*h*2]);tag(284,3,[1]);
  tag(33421,3,[2,2]);tag(33422,1,[0,1,1,2]);tag(50706,1,[1,4,0,0]);tag(50707,1,[1,1,0,0]);tag(50708,2,'Realify synthetic RAW\0');
  tag(50710,1,[0,1,2]);tag(50711,3,[1]);tag(50713,3,[1,1]);tag(50714,5,[[64,1]]);tag(50717,4,[65535]);
  tag(50719,4,[0,0]);tag(50720,4,[w,h]);tag(50721,10,[[1,1],[0,1],[0,1],[0,1],[1,1],[0,1],[0,1],[0,1],[1,1]]);
  tag(50728,5,[[1,1],[1,1],[1,1]]);tag(50778,3,[21]);tag(50829,4,[0,0,h,w]);
  entries.sort((a,b)=>a.id-b.id);
  const sizes={1:1,2:1,3:2,4:4,5:8,10:8};let offset=8+2+entries.length*12+4;
  for(const e of entries){e.bytes=e.values.length*sizes[e.type];if(e.bytes>4){e.offset=offset;offset+=(e.bytes+1)&~1;}}
  entries.find(e=>e.id===273).values=[offset];
  const bytes=new Uint8Array(offset+w*h*2),view=new DataView(bytes.buffer);
  bytes.set([73,73,42,0,8,0,0,0]);view.setUint16(8,entries.length,true);
  entries.forEach((e,index)=>{
    const p=10+12*index;view.setUint16(p,e.id,true);view.setUint16(p+2,e.type,true);view.setUint32(p+4,e.values.length,true);
    const start=e.bytes>4?e.offset:p+8;if(e.bytes>4)view.setUint32(p+8,e.offset,true);
    [...e.values].forEach((v,i)=>{
      const at=start+i*sizes[e.type];
      if(e.type===1||e.type===2)view.setUint8(at,e.type===2?v.charCodeAt(0):v);
      else if(e.type===3)view.setUint16(at,v,true);
      else if(e.type===4)view.setUint32(at,v,true);
      else {view.setInt32(at,v[0],true);view.setInt32(at+4,v[1],true);}
    });
  });
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)view.setUint16(offset+(y*w+x)*2,Math.round(128+(x/(w-1))**2*60000),true);
  return bytes;
}
