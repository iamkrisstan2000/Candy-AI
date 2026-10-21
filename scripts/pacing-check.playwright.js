// TEST ONLY: scoped to a browser session, never shipped in the app payload.
async (page) => {
 const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
 const text='A complete test-only reply. No real model is running. 🌱';
 await page.unroute('**/preview-bridge.js');
 await page.route('**/preview-bridge.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+`\n;(()=>{const real=window.candy.load;window.candy.load=async()=>({...await real(),chats:[],appearance:{accentColor:'#0078d4',accentAvailable:true},installation:{modelName:'TEST ONLY',backend:'cpu'}});let callback,cancel;window.candy.onEvent=cb=>{callback=cb;window.__CANDY_TEST_EVENT=cb;return()=>{};};window.candy.chat=id=>new Promise((resolve,reject)=>{callback?.({type:'token',id,token:'A complete test-only reply.'});const timer=setTimeout(()=>{cancel=null;resolve({text:${JSON.stringify(text)},stopped:false});},5400);cancel=()=>{clearTimeout(timer);cancel=null;resolve({text:'',stopped:true});};});window.candy.stop=async()=>cancel?.();})();`});});
 await page.reload();await page.getByRole('textbox',{name:'Message Candy'}).waitFor();await page.locator('#new-chat').click();
 check(await page.locator('.ai-pill').count()===0,'LOCAL AI pill remains');
 check(!await page.locator('.sidebar').textContent().then(s=>s.includes('Candy for Windows')||s.includes('v1.')),'Left-pane footer remains');
 await page.evaluate(()=>{window.__delivered=[];new MutationObserver(()=>{const t=document.querySelector('.message.assistant .message-body')?.textContent;if(t)window.__delivered.push(t);}).observe(document.querySelector('#messages'),{subtree:true,childList:true,characterData:true});});
 await page.getByRole('textbox',{name:'Message Candy'}).fill('TEST ONLY — hold all tokens until generation finishes.');const start=Date.now();await page.getByRole('button',{name:'Send message',exact:true}).click();
 check(await page.locator('.typing>span').count()===3,'Three bouncing dots missing');
 check(await page.locator('#stream-message').textContent()==='','Visible typing/thinking label remains');
 check(await page.locator('#stream-message .message-body').count()===0,'Pending reply has a bubble');
 check(await page.locator('.typing>span').first().evaluate(el=>getComputedStyle(el).animationName)==='candy-bounce','Bouncing animation removed');
 await page.waitForTimeout(4500);check(await page.locator('.message.assistant .message-body').count()===0,'Partial reply leaked before inference finished');
 await page.waitForFunction(()=>!document.querySelector('#stream-message'),null,{timeout:6000});const deliveredMs=Date.now()-start;
 check(await page.locator('.message.assistant .message-body').last().textContent()===text,'Complete reply not delivered');
 check(await page.evaluate(t=>window.__delivered.every(x=>x===t),text),'A prefix appeared in a DOM mutation');
 check(await page.locator('.message.assistant .message-body').last().evaluate(el=>getComputedStyle(el).backgroundColor!=='rgba(0, 0, 0, 0)'&&getComputedStyle(el).borderTopWidth==='1px'),'Candy accent bubble missing');
 await page.getByRole('textbox',{name:'Message Candy'}).fill('TEST ONLY — cancel hidden output.');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('button',{name:'Stop reply',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#stream-message'));
 check(await page.locator('.message.assistant .message-body').count()===1,'Stop leaked another reply');
 await page.getByRole('button',{name:'Settings & personalization',exact:true}).click();
 check((await page.locator('.drawer-footer').textContent()).includes('Candy for Windows'),'Settings footer not moved');check(await page.locator('.drawer-footer use[href="#i-shield"]').count()===1,'Shield icon removed');
 check(await page.locator('#follow-windows-accent').count()===0,'Old Windows toggle remains');
 check(await page.locator('[data-scene]').count()===10,'Ten scenes expected');
 await page.locator('[data-scene=windows]').click();await page.evaluate(()=>window.__CANDY_TEST_EVENT({type:'appearance',accentColor:'#ffb900',accentAvailable:true}));
 check(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent-raw'))==='#ffb900','Windows scene did not follow a live device event');
 await page.locator('[data-scene=rose]').click();await page.evaluate(()=>window.__CANDY_TEST_EVENT({type:'appearance',accentColor:'#00ff00',accentAvailable:true}));
 check(await page.locator('body').evaluate(e=>e.style.getPropertyValue('--accent-raw'))==='#b04f79','Custom scene incorrectly follows Windows');
 check(await page.locator('[data-scene][aria-pressed=true]').count()===1,'Scene selection not exclusive');
 await page.unroute('**/preview-bridge.js');await page.reload();await page.getByRole('button',{name:'Settings & personalization',exact:true}).click();check(await page.locator('[data-scene=rose]').getAttribute('aria-pressed')==='true','Scene not persisted');
 await page.locator('[data-scene=windows]').click();await page.getByRole('button',{name:'Close settings',exact:true}).click();
 return {atomicDelivery:true,noPartialDOM:true,deliveredMs,dotsOnly:true,noPendingBubble:true,stopDiscardsHiddenReply:true,tenScenes:true,liveWindowsSimulation:true,scenePersistence:true,footerMovedWithShield:true,testBridgeRemoved:true};
}
