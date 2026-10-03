/* Regresión de Marcos: geometría, límites, color, móvil/escritorio y deshacer.
   Ejecutar: node frames/test-marcos.mjs (requiere Playwright y Chromium). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/test'){
    res.setHeader('Content-Type','text/html');
    return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/frames/frames.css">');
  }
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try{
  const page=await browser.newPage();await page.goto(base+'/test');
  const checks=await page.evaluate(async()=>{
    const {FRAME_PRESETS,frameById}=await import('/frames/presets.js');
    const {drawFrame}=await import('/frames/render.js');
    const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
    assert(FRAME_PRESETS.length===138,'Número de modelos');
    assert(new Set(FRAME_PRESETS.map(p=>p.id)).size===138,'Identificadores duplicados');
    let renders=0;
    for(const p of FRAME_PRESETS)for(const [w,h] of [[180,120],[120,180]])for(const width of [1,p.width,24]){
      const t=Math.max(2,Math.round(Math.min(w,h)*width/100));
      const c=document.createElement('canvas');c.width=w+2*t;c.height=h+2*t;const x=c.getContext('2d',{willReadFrequently:true});
      const opts={width,borderPx:t,contentRect:{x:t,y:t,w,h}};
      drawFrame(x,p,c.width,c.height,opts);
      const inner=x.getImageData(t,t,w,h).data;
      for(let i=3;i<inner.length;i+=4)assert(inner[i]===0,p.id+': invadió la foto');
      const first=x.getImageData(0,0,c.width,c.height).data;drawFrame(x,p,c.width,c.height,opts);
      const second=x.getImageData(0,0,c.width,c.height).data;
      assert(first.every((v,i)=>v===second[i]),p.id+': resultado no reproducible');renders++;
    }
    // Cada mando visible debe alterar los píxeles: evita paletas fijas ocultas.
    for(const preset of FRAME_PRESETS){
      const cv=document.createElement('canvas');cv.width=240;cv.height=180;
      const ctx=cv.getContext('2d',{willReadFrequently:true});
      const opts={primary:'#214569',secondary:'#c98532',borderPx:20,contentRect:{x:20,y:20,w:200,h:140}};
      drawFrame(ctx,preset,240,180,opts);const before=ctx.getImageData(0,0,240,180).data;
      for(const key of preset.singleColor?['primary']:['primary','secondary']){
        drawFrame(ctx,preset,240,180,{...opts,[key]:'#e926a8'});
        const after=ctx.getImageData(0,0,240,180).data;
        assert(before.some((v,i)=>v!==after[i]),preset.id+': ignora '+key);
      }
    }
    const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d',{willReadFrequently:true});
    drawFrame(x,frameById('basic-solid'),400,300,{primary:'#25ab73',borderPx:30,contentRect:{x:30,y:30,w:340,h:240}});
    const data=x.getImageData(0,0,400,300).data;
    for(let y=0;y<300;y++)for(let X=0;X<400;X++)if(X<30||X>=370||y<30||y>=270){
      const i=(y*400+X)*4;assert(data[i]===37&&data[i+1]===171&&data[i+2]===115&&data[i+3]===255,'Liso no uniforme');
    }
    for(const id of ['geometric-11','geometric-heart','decorative-09','festive-07']){
      drawFrame(x,frameById(id),400,300,{borderPx:30,contentRect:{x:30,y:30,w:340,h:240}});
      for(const [X,y,w,h] of [[30,5,340,20],[375,30,20,240],[30,275,340,20],[5,30,20,240]]){
        const d=x.getImageData(X,y,w,h).data,colors=new Set();
        for(let i=0;i<d.length;i+=4)colors.add(`${d[i]},${d[i+1]},${d[i+2]}`);
        assert(colors.size>2,id+': falta motivo en un lado');
      }
    }
    return {modelos:FRAME_PRESETS.length,renders};
  });
  console.log('APTO · geometría/color/recorte/reproducibilidad ·',checks);await page.close();
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:820,height:1180}]){
    const mobile=viewport.width<=900,mode=mobile?(viewport.width>600?"tableta":"móvil"):"escritorio";
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/index.html');await p.waitForTimeout(1200);
    await p.evaluate(async()=>{
      const {doc,newDoc}=await import('/js/core/doc.js');newDoc(1800,1200);
      const image=doc.layers[0].ctx.createImageData(1800,1200);for(let i=0;i<image.data.length;i++)image.data[i]=i%4===3?255:(i*37)%256;
      doc.layers[0].ctx.putImageData(image,0,0);window.original=image.data.slice();
      await (await import('/frames/index.js')).openFrames();
    });
    await p.locator('.fr-root').waitFor();
    const color=p.locator(mobile?'.fr-mobile [data-primary]':'.fr-side.right [data-primary]');
    await color.fill('#25ab73');
    if(await p.locator('.fr-root [data-secondary]:visible').count())throw new Error('Liso muestra color secundario');
    // Comprueba el cambio de modo con el editor abierto y vuelve al modo original.
    await p.setViewportSize(mobile?{width:1280,height:800}:{width:390,height:844});
    const other=p.locator(mobile?'.fr-side.right [data-primary]':'.fr-mobile [data-primary]');
    if(await other.inputValue()!=='#25ab73')throw new Error('Color sin sincronizar');
    await p.setViewportSize(viewport);
    const apply=p.locator(mobile?'.fr-mobile-row .primary':'.fr-head .primary');await apply.click();
    const result=await p.evaluate(async()=>{
      const {doc}=await import('/js/core/doc.js');const frame=doc.layers.at(-1),pad=frame.frameMeta.pad;
      const photo=doc.layers[0].ctx.getImageData(pad,pad,1800,1200).data;
      if(!photo.every((v,i)=>v===window.original[i]))throw new Error('Fotografía alterada');
      if(doc.w!==1800+pad*2||doc.h!==1200+pad*2||doc.layers.length!==2)throw new Error('Expansión/capas incorrectas');
      const c=frame.ctx.getImageData(0,0,1,1).data;if(c[0]!==37||c[1]!==171||c[2]!==115)throw new Error('Color aplicado incorrecto');
      const {undo,redo}=await import('/js/core/history.js');undo();
      if(doc.w!==1800||doc.h!==1200||doc.layers.length!==1)throw new Error('Deshacer incorrecto');
      redo();if(doc.layers.length!==2||doc.w!==1800+pad*2)throw new Error('Rehacer incorrecto');
      return {pad,foto:'idéntica',deshacer:'correcto'};
    });
    // Selecciona y aplica un diseño complejo en los dos modos.
    await p.evaluate(async()=>{await (await import('/frames/index.js')).openFrames();});
    if(mobile){await p.locator('.fr-mobile select').first().selectOption('artistic');await p.locator('.fr-mobile select').nth(1).selectOption('artistic-glass');}
    else{await p.locator('[data-category="artistic"]').click();await p.locator('.fr-card').filter({hasText:'Vitral de joyería'}).click();}
    if(await p.locator('.fr-root [data-secondary]:visible').count()!==1)throw new Error('Falta color secundario');
    await p.waitForTimeout(100);
    await p.evaluate(()=>{
      const c=document.querySelector('.fr-stage canvas'),r=c.getBoundingClientRect(),s=c.parentElement.getBoundingClientRect();
      if(r.top<s.top||r.bottom>s.bottom+.5||r.left<s.left||r.right>s.right+.5)throw new Error('Vista previa cortada');
      if(Math.abs(r.width/r.height-c.width/c.height)>.01)throw new Error('Vista previa deformada');
    });
    if(process.env.FRAMES_REVIEW_DIR)await p.screenshot({path:path.join(process.env.FRAMES_REVIEW_DIR,mode+'.png')});
    await p.locator(mobile?'.fr-mobile-row .primary':'.fr-head .primary').click();
    if(errors.length)throw new Error(errors.join('\n'));
    await p.evaluate(async()=>{await (await import('/frames/index.js')).openFrames();});
    if(mobile){await p.locator('.fr-mobile select').first().selectOption('color');await p.locator('.fr-mobile select').nth(1).selectOption('color-11');}
    else{await p.locator('[data-category="color"]').click();await p.locator('.fr-card').filter({hasText:'Electric'}).click();}
    const host=mobile?'.fr-mobile':'.fr-side.right';
    await p.locator(host+' [data-primary]').fill('#12ab34');await p.locator(host+' [data-secondary]').fill('#ef3267');
    await p.evaluate(()=>{
      const cv=document.querySelector('.fr-stage canvas'),ctx=cv.getContext('2d');
      const top=ctx.getImageData(Math.floor(cv.width/2),2,1,1).data,bottom=ctx.getImageData(Math.floor(cv.width/2),cv.height-3,1,1).data;
      if(top[1]<top[0]||bottom[0]<bottom[1])throw new Error('Electric ignora los colores');
    });
    if(mobile){
      await p.evaluate(()=>{
        window.testViewport=new EventTarget();Object.assign(window.testViewport,{width:innerWidth,height:innerHeight-110,offsetTop:0,offsetLeft:0,scale:1});
        window.realViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:window.testViewport});
        document.querySelector('.fr-mobile-row .fr-btn').click();
      });
      await p.evaluate(async()=>{await (await import('/frames/index.js')).openFrames();});
      await p.evaluate(()=>{window.testViewport.height-=60;window.testViewport.dispatchEvent(new Event('resize'));});
      await p.waitForTimeout(100);
      await p.evaluate(()=>{
        const root=document.querySelector('.fr-root').getBoundingClientRect(),row=document.querySelector('.fr-mobile-row').getBoundingClientRect();
        if(root.bottom>window.testViewport.height+.5||row.bottom>root.bottom+.5)throw new Error('Controles tapados al reducir el área visible');
        document.querySelector('.fr-mobile-row .fr-btn').click();
        Object.defineProperty(window,'visualViewport',{configurable:true,value:window.realViewport});
      });
    }
    console.log('APTO · '+mode+' · colores, zona visible y',result);await context.close();
  }
}finally{await browser.close();server.close();}
