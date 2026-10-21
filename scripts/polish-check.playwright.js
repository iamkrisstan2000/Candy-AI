// TEST ONLY: visual chrome/colors in disposable browser preview; no AI/model.
async (page,tools)=>{
 const check=(ok,msg)=>{if(!ok)throw new Error(msg);},errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 await page.evaluate(()=>{for(const k of ['settings','chats'])localStorage.removeItem('candy-preview-'+k);});await page.reload();
 await page.locator('#new-chat').click();await page.locator('.chat-row:has(.chat-item.active) .chat-row-tools').hover();await page.locator('.chat-row:has(.chat-item.active) .conversation-more').click();await page.locator('#delete-chat').click();await page.locator('#confirm-delete').click();await page.locator('#delete-dialog').waitFor({state:'hidden'});
 check(await page.locator('#toast').textContent()==='Conversation deleted.','Real deletion notification missing');check(await page.locator('.chat-item').count()===0,'Final deletion manufactured a thread');
 const colors=[];
 for(const theme of ['light','dark'])for(const scene of ['windows','meadow','lavender','sunset','ocean','rose','aurora','beach','sakura','matrix']){
  await page.evaluate(async({theme,scene})=>{saveSetting('theme',theme);saveSetting('scene',scene);await settingsSerial;toast('TEST ONLY scene-aware notification');},{theme,scene});
  const c=await page.locator('#toast').evaluate(e=>{const s=getComputedStyle(e),v=document.body.style;return {bg:s.backgroundColor,color:s.color,border:s.borderTopColor,expected:v.getPropertyValue('--toast-bg')};});
  check(await page.locator('#toast').evaluate(e=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=document.body.style.getPropertyValue('--toast-bg');const c=ctx.fillStyle;ctx.fillStyle=getComputedStyle(e).backgroundColor;return ctx.fillStyle===c;}),'Toast not bound to scene palette');colors.push({theme,scene,...c});
 }
 for(const theme of ['light','dark'])check(new Set(colors.filter(c=>c.theme===theme).map(c=>c.bg)).size===10,'Toast still fixed across scenes');
 await page.evaluate(async()=>{saveSetting('scene','windows');await settingsSerial;state.appearance={accentColor:'#0078d4',accentAvailable:true};applySettings();toast('TEST ONLY live color');});const blue=await page.locator('#toast').evaluate(e=>getComputedStyle(e).backgroundColor);await page.evaluate(()=>{state.appearance={accentColor:'#ffb900',accentAvailable:true};applySettings();});check(await page.locator('#toast').evaluate(e=>getComputedStyle(e).backgroundColor)!==blue,'Visible toast ignored live device accent');
 for(const collapsed of [false,true]){
  await page.evaluate(async collapsed=>{saveSetting('sidebarCollapsed',collapsed);await settingsSerial;},collapsed);await settle();const main=await page.locator('.main').boundingBox(),bar=await page.locator('.titlebar').boundingBox(),side=await page.locator('.sidebar').boundingBox();
  check(Math.abs(main.y-(bar.y+bar.height))<1,'Panel not inset beneath titlebar');check(Math.abs(main.x-(side.x+side.width))<1,'Panel crosses sidebar or fails to track it');
  check(await page.locator('.main').evaluate(e=>{const s=getComputedStyle(e);return s.borderTopWidth==='0px'&&s.borderTopLeftRadius==='8px'&&s.borderTopRightRadius==='0px'&&s.boxShadow==='none'&&s.overflow==='hidden';}),'Missing single unoutlined upper-left curve');
  check(await page.locator('.chat-top-divider').count()===0,'Floating line remains');
 }
 await page.evaluate(async()=>{saveSetting('sidebarCollapsed',false);saveSetting('theme','light');saveSetting('scene','sunset');await settingsSerial;state.appearance={accentColor:null,accentAvailable:false};applySettings();toast('Conversation deleted.');});await settle();await page.mouse.move(1000,400);
 const newStyle=await page.locator('#new-chat').evaluate(e=>{const s=getComputedStyle(e);return {fill:s.backgroundColor,text:s.color,height:e.getBoundingClientRect().height,shadow:s.boxShadow,primary:e.classList.contains('primary')};});
 check(!newStyle.primary&&newStyle.height===38&&newStyle.shadow==='none','Compact New action lost its 38px height or soft coordinated styling');check(await page.locator('#new-chat').evaluate(e=>getComputedStyle(e).backgroundColor===getComputedStyle(document.querySelector('#empty-new-chat')).backgroundColor),'New actions not coordinated');
 await page.screenshot({path:tools.outputPath('Candy-1.0.0-light.png')});
 await page.evaluate(async()=>{saveSetting('theme','dark');saveSetting('scene','windows');await settingsSerial;toast('Conversation deleted.');});await settle();await page.screenshot({path:tools.outputPath('Candy-1.0.0-dark.png')});
 for(const width of [940,1140,1440,1920]){await page.setViewportSize({width,height:960});await settle();check(await page.locator('#new-chat').evaluate(e=>e.scrollWidth<=e.clientWidth),'New button clips at '+width);}
 await page.setViewportSize({width:1440,height:960});
 await page.evaluate(()=>{for(const k of ['settings','chats'])localStorage.removeItem('candy-preview-'+k);});await page.reload();check(errors.length===0,'Page errors: '+errors.join('; '));
 return {sceneAwareToasts:colors.length,liveDeviceColor:true,realDeletionToast:true,softCoordinatedNewButtons:true,panelBelowTitlebarChatOnly:true,roundedPanelTracksSidebar:true,responsiveWidths:4,pageErrors:errors.length,noModelUsed:true};
}
