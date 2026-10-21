'use strict';
const path=require('node:path'),os=require('node:os'),fs=require('node:fs');const {spawn}=require('node:child_process');
function assertResetSafety(root,protectedPaths=[]){
 const resolved=path.resolve(root);if(!path.isAbsolute(root)||path.basename(resolved).toLowerCase()!=='candylocal'||resolved.length<12)throw new Error('Refusing to reset an unexpected data folder.');
 const real=p=>{try{return fs.realpathSync.native(p);}catch{return path.resolve(p);}};
 const inside=(folder,file)=>{const relative=path.relative(folder,file);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
 for(const file of protectedPaths.filter(Boolean))if(inside(resolved,path.resolve(file))||inside(real(resolved),real(file)))throw new Error('The Candy program is inside its data folder. Move the EXE or installed program outside '+resolved+' before resetting. Candy will not delete its own program.');
 return resolved;
}
async function cleanupWorker(config){
 const fs=require('node:fs'),path=require('node:path');const pause=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  // No Electron initialization: run-as-Node never creates a new app-data profile.
  process.stdout.write('CANDY_RESET_HELPER_READY\n');
  const deadline=Date.now()+60000;
  while(true){let alive=true;try{process.kill(config.parentPid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}if(!alive)break;if(Date.now()>deadline)throw new Error('Candy did not finish closing.');await pause(100);}
  // fs.rm removes directory links themselves, rather than following their targets.
  fs.rmSync(config.root,{recursive:true,force:true,maxRetries:12,retryDelay:250});
  if(fs.existsSync(config.root))throw new Error('The data folder could not be fully removed.');
 }catch(error){
  if(process.platform==='win32'&&config.notifyFailures){
   const message='Candy closed, but could not finish removing its local data. Close programs using the folder and delete only this folder manually:\n'+config.root+'\n\n'+error.message;
   const data=Buffer.from(message,'utf8').toString('base64');
   const ps=`Add-Type -AssemblyName System.Windows.Forms; $m=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')); [Windows.Forms.MessageBox]::Show($m,'Candy reset needs attention','OK','Error') | Out-Null`;
   try{require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{windowsHide:true,timeout:120000,stdio:'ignore'});}catch{}
  }
  process.exitCode=1;
 }
}
function cleanupScript(root,parentPid,protectedPaths=[],notifyFailures=true){const safe=assertResetSafety(root,protectedPaths);if(!Number.isInteger(parentPid)||parentPid<=0)throw new Error('Invalid parent process.');return `(${cleanupWorker.toString()})(${JSON.stringify({root:safe,parentPid,notifyFailures})});`;}
async function launchCleanup({root,parentPid=process.pid,execPath=process.execPath,protectedPaths=[]}){
 const script=cleanupScript(root,parentPid,[execPath,...protectedPaths]);
 const child=spawn(execPath,['-e',script],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},cwd:os.tmpdir(),detached:true,windowsHide:true,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{let out='',err='';const timer=setTimeout(()=>{child.kill();reject(new Error('The reset helper could not start. Your chats, settings and models were not deleted.'));},7000);
  const done=()=>{clearTimeout(timer);child.stdout.destroy();child.stderr.destroy();child.unref();resolve();};
  child.stdout.on('data',b=>{out+=b.toString();if(out.includes('CANDY_RESET_HELPER_READY'))done();});child.stderr.on('data',b=>{err=(err+b.toString()).slice(-1000);});
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);if(!out.includes('CANDY_RESET_HELPER_READY'))reject(new Error('Reset helper exited before cleanup was ready. '+err));});
 });
}
module.exports={assertResetSafety,cleanupScript,launchCleanup};
