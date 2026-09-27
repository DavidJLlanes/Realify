// Run with RAW_PLAYWRIGHT pointing to the installed Playwright module.
// No photographs or external servers: fixtures are generated in the browser.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const { chromium }=await import(pathToFileURL(process.env.RAW_PLAYWRIGHT).href);
const root=fileURLToPath(new URL("../../",import.meta.url));
const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/raw/raw.css"><style>body{margin:0}#host{width:100vw;height:100vh}canvas{max-width:100%;max-height:100%}</style><div id="toast"></div><div id="stMsg"></div><div id="host"><canvas></canvas></div>';
const server=createServer(async(req,res)=>{
  try{
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(req.url==="/test.html"){res.setHeader("Content-Type","text/html");res.end(html);return;}
    const filename=path.resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));
    if(!filename.startsWith(root))throw new Error("Outside project");
    res.setHeader("Content-Type",filename.endsWith(".css")?"text/css":filename.endsWith(".wasm")?"application/wasm":"application/javascript");
    res.end(await readFile(filename));
  }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await chromium.launch({executablePath:process.env.RAW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on("pageerror",error=>errors.push(error.message));
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/test.html`);
  const result=await page.evaluate(async()=>{
    const {GPUPreview}=await import('/raw/gpu-preview.js');
    const {Preview}=await import('/raw/preview.js');
    const {RenderWorker}=await import('/raw/render-client.js');
    const {renderPhoto}=await import('/raw/pipeline.js');
    const {defaults}=await import('/raw/state.js');
    const source=document.createElement('canvas');source.width=320;source.height=240;
    const ctx=source.getContext('2d',{willReadFrequently:true}),data=ctx.createImageData(320,240);
    for(let y=0;y<240;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4;data.data[i]=x*255/319;data.data[i+1]=y*255/239;data.data[i+2]=(x+y)%256;data.data[i+3]=255;}
    ctx.putImageData(data,0,0);
    const canvas=document.querySelector('canvas'),gpu=new GPUPreview(canvas);gpu.setSource(source);
    const sample=document.createElement('canvas');sample.width=320;sample.height=240;const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
    const cases=[{}, {exposure:1.2,temperature:30,tint:-20,highlights:-40,shadows:30,contrast:20}, {whites:30,blacks:-40,vibrance:60,saturation:20,hue:80,dehaze:30,vignette:30}, {noise:40,colorNoise:20,sharpen:60,clarity:25,texture:10}, {grain:80,exposure:.7}, {ca:70,wb:'tungsten'}, {colorNoise:100}, {noise:100}];
    const differences=[];
    for(const values of cases){
      const settings={...defaults(),...values};gpu.render(settings);gpu.gl.finish();
      sampleCtx.drawImage(canvas,0,0);const actual=sampleCtx.getImageData(0,0,320,240).data;
      const expected=renderPhoto(source,settings).getContext('2d').getImageData(0,0,320,240).data;
      let max=0,total=0;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-expected[i]);max=Math.max(max,d);total+=d;}
      differences.push({max,mean:total/actual.length});
    }
    gpu.render({...defaults(),exposure:3},true);gpu.gl.finish();sampleCtx.drawImage(canvas,0,0);
    const original=sampleCtx.getImageData(0,0,320,240).data;
    const originalExact=original.every((v,i)=>v===data.data[i]);gpu.dispose();
    const {toneLightness,buildToneLUT,toneGain}=await import('/raw/tone.js');
    let minSlope=1;
    for(let mask=0;mask<64;mask++){
      const s=defaults();['contrast','shadows','highlights','whites','blacks','dehaze'].forEach((key,i)=>s[key]=(mask&(1<<i))?100:-100);
      const lut=buildToneLUT(s);let prev=0;for(let i=1;i<=1024;i++){const linear=(i/1024)**2,value=linear*toneGain(linear,lut);minSlope=Math.min(minSlope,value-prev);prev=value;}
    }
    const curveMetrics={minSlope,neutral:toneLightness(.5,defaults()),contrastMid:toneLightness(.5,{...defaults(),contrast:100}),shadow:toneLightness(.2,{...defaults(),shadows:100}),highlight:toneLightness(.8,{...defaults(),highlights:-100}),highlightUp:toneLightness(.8,{...defaults(),highlights:100}),smallContrast:toneLightness(.2,{...defaults(),contrast:1})};
    const noiseChart=document.createElement('canvas');noiseChart.width=128;noiseChart.height=64;
    const nx=noiseChart.getContext('2d',{willReadFrequently:true}),noisy=nx.createImageData(128,64);
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){
      const i=(y*128+x)*4,n=(((x*7919+y*104729)%29)-14);
      if(x<64){noisy.data[i]=128+n;noisy.data[i+2]=128-n;noisy.data[i+1]=(128-.2126*(128+n)-.0722*(128-n))/.7152;}
      else noisy.data[i]=noisy.data[i+1]=noisy.data[i+2]=128+n;
      noisy.data[i+3]=255;
    }
    nx.putImageData(noisy,0,0);
    const cleaned=renderPhoto(noiseChart,{...defaults(),colorNoise:100,noise:100}).getContext('2d').getImageData(0,0,128,64).data;
    let beforeChroma=0,afterChroma=0,beforeNoise=0,afterNoise=0,lumaError=0,count=0;
    for(let y=4;y<60;y++)for(let x=4;x<60;x++){
      const i=(y*128+x)*4,j=(y*128+x+64)*4;
      beforeChroma+=(noisy.data[i]-noisy.data[i+2])**2;afterChroma+=(cleaned[i]-cleaned[i+2])**2;
      beforeNoise+=(noisy.data[j]-128)**2;afterNoise+=(cleaned[j]-128)**2;
      lumaError+=Math.abs(.2126*(cleaned[i]-noisy.data[i])+.7152*(cleaned[i+1]-noisy.data[i+1])+.0722*(cleaned[i+2]-noisy.data[i+2]));count++;
    }
    const noiseMetrics={chromaRatio:Math.sqrt(afterChroma/beforeChroma),noiseRatio:Math.sqrt(afterNoise/beforeNoise),lumaError:lumaError/count};
    // Exercise the real bundled LibRaw decoder with a generated Bayer DNG.
    const {dngFixture}=await import('/raw/tests/dng-fixture.js');const {RawDecoder}=await import('/raw/decoder.js');
    const decoder=await RawDecoder.open(new File([dngFixture()],'quality-test.dng'),defaults());
    const rawInfo={bits:decoder.source.data.BYTES_PER_ELEMENT*8,linear:decoder.source.linear,values:new Set(decoder.source.data).size};
    const {resizeLinear}=await import('/raw/source.js');const rawProxy=resizeLinear(decoder.source,256,192);
    const rawCanvas=document.createElement('canvas'),rawGpu=new GPUPreview(rawCanvas);rawGpu.setSource(rawProxy);
    const rawSettings={...defaults(),shadows:40,highlights:-50,contrast:20,ca:25};rawGpu.render(rawSettings);rawGpu.gl.finish();
    const rawSample=document.createElement('canvas');rawSample.width=256;rawSample.height=192;
    rawSample.getContext('2d').drawImage(rawCanvas,0,0);
    const rawPixels=rawSample.getContext('2d').getImageData(0,0,256,192).data;
    const cpuRaw=renderPhoto(rawProxy,rawSettings).getContext('2d').getImageData(0,0,256,192).data;
    rawInfo.maxDifference=rawPixels.reduce((max,v,i)=>Math.max(max,Math.abs(v-cpuRaw[i])),0);
    const topLeft=rawPixels.slice(0,3),bottomLeft=rawPixels.slice((191*256)*4,(191*256)*4+3);
    rawInfo.orientationProbe={topLeft:[...topLeft],bottomLeft:[...bottomLeft]};
    const orientationCanvas=document.createElement('canvas'),orientationGpu=new GPUPreview(orientationCanvas);
    const orientationSource={width:4,height:3,channels:4,linear:true,scale:1,data:new Float32Array([
      1,0,0,1, .8,0,0,1, .6,0,0,1, .4,0,0,1,
      .1,1,0,1, .1,.8,0,1, .1,.6,0,1, .1,.4,0,1,
      0,0,1,1, .2,0,1,1, .4,0,1,1, .6,0,1,1])};
    orientationGpu.setSource(orientationSource);orientationGpu.render(defaults());orientationGpu.gl.finish();
    const orientationCheck=document.createElement('canvas');orientationCheck.width=4;orientationCheck.height=3;orientationCheck.getContext('2d').drawImage(orientationCanvas,0,0);
    const orientationData=orientationCheck.getContext('2d').getImageData(0,0,4,3).data;
    rawInfo.gpuOrientation={topLeft:[orientationData[0],orientationData[1],orientationData[2]],bottomLeft:[orientationData[32],orientationData[33],orientationData[34]]};orientationGpu.dispose();
    const rawWorker=new RenderWorker();await rawWorker.setSource(decoder.source);const rawOutput=await rawWorker.render(rawSettings);
    rawInfo.output=[rawOutput.width,rawOutput.height];rawOutput.close();rawWorker.dispose();rawGpu.dispose();decoder.dispose();
    // The real UI starts with a 24 MP decoded image, not a miniature fixture.
    const large=document.createElement('canvas');large.width=6000;large.height=4000;large.getContext('2d').drawImage(source,0,0,6000,4000);
    const host=document.querySelector('#host');host.replaceChildren(document.createElement('canvas'));
    let draws=0,resolveDraw;const waitDraw=()=>new Promise(resolve=>resolveDraw=resolve);
    const preview=new Preview(host.firstChild,large,{onDraw:()=>{draws++;resolveDraw?.();resolveDraw=null;},onError:error=>{throw error;}});
    let done=waitDraw();preview.update(defaults());await done;
    const mode=preview.gpu?'GPU':'worker',dimensions=[preview.canvas.width,preview.canvas.height];
    const samples=[];
    for(let n=0;n<45;n++){
      done=waitDraw();const start=performance.now();preview.update({...defaults(),exposure:n/45,sharpen:50,noise:30});await done;
      preview.gpu?.gl.finish();samples.push(performance.now()-start);
    }
    const initialDraws=draws;done=waitDraw();for(let i=0;i<200;i++)preview.update({...defaults(),exposure:i/200});await done;
    const coalescedDraws=draws-initialDraws;
    preview.dispose();
    // Force fallback and race rapid input against the worker.
    host.replaceChildren(document.createElement('canvas'));
    let fallbackDone;const fallbackPromise=new Promise(resolve=>fallbackDone=resolve);
    const fallback=new Preview(host.firstChild,large,{onDraw:()=>fallbackDone(),onError:error=>{throw error;}});
    fallback.fallback();fallback.update(defaults());
    await new Promise(resolve=>setTimeout(resolve,20));
    for(let i=0;i<100;i++)fallback.update({...defaults(),exposure:i/99});
    await fallbackPromise;
    while(fallback.busy||fallback.frame)await new Promise(resolve=>setTimeout(resolve,10));
    const fallbackDimensions=[fallback.canvas.width,fallback.canvas.height];
    const latest=fallback.settings.exposure;fallback.dispose();
    // Full-size export must match its size and let the page heartbeat continue.
    const worker=new RenderWorker();await worker.setSource(large);
    let beats=0;const timer=setInterval(()=>beats++,16),start=performance.now();
    const bitmap=await worker.render({...defaults(),sharpen:40,noise:20,exposure:.5});
    const exportMs=performance.now()-start;clearInterval(timer);
    const exportSize=[bitmap.width,bitmap.height];bitmap.close();worker.dispose();
    // UI acceptance and cancellation, including worker lifetime.
    const {openDeveloper}=await import('/raw/ui.js');
    window.testSource=source;window.testLarge=large;window.testDefaults=defaults;window.openDeveloper=openDeveloper;
    samples.sort((a,b)=>a-b);
    return {differences,originalExact,curveMetrics,noiseMetrics,rawInfo,mode,dimensions,frameMedianMs:samples[22],frameP95Ms:samples[42],coalescedDraws,fallbackDimensions,latest,exportSize,exportMs,beats};
  });
  assert.equal(result.mode,'GPU');assert.equal(result.originalExact,true);
  for(const d of result.differences){assert.ok(d.max<=3,JSON.stringify(d));assert.ok(d.mean<.5,JSON.stringify(d));}
  assert.ok(result.curveMetrics.minSlope>-0.002);assert.ok(Math.abs(result.curveMetrics.contrastMid-.5)<1e-6);
  assert.ok(result.curveMetrics.shadow>.3&&result.curveMetrics.shadow<.45);assert.ok(result.curveMetrics.highlight<.72);assert.ok(result.curveMetrics.highlightUp>.85);
  assert.ok(Math.abs(result.curveMetrics.smallContrast-.2)<.003);
  assert.ok(result.noiseMetrics.chromaRatio<.7);assert.ok(result.noiseMetrics.noiseRatio<.7);assert.ok(result.noiseMetrics.lumaError<.6);
  assert.equal(result.rawInfo.bits,16);assert.equal(result.rawInfo.linear,true);assert.ok(result.rawInfo.values>256);assert.ok(result.rawInfo.maxDifference<=3,JSON.stringify(result.rawInfo));
  assert.ok(result.dimensions[0]*result.dimensions[1]<=1402000);
  assert.equal(result.coalescedDraws,1);assert.equal(result.latest,1);
  assert.ok(result.fallbackDimensions[0]*result.fallbackDimensions[1]<=181000);
  assert.deepEqual(result.exportSize,[6000,4000]);assert.ok(result.beats>10);
  await page.evaluate(()=>{window.accepted=null;window.closedCount=0;window.ui=window.openDeveloper({source:window.testSource,onAccept:(canvas,settings)=>{window.accepted={w:canvas.width,h:canvas.height,exposure:settings.exposure};},onClose:()=>window.closedCount++});});
  const definitions=await page.evaluate(async()=>{const {CONTROLS}=await import('/raw/state.js');return CONTROLS.filter(item=>item.type!=='choice');});
  for(const item of definitions){
    await page.locator(`.raw-groups [data-group="${item.group}"]`).click();
    const slider=page.locator(`.raw-control-list input[data-key="${item.key}"]`),value=item.key==='exposure'?1:10;
    await slider.fill(String(value));
    await page.locator('.raw-control-list').getByRole('button',{name:`Aumentar ${item.label}`,exact:true}).click();
    assert.ok(Math.abs(Number(await slider.inputValue())-(value+(item.step||1)))<1e-6);
    await page.locator('.raw-control-list').getByRole('button',{name:`Disminuir ${item.label}`,exact:true}).click();
    assert.equal(Number(await slider.inputValue()),value);
    const box=await slider.boundingBox();await slider.dblclick({position:{x:box.width*.75,y:box.height*.5}});
    assert.equal(Number(await slider.inputValue()),0,`Reset ${item.key}`);
  }
  await page.locator('.raw-groups [data-group="luz"]').click();
  await page.locator('.raw-control-list input[data-key=exposure]').fill('1.5');
  await page.getByRole('button',{name:'Aumentar Exposición',exact:true}).filter({visible:true}).click();
  assert.equal(await page.locator('.raw-control-list input[data-key=exposure]').inputValue(),'1.55');
  await page.getByRole('button',{name:'Disminuir Exposición',exact:true}).filter({visible:true}).click();
  await page.locator('.raw-control-list input[data-key=exposure]').dblclick();
  assert.equal(await page.locator('.raw-control-list input[data-key=exposure]').inputValue(),'0');
  await page.locator('.raw-control-list input[data-key=exposure]').fill('1.5');
  await page.locator('[data-action=accept]').click();
  await page.waitForFunction(()=>window.accepted&& !document.querySelector('#rawDeveloper'));
  assert.deepEqual(await page.evaluate(()=>window.accepted),{w:320,h:240,exposure:1.5});
  assert.equal(await page.evaluate(()=>window.closedCount),1);
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(async()=>{
    const {Preview}=await import('/raw/preview.js');const host=document.querySelector('#host');host.replaceChildren(document.createElement('canvas'));
    let next;const preview=new Preview(host.firstChild,window.testLarge,{onDraw:()=>next?.(),onError:error=>{throw error;}});
    const times=[];
    for(let i=0;i<25;i++){
      const done=new Promise(resolve=>next=resolve),start=performance.now();preview.update({...window.testDefaults(),exposure:i/25,sharpen:50,noise:25});await done;preview.gpu.gl.finish();times.push(performance.now()-start);
    }
    const dimensions=[preview.canvas.width,preview.canvas.height];
    const restored=new Promise(resolve=>next=resolve);preview.gpu.gl.getExtension('WEBGL_lose_context').loseContext();await restored;
    const recovered=!!preview.worker;preview.dispose();
    return {dimensions,recovered,medianMs:times.sort((a,b)=>a-b)[12]};
  });
  assert.ok(mobile.dimensions[0]*mobile.dimensions[1]<=651000);assert.equal(mobile.recovered,true);
  await page.evaluate(()=>{window.ui=window.openDeveloper({source:window.testLarge,onAccept:()=>{window.unwantedAccept=true;}});});
  await page.locator('.raw-mobile-slider input').fill('-0.5');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.raw-controls').isVisible(),false);
  assert.equal(await page.locator('.raw-mobile-slider input').count(),1);
  await page.locator('[data-action=accept]').click();
  await page.keyboard.press('Escape');assert.equal(await page.locator('#rawDeveloper').count(),0);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>!!window.unwantedAccept),false);
  const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const touch=await touchContext.newPage();touch.on('pageerror',error=>errors.push(error.message));
  await touch.goto(`http://127.0.0.1:${server.address().port}/test.html`);
  await touch.evaluate(async()=>{
    const {openDeveloper}=await import('/raw/ui.js');const source=document.createElement('canvas');source.width=600;source.height=400;
    source.getContext('2d').fillRect(0,0,600,400);window.ui=openDeveloper({source,onAccept:()=>{}});
  });
  const touchSlider=touch.locator('.raw-mobile-slider input');
  await touchSlider.fill('2');
  const tapBox=await touchSlider.boundingBox(),tapX=tapBox.x+tapBox.width*.8,tapY=tapBox.y+tapBox.height*.5;
  await touch.touchscreen.tap(tapX,tapY);await touch.touchscreen.tap(tapX,tapY);
  assert.equal(Number(await touchSlider.inputValue()),0,'Native two-touch reset');
  await touch.locator('.raw-mobile-slider').getByRole('button',{name:'Aumentar Exposición',exact:true}).tap();
  assert.equal(Number(await touchSlider.inputValue()),.05);
  await touch.locator('.raw-mobile-group').selectOption('perfil');await touch.locator('.raw-mobile-control').selectOption('temperature');
  await touchSlider.fill('45');const tempBox=await touchSlider.boundingBox();
  await touch.touchscreen.tap(tempBox.x+tempBox.width*.8,tempBox.y+tempBox.height*.5);await touch.touchscreen.tap(tempBox.x+tempBox.width*.8,tempBox.y+tempBox.height*.5);
  assert.equal(Number(await touchSlider.inputValue()),0,'Temperature neutral zero');
  await touchContext.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,...result,mobile},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
