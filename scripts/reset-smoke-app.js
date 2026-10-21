// Child of reset-smoke.js only. Refuse to run without a dedicated /tmp test root.
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const base=process.env.CANDY_RESET_TEST_PARENT;if(!base||path.dirname(base)!==os.tmpdir()||!path.basename(base).startsWith('candy-full-reset-'))throw new Error('Dedicated test root required');
const pending=process.env.CANDY_RESET_TEST_PENDING;const root=path.join(base,'CandyLocal');if(pending==='chat'||pending==='stop'){fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'installation.json'),JSON.stringify({modelName:'TEST ONLY',backend:'cpu',modelFile:'dummy.gguf'}));}
if(pending!=='none')require('../src/hardware').inspect=async()=>{await new Promise(r=>setTimeout(r,350));console.log('TEST_HARDWARE_RETURNED');return {cpu:'TEST ONLY',cores:4,ramGB:8,gpus:[]};};
app.commandLine.appendSwitch('disable-gpu');app.setPath('appData',base);
const timeout=setTimeout(()=>{console.error('Reset desktop test timed out');app.exit(1);},25000);
app.on('browser-window-created',(_,w)=>{w.webContents.once('did-finish-load',async()=>{try{
 const root=path.join(base,'CandyLocal');const {importAvatar,customAvatar,avatarFile,removeAvatar}=require('../src/profile');
 // Actual native decoder, center crop, PNG metadata stripping, persistent local copy.
 const input=nativeImage.createFromPath(path.join(__dirname,'../assets/candy.png')).toPNG();const result=importAvatar(root,input,nativeImage);assert.ok(result.startsWith('data:image/png;base64,'));assert.deepEqual(nativeImage.createFromPath(avatarFile(root)).getSize(),{width:256,height:256});assert.equal(customAvatar(root),result);removeAvatar(root);assert.equal(customAvatar(root),null);importAvatar(root,input,nativeImage);
 const jpeg=nativeImage.createFromPath(path.join(__dirname,'../assets/candy.png')).toJPEG(85);importAvatar(root,jpeg,nativeImage);assert.deepEqual(nativeImage.createFromPath(avatarFile(root)).getSize(),{width:256,height:256});console.log('PASS: Electron native PNG/JPEG decode, center crop, resize, load and remove.');
 fs.mkdirSync(path.join(root,'models'),{recursive:true});fs.writeFileSync(path.join(root,'models','test.gguf'),'dummy test model');fs.writeFileSync(path.join(root,'forgotten.tmp'),'must go too');
 await w.webContents.executeJavaScript(`(async()=>{await window.candy.saveSettings({persona:'focused',humor:81,candyAvatar:'developer',userAvatar:'custom'});await window.candy.saveChats([{id:'reset-test',title:'test',messages:[{role:'user',content:'test'}]}]);let refused=false;try{await window.candy.reset('WRONG');}catch{refused=true;}if(!refused)throw new Error('Missing reset confirmation guard');})()`);
 if(pending==='stop'){await w.webContents.executeJavaScript("(async()=>{const p=window.candy.chat('reset-test');await new Promise(r=>setTimeout(r,50));await window.candy.stop();const result=await p;if(!result.stopped||result.text)throw new Error('Early Stop must prevent late model loading');})()");console.log('PASS: Stop during hardware detection prevented a late model start.');}
 if(pending==='chat')await w.webContents.executeJavaScript("void window.candy.chat('reset-test').catch(()=>{})");if(pending==='setup')await w.webContents.executeJavaScript('void window.candy.setup().catch(()=>{})');if(pending!=='none')await new Promise(r=>setTimeout(r,60));
 console.log('RESET_TEST_ARMED');clearTimeout(timeout);w.webContents.executeJavaScript("window.candy.reset('DELETE ALL CANDY DATA')").catch(()=>{});
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}});});
require('../src/main');
