// Full application regression: developer acceptance -> mobile editor.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.RAW_PLAYWRIGHT).href);
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root))throw Error('Invalid path');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    res.end(await readFile(file));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.RAW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{
    const {openDeveloper}=await import('/raw/ui.js');
    const {newDoc}=await import('/js/core/doc.js');
    const source={width:6000,height:4000,channels:3,linear:true,scale:65535,data:new Uint16Array(6000*4000*3).fill(20000)};
    const link=document.createElement('link');link.rel='stylesheet';link.href='/raw/raw.css';document.head.append(link);
    // Count full-resolution DOM canvases allocated after the source exists.
    // One is the accepted result; comparison must allocate no others.
    window.largeCanvases=new Set();
    for(const key of ['width','height']){
      const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);
      Object.defineProperty(HTMLCanvasElement.prototype,key,{...descriptor,set(value){
        descriptor.set.call(this,value);
        if(this.width*this.height>=24000000)window.largeCanvases.add(this);
      }});
    }
    window.accepted=false;
    openDeveloper({source,initial:{exposure:.5,sharpen:60,noise:30,colorNoise:40,clarity:20,texture:25,grain:30,ca:40,vignette:20},onAccept:result=>{
      newDoc(result.width,result.height,{image:result,adoptImage:true,source:{raw:true}});
      window.accepted=true;
    }});
  });
  await page.locator('#rawDeveloper [data-action=accept]').click();
  await page.waitForFunction(()=>window.accepted&&!document.querySelector('#rawDeveloper'),null,{timeout:60000});
  assert.equal(await page.evaluate(()=>window.largeCanvases.size),1,'Acceptance must not allocate full-sized comparison composites');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.compositor-tiles canvas').count(),0,'Mobile RAW must not create hundreds of GPU tile surfaces');
  const surface=await page.locator('#board > canvas').first().evaluate(c=>({w:c.width,h:c.height}));
  assert.ok(surface.w*surface.h<=2_010_000,'Display surface must stay bounded');
  await page.evaluate(async()=>{const {setTool}=await import('/js/editor/tools.js');setTool('compare');});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.largeCanvases.size),1,'Comparison must not flatten tiled documents');
  const session=await page.context().newCDPSession(page);
  const box=await page.locator('#stage').boundingBox();
  const x=box.x+box.width/2,y=box.y+box.height/2;
  const before=await page.evaluate(async()=>({...((await import('/js/editor/view.js')).view)}));
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y,id:1},{x:x+60,y,id:2}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const zoomed=await page.evaluate(async()=>({...((await import('/js/editor/view.js')).view)}));
  assert.ok(zoomed.zoom>before.zoom*1.5,'Pinch zoom must work after acceptance');
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+25,y:y+20,id:3}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const moved=await page.evaluate(async()=>({...((await import('/js/editor/view.js')).view)}));
  assert.ok(Math.abs(moved.x-zoomed.x)>10,'One-finger pan must work');
  const pixels=await page.evaluate(async()=>{
    const {doc}=await import('/js/core/doc.js');
    const {pickColor}=await import('/js/editor/compositor.js');
    const original=[...doc.layers[0].ctx.getImageData(3000,2000,1,1).data];
    const picked=pickColor(3000,2000);
    return {size:[doc.w,doc.h],original,picked:[picked.r,picked.g,picked.b,picked.a]};
  });
  assert.deepEqual(pixels.size,[6000,4000],'Original resolution must remain intact');
  assert.deepEqual(pixels.picked,pixels.original,'Colour picker must sample original pixels');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,largeCanvases:await page.evaluate(()=>window.largeCanvases.size),pinch:true,pan:true}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
