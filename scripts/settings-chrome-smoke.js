// TEST ONLY: trusted native Electron input and actual minimize/maximize/restore/close.
// Run under a 1920x1080 Xvfb display with an Openbox WM; disposable profile only.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'candy-caption-test-'));app.setPath('appData',profile);app.commandLine.appendSwitch('disable-gpu');
const pause=ms=>new Promise(r=>setTimeout(r,ms));const timeout=setTimeout(()=>{console.error('Caption smoke timed out');app.exit(1)},30000);let armed=false;
app.on('browser-window-created',(_,w)=>w.webContents.once('did-finish-load',async()=>{try{
 w.setBounds({x:80,y:80,width:1140,height:820});w.show();w.focus();await pause(350);
 await w.webContents.executeJavaScript('openSettings("voice")');
 assert.equal(await w.webContents.executeJavaScript('document.querySelector(".workspace").inert && !document.querySelector(".app-shell").inert && !document.querySelector(".title-actions").closest("[inert]")'),true);
 assert.equal(await w.webContents.executeJavaScript('["A familiar little sound.","A voice that feels familiar.","Spoken on your device. Never in the cloud."].every(t=>!document.querySelector("#tab-voice").textContent.includes(t))'),true);
 const click=async action=>{const p=await w.webContents.executeJavaScript(`(()=>{const r=document.querySelector('[data-window="${action}"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);w.webContents.sendInputEvent({type:'mouseMove',...p});w.webContents.sendInputEvent({type:'mouseDown',...p,button:'left',clickCount:1});w.webContents.sendInputEvent({type:'mouseUp',...p,button:'left',clickCount:1});await pause(350)};
 await click('minimize');assert.equal(w.isMinimized(),true,'Actual Minimize did not work with settings open');
 w.restore();w.show();w.focus();await pause(350);assert.equal(w.isMinimized(),false);
 assert.equal(await w.webContents.executeJavaScript('!document.querySelector("#settings").hidden'),true);
 await click('maximize');assert.equal(w.isMaximized(),true,'Actual Maximize did not work with settings open');
 await click('maximize');assert.equal(w.isMaximized(),false,'Actual restore did not work with settings open');
 assert.equal(await w.webContents.executeJavaScript('!document.querySelector("#settings").hidden && !document.querySelector("#tab-voice").hidden'),true);
 console.log('PASS: trusted caption clicks actually minimized, maximized and restored native Electron window with Voice settings still open; background remains inert; requested headings absent.');
 w.once('close',()=>{armed=true;clearTimeout(timeout);console.log('PASS: trusted Close click reached native window close while settings open.');});
 app.once('will-quit',()=>{assert.ok(armed,'Closed without caption click');console.log('PASS: app quit normally after native Close.');});
 await click('close');
 }catch(e){console.error('FAIL:',e);clearTimeout(timeout);app.exit(1)}}));
app.on('quit',()=>{try{fs.rmSync(profile,{recursive:true,force:true})}catch{}});require('../src/main');
