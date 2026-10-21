// TEST ONLY: trusted mouse/keyboard events with a native-window bridge spy.
async (page,tools)=>{
 const check=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3000');await page.evaluate(()=>localStorage.clear());await page.reload();
 await page.locator('#empty-new-chat').click();await page.locator('#message-input').fill('My unsent draft stays put.');
 await page.evaluate(()=>{window.__windowCalls=[];window.candy.desktop=true;window.candy.window=async action=>{window.__windowCalls.push(action)}});
 let cases=0;
 for(const width of [940,1360])for(const theme of ['light','dark'])for(const tab of ['Personality','Avatars','Voice','Device & data']){
  await page.setViewportSize({width,height:900});await page.evaluate(async theme=>{saveSetting('theme',theme);await settingsSerial},theme);
  await page.locator('#open-settings').click();await page.getByRole('tab',{name:tab,exact:true}).click();
  check(await page.locator('.workspace').evaluate(e=>e.inert)&&await page.locator('.titlebar-search').evaluate(e=>e.inert),'Background not protected');
  for(const action of ['minimize','maximize','maximize','close']){
   const button=page.locator('[data-window="'+action+'"]');
   check(await button.evaluate(e=>!e.closest('[inert]')&&getComputedStyle(e.closest('.title-actions')).webkitAppRegion==='no-drag'),'Caption is inert or a drag region');
   const count=await page.evaluate(()=>window.__windowCalls.length);await button.click();
   check(await page.evaluate(()=>window.__windowCalls.length)===count+1,'Caption click did not route to native: '+action);
   check(await page.locator('#settings').isVisible(),'Caption closed settings');
  }
  if(tab==='Voice'){
   for(const text of ['A familiar little sound.','A voice that feels familiar.','Spoken on your device. Never in the cloud.'])check(await page.getByText(text,{exact:true}).count()===0,'Heading remains');
   await page.locator('#chatSounds').uncheck();await page.locator('#speak').check();check(!await page.locator('#chatSounds').isChecked(),'Speech toggled sounds');await page.locator('#speak').uncheck();await page.locator('#chatSounds').check();
   for(const kind of ['sent','received','nudge']){await page.locator('[data-sound-preview="'+kind+'"]').click();await page.waitForTimeout(130)}
  }
  const count=await page.locator('.chat-row').count();await page.keyboard.press('Control+n');await page.keyboard.press('Control+f');await page.keyboard.press('Control+k');check(await page.locator('.chat-row').count()===count,'Settings shortcut changed background chats');check(await page.locator('#search').evaluate(e=>e!==document.activeElement),'Search stole focus');
  await page.locator('[data-window="minimize"]').focus();await page.keyboard.press('Enter');check(await page.evaluate(()=>window.__windowCalls.at(-1))==='minimize','Keyboard activation failed');
  await page.keyboard.press('Shift+Tab');check(await page.evaluate(()=>document.activeElement.closest('#settings')!==null),'Backward wrap escaped settings/chrome');
  // Find the last enabled visible drawer control, then wrap through native captions.
  await page.evaluate(()=>{const a=[...document.querySelectorAll('#settings button:not([disabled]),#settings input:not([disabled]),#settings select,#settings summary')].filter(e=>e.offsetParent!==null);a.at(-1).focus()});
  await page.keyboard.press('Tab');check(await page.locator('[data-window="minimize"]').evaluate(e=>e===document.activeElement),'Forward loop did not include window controls');
  await page.keyboard.press('Tab');check(await page.locator('[data-window="maximize"]').evaluate(e=>e===document.activeElement),'Maximize missing from tab order');
  await page.keyboard.press('Tab');check(await page.locator('[data-window="close"]').evaluate(e=>e===document.activeElement),'Close missing from tab order');
  await page.keyboard.press('Tab');check(await page.locator('#close-settings').evaluate(e=>e===document.activeElement),'Caption-to-settings Tab failed');
  await page.keyboard.press('Escape');check(await page.locator('#settings').isHidden(),'Escape did not dismiss');check(await page.locator('#open-settings').evaluate(e=>e===document.activeElement),'Trigger focus not restored');check(!await page.locator('.workspace').evaluate(e=>e.inert)&&!await page.locator('.titlebar-search').evaluate(e=>e.inert),'Inert state stuck');
  check(await page.locator('#message-input').inputValue()==='My unsent draft stays put.','Settings disturbed draft');cases++;
 }
 await page.locator('#open-settings').click();await page.getByRole('tab',{name:'Device & data',exact:true}).click();await page.locator('#open-reset').click();
 check(await page.locator('#reset-dialog').evaluate(e=>e.open),'Reset confirmation lost');await page.locator('#cancel-reset').click();
 await page.locator('#settings-backdrop').click({position:{x:10,y:90}});check(await page.locator('#settings').isHidden(),'Backdrop did not dismiss');
 await page.locator('#search').fill('Conversation');check(await page.locator('#search').inputValue()==='Conversation','Search not restored');await page.keyboard.press('Escape');
 check(!errors.length,errors.join('; '));return {settingsCases:cases,captionClicks:64,allFourTabs:true,twoThemesAndWidths:true,captionKeyboardAndFocusLoop:true,backgroundAndSearchInert:true,backgroundShortcutsBlocked:true,draftPreserved:true,soundSpeechControlsRetained:true,requestedHeadingsRemoved:true,escapeAndBackdropDismissal:true,resetConfirmationRetained:true,pageErrors:errors.length};
}
