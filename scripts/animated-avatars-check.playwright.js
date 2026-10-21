// TEST ONLY: real Chromium WebP playback, preference lifecycle, UI shake independent of native mode.
async (page,tools)=>{
 const check=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://localhost:3000');await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('#empty-new-chat').click();
 let choices=0;
 for(const persona of ['friendly','thoughtful','creative','focused'])for(const id of ['finger-heart','tail-cat']){
  await page.evaluate(async({persona,id})=>{saveSetting('persona',persona);saveSetting('candyAvatar',id);await settingsSerial},{persona,id});
  check(await page.locator('[data-candy-avatar]').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth===256)),'Avatar failed to decode');
  check(await page.locator('.titlebar [data-app-icon]').getAttribute('src')==='mascot.svg','Selected avatar replaced app identity');choices++;
 }
 await page.reload();check(await page.evaluate(()=>state.settings.candyAvatar)==='tail-cat','Animated selection not persisted');
 const playback=[];
 for(const id of ['finger-heart','tail-cat']){
  await page.evaluate(async id=>{saveSetting('candyAvatar',id);await settingsSerial},id);await page.waitForTimeout(100);
  // Canvas drawImage intentionally uses the default frame for animated images.
  // Compare actual compositor screenshots instead, not a canvas poster.
  const img=page.locator('[data-candy-avatar]').last();
  const first=tools.imagePixels(await img.screenshot({animations:'allow'}));await page.waitForTimeout(650);
  const second=tools.imagePixels(await img.screenshot({animations:'allow'}));
  let changedPixels=0;for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2])>20)changedPixels++;
  const result={changedPixels,src:await img.getAttribute('src')};
  check(result.changedPixels>100,'Animated WebP is not actually moving: '+id);playback.push({id,...result});
 }
 await page.locator('#open-settings').click();await page.getByRole('tab',{name:'Avatars',exact:true}).click();
 check(await page.locator('#candy-avatar-grid .avatar-motion-label').count()===2,'Animated options not labelled');
 await page.locator('[data-candy-choice="finger-heart"]').click();check(await page.locator('[data-candy-choice="finger-heart"]').getAttribute('aria-pressed')==='true','Animated tile selection missing');
 await page.screenshot({path:tools.outputPath('Candy-1.0.0-animated-avatar-settings.png')});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>[...document.querySelectorAll('[data-candy-avatar]')].every(e=>e.getAttribute('src').endsWith('-still.webp')));
 check(await page.locator('#candy-avatar-grid img').evaluateAll(es=>es.filter(e=>/finger-heart|tail-cat/.test(e.src)).every(e=>e.src.endsWith('-still.webp'))),'Reduced motion left grid loops running');
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('[data-candy-avatar]').getAttribute('src').endsWith('finger-heart.webp'));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});check(await page.locator('[data-candy-avatar]').first().getAttribute('src')==='avatars/candy-finger-heart-still.webp','Hidden document did not pause avatars');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});check(await page.locator('[data-candy-avatar]').first().getAttribute('src')==='avatars/candy-finger-heart.webp','Visible document did not resume avatars');
 await page.locator('#message-input').fill('Keep this draft safe.');const messages=await page.locator('.message').count(),shake=[];
 for(const mode of ['window','content','none','error','pending']){
  await page.waitForTimeout(1250);await page.evaluate(mode=>{window.candy.nudge=async()=>{if(mode==='error')throw Error('native refused');if(mode==='pending')return new Promise(r=>window.__releaseNudge=()=>r({mode:'window'}));return {mode}}},mode);
  await page.locator('#nudge').click();
  const motion=await page.evaluate(async()=>{
   const e=document.querySelector('.app-shell'),animation=e.getAnimations().find(a=>a.animationName==='nudge');
   if(!animation)return {missingAnimation:true};
   // Seek the true CSS peak for deterministic geometry under a loaded CI host,
   // then resume and verify that normal playback really returns to identity.
   animation.pause();animation.currentTime=animation.effect.getTiming().duration*.19;
   const peak=new DOMMatrixReadOnly(getComputedStyle(e).transform);
   animation.play();await animation.finished;await new Promise(requestAnimationFrame);
   return {peakX:Math.abs(peak.m41),peakY:Math.abs(peak.m42),restored:getComputedStyle(e).transform==='none',running:e.classList.contains('nudge-anim')};
  });
  check(motion.peakX>=11.9,'Not a noticeable shake for native mode '+mode+': '+JSON.stringify(motion));check(motion.restored&&!motion.running,'Shake left a transform/class behind');
  if(mode==='pending')await page.evaluate(()=>window.__releaseNudge());
  check(await page.locator('#message-input').inputValue()==='Keep this draft safe.','Nudge overwrote draft');check(await page.locator('.message').count()===messages,'Nudge auto-sent');shake.push({mode,...motion});
 }
 await page.waitForTimeout(1250);await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#nudge').click();check(await page.locator('.app-shell').evaluate(e=>getComputedStyle(e).transform==='none'&&!e.classList.contains('nudge-anim')),'Reduced motion shook UI');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1250);await page.locator('#nudge').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);check(await page.locator('.app-shell').evaluate(e=>getComputedStyle(e).transform==='none'&&!e.classList.contains('nudge-anim')),'Changing reduced-motion did not stop shake');
 check(!errors.length,errors.join('; '));return {avatarPersonaCases:choices,actualWebpPlayback:playback,persistedSelection:true,originalAppIconPreserved:true,reducedMotionPosters:true,hiddenAvatarPauseAndResume:true,shakeIndependentOfNativeResults:shake,shakeCancelledOnReducedMotion:true,draftPreserved:true,noAutoSend:true,pageErrors:errors.length};
}
