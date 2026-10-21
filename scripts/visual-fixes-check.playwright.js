// TEST ONLY. Rendered-pixel probes, disposable deletion and actual CSS-animation capture.
async (page,tools)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
 const settle=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);});
 await page.goto('http://localhost:3000');await page.evaluate(()=>{for(const k of ['settings','chats'])localStorage.removeItem('candy-preview-'+k);});await page.reload();await page.locator('#new-chat').click();
 const client=await page.context().newCDPSession(page);let cornerCases=0;
 // Deliberately high-contrast probe: an overpainted square cannot pass the pixel check.
 const probe=await page.addStyleTag({content:'.titlebar,.sidebar,.sidebar::after{background:#111!important}.main{background:#eee!important}.main::before{display:none!important}'});
 for(const scale of [1,1.25,1.5])for(const native of [false,true])for(const collapsed of [false,true]){
  await client.send('Emulation.setDeviceMetricsOverride',{width:1360,height:900,deviceScaleFactor:scale,mobile:false});await page.evaluate(async({collapsed,native})=>{saveSetting('sidebarCollapsed',collapsed);await settingsSerial;document.body.dataset.nativeAcrylic=String(native);},{collapsed,native});await settle();
  const r=await page.locator('.main').boundingBox();check(await page.locator('.main').evaluate(e=>getComputedStyle(e).isolation)==='isolate','Rounded panel not stacked above corner backing');await page.screenshot({path:tools.outputPath(`candy153-corner-${scale}-${native}-${collapsed}.png`),clip:{x:r.x-8,y:r.y-8,width:48,height:48}});cornerCases++;
 }
 await probe.evaluate(e=>e.remove());await client.send('Emulation.clearDeviceMetricsOverride');await page.setViewportSize({width:1360,height:900});await client.detach();
 await page.evaluate(()=>{document.body.dataset.nativeAcrylic='false';});await page.locator('.chat-row-tools').hover();await page.locator('.conversation-more').click();await page.locator('#delete-chat').click();await page.locator('#confirm-delete').click();await page.locator('#delete-dialog').waitFor({state:'hidden'});check(await page.locator('.chat-item').count()===0,'Actual deletion did not empty chat');
 let alignCases=0;
 for(const width of [940,1360,1920])for(const collapsed of [false,true]){
  await page.setViewportSize({width,height:900});await page.evaluate(async collapsed=>{saveSetting('sidebarCollapsed',collapsed);await settingsSerial;toast('Conversation deleted.');},collapsed);await settle();const a=await page.locator('#empty-new-chat').boundingBox(),b=await page.locator('#toast').boundingBox();check(b&&Math.abs(a.x+a.width/2-b.x-b.width/2)<.5,'Toast and New conversation centers differ');check(b.x>=0&&b.x+b.width<=width,'Toast clipped');alignCases++;
 }
 await page.setViewportSize({width:1360,height:900});await page.evaluate(async()=>{saveSetting('theme','dark');saveSetting('scene','rose');saveSetting('sidebarCollapsed',true);await settingsSerial;toast('Conversation deleted.');});await settle();await page.mouse.move(800,400);await page.screenshot({path:tools.outputPath('Candy-1.0.0-aligned-toast.png')});await page.screenshot({path:tools.outputPath('Candy-1.0.0-corner-detail.png'),clip:{x:26,y:22,width:120,height:100}});
 const motion=[];
 for(const scene of ['windows','meadow','lavender','sunset','ocean','rose','aurora','beach','sakura','matrix']){
  await page.evaluate(async scene=>{saveSetting('scene',scene);await settingsSerial;},scene);
  if(scene==='matrix'){const streams=page.locator('.matrix-stream').first(),a=await streams.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m42);await page.waitForTimeout(650);const b=await streams.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m42);check(Math.abs(a-b)>1,'Matrix rain is static');check(await streams.evaluate(e=>getComputedStyle(e).animationName)==='matrix-rain','Matrix rain animation missing');motion.push({scene,rainRange:Math.round(Math.abs(a-b)*100)/100});continue;}const samples=[];for(let i=0;i<3;i++){samples.push(await page.locator('.scene-panorama').evaluate(e=>({matrix:getComputedStyle(e).transform,tx:new DOMMatrix(getComputedStyle(e).transform).m41,duration:getComputedStyle(e).animationDuration})));if(i<2)await page.waitForTimeout(650);}
  const range=Math.max(...samples.map(s=>s.tx))-Math.min(...samples.map(s=>s.tx));check(range>1,'Scene appears static: '+scene);check(parseFloat(samples[0].duration)<=3.6,'Scene timing too slow');motion.push({scene,range:Math.round(range*100)/100});
 }
 await page.evaluate(async()=>{saveSetting('scene','rose');await settingsSerial;});check(await page.locator('.rose-sway').evaluate(e=>getComputedStyle(e).animationName)==='rose-sway','Independent rose motion missing');
 await page.emulateMedia({reducedMotion:'reduce'});for(const sel of ['.scene-illustration','.rose-sway','.windows-bloom','.art-sun','.beach-waves'])check(await page.locator(sel).first().evaluate(e=>getComputedStyle(e).animationName)==='none','Reduced motion ignored: '+sel);await page.emulateMedia({reducedMotion:'no-preference'});
 // Real time, unmodified CSS animation frames; GIF assembled by Pillow afterward.
 await page.evaluate(()=>{clearTimeout(toastTimer);document.querySelector('#toast').hidden=true;});const rect=await page.locator('#scene').boundingBox(),times=[];for(let i=0;i<24;i++){times.push(Date.now());await page.screenshot({path:tools.outputPath(`candy153-banner-${String(i).padStart(2,'0')}.png`),clip:{x:Math.ceil(rect.x),y:Math.ceil(rect.y),width:Math.floor(rect.width)-1,height:Math.floor(rect.height)-1}});await page.waitForTimeout(130);}
 await page.evaluate(()=>{for(const k of ['settings','chats'])localStorage.removeItem('candy-preview-'+k);});await page.reload();check(errors.length===0,errors.join('; '));return {cornerPixelProbeCases:cornerCases,toastAlignmentCases:alignCases,motion,reducedMotion:true,roseIndependentSway:true,frameTimes:times,pageErrors:errors.length,notNativeWindows:true};
}
