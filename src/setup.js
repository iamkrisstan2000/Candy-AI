'use strict';
const fs=require('node:fs');const path=require('node:path');const extract=require('extract-zip');
const {choosePlan,sha256,writeJSON,safeEntry}=require('./core');const {download}=require('./network');const manifest=require('./runtime-manifest.json');
async function setup(root,hardware,settings,signal,progress){
 const plan=choosePlan(hardware,settings);if(!plan.supported)throw new Error('Candy currently needs Windows 11 x64 with at least 4 GB RAM. ARM64 is not supported in this build.');
 const temp=path.join(root,'temporary');fs.rmSync(temp,{recursive:true,force:true});fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(path.join(root,'models'),{recursive:true});
 const stat=fs.statfsSync(root);if(Number(stat.bavail)*Number(stat.bsize)<plan.diskBytes)throw new Error('Not enough free disk space. Allow at least '+Math.ceil(plan.diskBytes/1024**3)+' GB for this setup.');
 const model=plan.model;const runtime=manifest.assets.find(a=>a.name.includes('-'+plan.backend+'-'));
 const totalBytes=runtime.size+manifest.vclibs.size+model.bytes;let completed=0;
 const report=(phase,detail,extra={})=>progress({phase,detail,percent:Math.min(99,Math.round(completed/totalBytes*100)),...extra});
 try{
  signal.throwIfAborted();report('runtime','Downloading the local AI runtime…');
  const zip=path.join(temp,'runtime.zip');await download(runtime.url,zip,{signal,expectedBytes:runtime.size,onProgress:p=>progress({phase:'runtime',detail:'Downloading the local AI runtime…',percent:Math.round((completed+p.bytes)/totalBytes*100),bytes:completed+p.bytes,total:totalBytes})});
  report('verify','Verifying runtime SHA-256…');if(await sha256(zip)!==runtime.sha256)throw new Error('Runtime integrity check failed. Nothing was installed.');signal.throwIfAborted();
  report('install','Unpacking the runtime…');const staging=path.join(temp,'runtime');
  await extract(zip,{dir:staging,onEntry:e=>{if(!safeEntry(e.fileName)||(e.externalFileAttributes>>>16&0o170000)===0o120000)throw new Error('Unsafe entry in runtime archive.');}});
  signal.throwIfAborted();completed+=runtime.size;
  report('dependencies','Downloading Microsoft app-local C++ runtime…');
  const vc=path.join(temp,'vclibs.zip');await download(manifest.vclibs.url,vc,{signal,expectedBytes:manifest.vclibs.size,onProgress:p=>progress({phase:'dependencies',detail:'Downloading Microsoft app-local C++ runtime…',percent:Math.round((completed+p.bytes)/totalBytes*100)})});
  if(await sha256(vc)!==manifest.vclibs.sha256)throw new Error('Microsoft runtime integrity check failed.');signal.throwIfAborted();
  const vcDir=path.join(temp,'vclibs');await extract(vc,{dir:vcDir,onEntry:e=>{if(!safeEntry(e.fileName))throw new Error('Unsafe dependency archive.');}});
  for(const name of ['msvcp140.dll','msvcp140_1.dll','msvcp140_2.dll','msvcp140_atomic_wait.dll','msvcp140_codecvt_ids.dll','vcruntime140.dll','vcruntime140_1.dll','concrt140.dll'])fs.copyFileSync(path.join(vcDir,name),path.join(staging,name));
  completed+=manifest.vclibs.size;

  const modelPath=path.join(root,'models',model.file);let reusable=false;
  if(fs.existsSync(modelPath)&&fs.statSync(modelPath).size===model.bytes){report('verify','Checking the existing local model…');reusable=(await sha256(modelPath))===model.sha256;}
  if(!reusable){const part=path.join(temp,model.file+'.part');report('model',`Downloading ${model.name} (${(model.bytes/1e9).toFixed(2)} GB)…`);await download(`https://huggingface.co/${model.repo}/resolve/main/${model.file}`,part,{signal,expectedBytes:model.bytes,onProgress:p=>progress({phase:'model',detail:`Downloading ${model.name}…`,percent:Math.round((completed+p.bytes)/totalBytes*100),bytes:completed+p.bytes,total:totalBytes})});
   report('verify','Verifying model SHA-256. This may take a moment…');if(await sha256(part)!==model.sha256)throw new Error('Model integrity check failed. Please retry Setup Candy.');signal.throwIfAborted();fs.rmSync(modelPath,{force:true});fs.renameSync(part,modelPath);
  }
  signal.throwIfAborted();report('install','Finishing the local installation…');
  const runtimeDir=path.join(root,'runtime');fs.rmSync(runtimeDir,{recursive:true,force:true});fs.renameSync(staging,runtimeDir);
  const config={modelFile:model.file,modelName:model.name,backend:plan.backend,runtime:manifest.version,installedAt:new Date().toISOString()};
  writeJSON(path.join(root,'installation.json'),config);progress({phase:'done',percent:100,detail:'All set! Candy is ready to meet you.'});return config;
 }finally{fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:250});}
}
module.exports={setup};
