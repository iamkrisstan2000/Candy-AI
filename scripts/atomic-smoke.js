// Real Electron IPC + disk persistence, with TEST-ONLY inference methods. No model or personal data.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'candy-atomic-test-'));app.commandLine.appendSwitch('disable-gpu');app.setPath('appData',profile);const root=path.join(profile,'CandyLocal');fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'installation.json'),JSON.stringify({modelName:'TEST ONLY',backend:'cpu',modelFile:'unused'}));
require('../src/hardware').inspect=async()=>({cpu:'TEST ONLY',cores:4,ramGB:8,gpus:[]});
let mode='stop';const {Engine}=require('../src/engine');Engine.prototype.start=async()=>{};Engine.prototype.chat=async function(messages,settings,onToken){onToken('UNFINISHED');if(mode==='error')throw new Error('TEST inference failure');return {text:mode==='stop'?'UNFINISHED':'A complete TEST ONLY reply. 🌱',stopped:mode==='stop'};};
const timeout=setTimeout(()=>app.exit(1),20000);
app.on('browser-window-created',(_,w)=>w.webContents.once('did-finish-load',async()=>{try{
 await w.webContents.executeJavaScript("window.candy.saveChats([{id:'atomic-test',title:'TEST ONLY',messages:[{role:'user',content:'test'}]}])");
 for(mode of ['stop','error','complete']){const outcome=await w.webContents.executeJavaScript("window.candy.chat('atomic-test').then(r=>({r}),e=>({error:e.message}))");const d=await w.webContents.executeJavaScript('window.candy.load()');if(mode!=='complete'&&d.chats[0].messages.length!==1)throw new Error('Partial assistant reply was persisted');if(mode==='error'&&!outcome.error)throw new Error('Expected test error');if(mode==='complete'&&d.chats[0].messages[1]?.content!=='A complete TEST ONLY reply. 🌱')throw new Error('Complete reply not persisted');}
 console.log('PASS: real Electron IPC persisted only completed replies; stopped and failed fragments never entered the saved chat. TEST-ONLY inference, no model.');clearTimeout(timeout);await w.webContents.session.clearStorageData();app.exit(0);
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}}));
require('../src/main');
