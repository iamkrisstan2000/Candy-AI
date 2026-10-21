// Run via: playwright-cli -s=arena run-code --filename=scripts/ui-check.playwright.js
// Browser-only preview tests. No real AI, personal files, or desktop data involved.
async (page, tools) => {
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
 // First use the CLI click/upload commands to import assets/candy.png.
 await page.reload();if(!await page.locator('.chat-item').count())await page.locator('#new-chat').click();await page.getByRole('button',{name:'Change your avatar',exact:true}).click();
 let customTested=false;if(await page.getByRole('button',{name:'Your custom picture',exact:true}).count()){
 check(await page.getByRole('button',{name:'Your custom picture',exact:true}).getAttribute('aria-pressed')==='true','Imported custom picture did not survive reload');
 check((await page.locator('#you-picture').getAttribute('src')).startsWith('data:image/png;base64,'),'Import did not produce local PNG');
 await page.getByRole('button',{name:'Remove custom picture',exact:true}).click();
 check(await page.getByRole('button',{name:'Your custom picture',exact:true}).count()===0,'Custom avatar not removed');customTested=true;}


 if(!await page.getByRole('tab',{name:'Personality',exact:true}).isVisible())await page.getByRole('button',{name:'Change Candy’s avatar',exact:true}).click();
 await page.getByRole('tab',{name:'Personality',exact:true}).click();await page.locator('[data-persona=focused]').click();await page.getByRole('tab',{name:'Avatars',exact:true}).click();
 await page.getByRole('button',{name:'Developer anime girl',exact:true}).click();
 check((await page.locator('[data-candy-avatar]').first().getAttribute('src')).includes('developer'),'Developer avatar not applied');
 await page.getByRole('tab',{name:'Personality',exact:true}).click();
 await page.locator('#humor').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
 for(const persona of ['friendly','thoughtful','creative','focused']){
  await page.locator(`[data-persona=${persona}]`).click();
  check(await page.locator('#humor').inputValue()==='80','Persona changed the humor level');
  check((await page.locator('#humor-description').textContent()).startsWith('Lively'),'Humor description not updated');
  check(await page.locator('[data-candy-choice=developer]').count()===(persona==='focused'?1:0),'Developer option gating failed');
 }
 check((await page.locator('[data-candy-avatar]').first().getAttribute('src'))==='mascot.svg','Switching away must reset gated avatar');
 await page.getByRole('tab',{name:'Avatars',exact:true}).click();
 await page.getByRole('button',{name:'Cute anime girl',exact:true}).click();
 await page.getByRole('button',{name:'Little frog',exact:true}).click();
 check((await page.locator('#you-picture').getAttribute('src')).includes('you-frog'),'User avatar not applied');
 await page.getByRole('button',{name:'Guitar girl',exact:true}).click();
 await page.getByRole('tab',{name:'Personality',exact:true}).click();
 await page.locator('[data-persona=friendly]').click();
 const audit=async()=>{await page.evaluate(()=>toast('TEST ONLY scene-aware notification'));return page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true}),cache=new Map();
  const parse=s=>{if(cache.has(s))return cache.get(s);ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const n=ctx.getImageData(0,0,1,1).data,c={r:n[0],g:n[1],b:n[2],a:n[3]/255};cache.set(s,c);return c;};
  const mix=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const lum=c=>[c.r,c.g,c.b].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const bg=e=>{const layers=[];for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p),paint=p.matches('.main')?getComputedStyle(p,'::before').backgroundColor:s.backgroundColor;layers.push(parse(paint));}return layers.reverse().reduce((b,f)=>mix(f,b),{r:255,g:255,b:255,a:1});};
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),failures=[];let n,count=0;
  while(n=walker.nextNode()){const e=n.parentElement,text=n.textContent.trim();if(!text||!e||e.closest('[inert],[aria-hidden=true],[disabled],script,style'))continue;const s=getComputedStyle(e),r=document.createRange();r.selectNodeContents(n);const rect=r.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight||s.visibility==='hidden'||Number(s.opacity)<.95)continue;const b=bg(e),f=mix(parse(s.color),b),a=lum(f),z=lum(b),ratio=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);count++;if(ratio<(large?2.95:4.45))failures.push({text:text.slice(0,75),ratio:ratio.toFixed(2),tag:e.tagName});}
  return {count,failures};
 });};
 // Add a clearly labelled CSS fixture alongside the real welcome bubble.
 await page.evaluate(()=>document.querySelector('#messages').insertAdjacentHTML('beforeend','<article class="message assistant"><div class="message-label"><strong>TEST ONLY</strong></div><div class="message-body"><strong>Bold text</strong> and <code>inline code</code><pre><code>const value = 1;</code></pre></div></article>'));
 await page.evaluate(()=>document.querySelector('#messages').insertAdjacentHTML('beforeend','<article class="message user"><div class="message-label"><strong>TEST ONLY USER</strong></div><div class="message-body"><strong>User bold</strong> and <code>inline code</code><pre><code>const reply = true;</code></pre></div></article>'));
 const reports=[];
 for(const bubbleStyle of ['outlined','solid','fruit','metro']){
 await page.getByRole('tab',{name:'Personality',exact:true}).click();await page.locator('#bubble-style').selectOption(bubbleStyle);
 for(const theme of ['light','dark']){
  await page.getByRole('tab',{name:'Personality',exact:true}).click();await page.locator('#theme').selectOption(theme);
  for(const scene of ['windows','meadow','lavender','sunset','ocean','rose','aurora','beach','sakura','matrix']){
   await page.locator(`[data-scene=${scene}]`).click();await settle();reports.push({bubbleStyle,theme,scene,page:'personality',...await audit()});await page.locator('[data-scene=beach]').scrollIntoViewIfNeeded();await settle();reports.push({bubbleStyle,theme,scene,page:'scene-grid',...await audit()});
   await page.getByRole('tab',{name:'Avatars',exact:true}).click();await settle();reports.push({bubbleStyle,theme,scene,page:'avatars',...await audit()});
   await page.getByRole('button',{name:'Close settings',exact:true}).click();await settle();await page.locator('#messages').evaluate(e=>e.scrollTop=0);reports.push({bubbleStyle,theme,scene,page:'chat-top',...await audit()});await page.locator('#messages').evaluate(e=>e.scrollTop=e.scrollHeight);reports.push({bubbleStyle,theme,scene,page:'chat-code-fixtures',...await audit()});
   await page.getByRole('button',{name:'Change Candy’s avatar',exact:true}).click();await page.getByRole('tab',{name:'Personality',exact:true}).click();
  }
  for(const tab of ['Voice','Device & data']){await page.getByRole('tab',{name:tab,exact:true}).click();await settle();reports.push({bubbleStyle,theme,page:tab,...await audit()});}
 }
 }
 const bad=reports.filter(r=>r.failures.length);check(!bad.length,'Contrast failures: '+JSON.stringify(bad));
 await page.getByRole('tab',{name:'Avatars',exact:true}).click();await page.locator('.drawer-body').evaluate(el=>el.scrollTop=0);await settle();await page.screenshot({path:tools.outputPath('Candy-1.0.0-avatars-dark.png')});
 await page.getByRole('button',{name:'Close settings',exact:true}).click();await settle();await page.screenshot({path:tools.outputPath('Candy-1.0.0-chat-dark.png')});
 check(!await page.locator('.sidebar').textContent().then(s=>s.includes('Just between us.')),'Removed privacy card remains');
 return ({avatarSelection:true,developerGating:true,humorRetained:80,customImportAndRemoval:customTested,previewPersistence:true,contrastScreens:reports.length,contrastFailures:bad,allBundledPicturesLoaded:await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0))});
}
