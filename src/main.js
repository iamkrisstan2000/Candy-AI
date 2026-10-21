'use strict';
const {app,BrowserWindow,ipcMain,session,dialog,systemPreferences,nativeImage,nativeTheme,screen}=require('electron');
const path=require('node:path');const fs=require('node:fs');const {spawn}=require('node:child_process');const {pathToFileURL}=require('node:url');
const {launchCleanup,assertResetSafety}=require('./reset');
const {WindowNudge}=require('./nudge');
const {configureOfflineBrowser}=require('./privacy');
configureOfflineBrowser(app);
const {customAvatar,importAvatar,removeAvatar}=require('./profile');
const {readAppearance,supportsAcrylic}=require('./appearance');
const {validateChats}=require('../renderer/conversations');
const acrylicAvailable=supportsAcrylic(process.platform,require('node:os').release());let windowMaterial='solid';
const {DEFAULTS,validateSettings,readJSON,writeJSON,choosePlan}=require('./core');const {inspect,voices}=require('./hardware');const {Engine}=require('./engine');const {setup}=require('./setup');
// All app-managed persistent files, including Electron cache and session data, live here.
const root=path.join(app.getPath('appData'),'CandyLocal');
app.setPath('userData',root);app.setPath('sessionData',path.join(root,'session'));app.setAppLogsPath(path.join(root,'logs'));
const locked=app.requestSingleInstanceLock();if(!locked)app.quit();
let win,windowNudge,engine,hardware,install,settings,chats,setupController,speech,quitting=false,busy=false,resetting=false,setupTask=null,chatTask=null,chatCancelled=false;
const notify=data=>{if(win&&!win.isDestroyed())win.webContents.send('candy-event',data);};
function stopSpeech(){if(speech){speech.kill();speech=null;}}
function saveChats(value){if(busy)throw new Error('Finish or stop the current reply first.');validateChats(value,chats);writeJSON(path.join(root,'chats.json'),value);chats=value;}
function register(){
 const handle=(name,fn)=>ipcMain.handle(name,async(e,...args)=>{if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw new Error('Invalid caller.');if(resetting)throw new Error('Candy is clearing its data and closing.');return fn(...args);});
 handle('load',()=>({settings,chats,installation:install,root,platform:process.platform,version:app.getVersion(),windowMaterial,appearance:readAppearance(systemPreferences),customAvatar:customAvatar(root)}));
 handle('nudge',options=>windowNudge?.start({reducedMotion:options?.reducedMotion!==false})||{mode:'none'});
 handle('appearance',()=>readAppearance(systemPreferences));
 handle('hardware',async()=>{hardware=await inspect();return {...hardware,plan:choosePlan(hardware,settings)};});
 handle('voices',()=>voices());
 handle('save-settings',s=>{settings=validateSettings(s);nativeTheme.themeSource=settings.theme;writeJSON(path.join(root,'settings.json'),settings);return settings;});
 handle('save-chats',c=>saveChats(c));
 handle('setup',()=>{
  if(setupTask||busy)throw new Error('Stop the current operation first.');
  setupTask=(async()=>{hardware=await inspect();if(resetting)throw new Error('Candy is closing.');setupController=new AbortController();try{
   await engine.stopProcess();install=await setup(root,hardware,settings,setupController.signal,p=>notify({type:'setup',...p}));
   notify({type:'setup',phase:'test',percent:99,detail:'Loading the model and checking the local engine…'});
   setupController.signal.addEventListener('abort',()=>engine.cancel(),{once:true});setupController.signal.throwIfAborted();
   await engine.start(install,hardware);setupController.signal.throwIfAborted();
   notify({type:'setup',phase:'done',percent:100,detail:'Local engine verified. Candy is ready.'});return install;
  }catch(e){if(setupController?.signal.aborted)throw new Error('Setup cancelled. Temporary downloads were removed.');throw e;}finally{setupController=null;}})();
  return setupTask.finally(()=>{setupTask=null;});
 });
 handle('cancel-setup',()=>setupController?.abort());
 handle('chat',(id)=>{
  if(busy||setupTask)throw new Error('Please wait for the current operation.');if(!install)throw new Error('Set up Candy first.');const c=chats.find(x=>x.id===id);if(!c||!c.messages.length)throw new Error('Conversation not found.');busy=true;chatCancelled=false;
  chatTask=(async()=>{try{
   hardware||=await inspect();if(resetting)throw new Error('Candy is closing.');if(chatCancelled)return {text:'',stopped:true};
   await engine.start(install,hardware);if(resetting)throw new Error('Candy is closing.');if(chatCancelled)return {text:'',stopped:true};
   const result=await engine.chat(c.messages,settings,()=>{});
   if(result.text&&!result.stopped&&!chatCancelled&&!resetting){c.messages.push({role:'assistant',content:result.text,time:new Date().toISOString(),stopped:result.stopped});writeJSON(path.join(root,'chats.json'),chats);}return result;
  }catch(e){if(chatCancelled&&!resetting)return {text:'',stopped:true};throw e;}})();
  return chatTask.finally(()=>{busy=false;chatTask=null;});
 });
 handle('stop',()=>{chatCancelled=true;engine.cancel();});
 handle('stop-speech',()=>stopSpeech());
 handle('speak',async(text)=>{if(process.platform!=='win32')throw new Error('Windows voices are available in the Windows app.');if(typeof text!=='string'||!text.trim())return;stopSpeech();
  const data=Buffer.from(JSON.stringify({text:text.slice(0,12000),voice:settings.voice,rate:settings.rate}),'utf8').toString('base64');
  const script=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Speech; $d=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; if($d.voice){$s.SelectVoice($d.voice)}; $s.Rate=[int]$d.rate; $s.Speak($d.text); $s.Dispose()`;
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,stdio:['ignore','ignore','pipe']});speech=child;let err='';child.stderr.on('data',b=>err+=b);child.on('error',e=>notify({type:'speech-error',message:e.message}));child.on('exit',code=>{if(speech===child)speech=null;if(code&&err)notify({type:'speech-error',message:'Windows could not speak with this voice. Choose another installed voice.'});});
 });
 handle('export-chat',async(id)=>{const c=chats.find(x=>x.id===id);if(!c)throw new Error('Conversation not found.');const r=await dialog.showSaveDialog(win,{title:'Export conversation',defaultPath:'Candy-conversation.json',filters:[{name:'JSON',extensions:['json']}]});if(!r.canceled&&!resetting){writeJSON(r.filePath,{app:'Candy',exportedAt:new Date().toISOString(),conversation:c});return true;}return false;});
 handle('choose-avatar',async()=>{
  const r=await dialog.showOpenDialog(win,{title:'Choose your Candy profile picture',properties:['openFile'],filters:[{name:'PNG or JPEG image',extensions:['png','jpg','jpeg']}]});
  if(resetting)throw new Error('Candy is closing.');if(r.canceled||!r.filePaths[0])return null;
  const stat=fs.statSync(r.filePaths[0]);if(!stat.isFile()||stat.size>10*1024**2)throw new Error('Choose a PNG or JPEG smaller than 10 MB.');
  const dataUrl=importAvatar(root,fs.readFileSync(r.filePaths[0]),nativeImage);settings=validateSettings({...settings,userAvatar:'custom'});writeJSON(path.join(root,'settings.json'),settings);return {dataUrl,settings};
 });
 handle('remove-avatar',()=>{removeAvatar(root);if(settings.userAvatar==='custom')settings=validateSettings({...settings,userAvatar:'initial'});writeJSON(path.join(root,'settings.json'),settings);return {settings};});
 handle('reset',async(confirmation)=>{
  if(confirmation!=='DELETE ALL CANDY DATA')throw new Error('Reset confirmation required.');
  const protectedPaths=[app.getPath('exe'),process.env.PORTABLE_EXECUTABLE_FILE].filter(Boolean);
  assertResetSafety(root,protectedPaths);resetting=true;windowNudge?.cancel();win.setClosable(false);
  try{
   // Cleanup is detached and waits until this app (and its file locks) has exited.
   setupController?.abort();stopSpeech();engine.cancel();await engine.stopProcess();
   await Promise.all([setupTask?.catch(()=>{}),chatTask?.catch(()=>{})]);
   await engine.stopProcess();
   await session.defaultSession.clearStorageData();await session.defaultSession.clearCache();
   await launchCleanup({root,execPath:app.getPath('exe'),protectedPaths});
   app.exit(0); // Never relaunch. The helper removes the entire owned folder.
  }catch(e){resetting=false;if(win&&!win.isDestroyed())win.setClosable(true);throw e;}
 });
 handle('window',action=>{windowNudge?.cancel();if(action==='minimize')win.minimize();if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();if(action==='close')win.close();});
}
if(locked){
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(()=>{
  fs.mkdirSync(root,{recursive:true});fs.mkdirSync(path.join(root,'crash-dumps'),{recursive:true});app.setPath('crashDumps',path.join(root,'crash-dumps'));settings=validateSettings(readJSON(path.join(root,'settings.json'),DEFAULTS));chats=readJSON(path.join(root,'chats.json'),[]);if(!Array.isArray(chats))chats=[];install=readJSON(path.join(root,'installation.json'),null);engine=new Engine(root,notify);nativeTheme.themeSource=settings.theme;register();
  app.setAppUserModelId('local.candy.companion');
  if(process.platform==='win32')systemPreferences.on('accent-color-changed',()=>notify({type:'appearance',...readAppearance(systemPreferences)}));
  // The renderer cannot access any network, even if a model response contains a URL.
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{let u;try{u=new URL(details.url);}catch{return callback({cancel:true});}callback({cancel:!['file:','data:','devtools:'].includes(u.protocol)});});
  session.defaultSession.setPermissionRequestHandler((_,__,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  win=new BrowserWindow({width:1360,height:900,minWidth:940,minHeight:660,frame:false,backgroundColor:acrylicAvailable?'#00000000':'#f5f7f8',show:false,icon:path.join(__dirname,'../assets/candy.ico'),webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false}});
  windowNudge=new WindowNudge(win,screen);
  for(const event of ['blur','close','minimize','maximize','enter-full-screen'])win.on(event,()=>windowNudge?.cancel());
  win.on('resize',()=>windowNudge?.cancel(false));
  if(acrylicAvailable){try{win.setBackgroundMaterial('acrylic');windowMaterial='acrylic';}catch{win.setBackgroundColor('#f5f7f8');}}
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));const entry=pathToFileURL(path.join(__dirname,'../renderer/index.html')).href;
  win.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault();});win.loadURL(entry);win.once('ready-to-show',()=>win.show());win.on('closed',()=>{win=null;app.quit();});
 });
 app.on('before-quit',e=>{if(quitting)return;e.preventDefault();quitting=true;windowNudge?.cancel();setupController?.abort();stopSpeech();engine?.cancel();Promise.resolve(engine?.stopProcess()).finally(()=>app.quit());});
 app.on('window-all-closed',()=>app.quit());
 process.on('uncaughtException',e=>{dialog.showErrorBox('Candy needs a restart',e.message);app.quit();});
}
