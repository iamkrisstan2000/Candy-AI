'use strict';
// This module is used ONLY by the user-initiated setup operation.
const https=require('node:https');
const fs=require('node:fs');
const {pipeline}=require('node:stream/promises');
function allowed(url){const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(['github.com','api.github.com','huggingface.co','download.microsoft.com'].includes(u.hostname)||['githubusercontent.com','hf.co','huggingface.co','xethub.hf.co'].some(d=>u.hostname.endsWith('.'+d)));}
function request(url,signal,depth=0){return new Promise((resolve,reject)=>{
 if(depth>8||!allowed(url))return reject(new Error('Download redirect was blocked for safety.'));
 const req=https.get(url,{signal,headers:{'User-Agent':'Candy-Local/1.0','Accept':'application/octet-stream'},timeout:90000},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){res.resume();return request(new URL(res.headers.location,url).href,signal,depth+1).then(resolve,reject);}
  if(res.statusCode!==200){res.resume();return reject(new Error(`Download failed (HTTP ${res.statusCode}). Please retry Setup Candy.`));}resolve(res);
 });req.on('timeout',()=>req.destroy(new Error('Download timed out. Check your connection and retry.')));req.on('error',reject);
});}
async function download(url,file,{signal,onProgress=()=>{},expectedBytes}={}){
 const res=await request(url,signal);let bytes=0;const total=expectedBytes||Number(res.headers['content-length'])||0;let last=0;
 res.on('data',chunk=>{bytes+=chunk.length;if(Date.now()-last>180){last=Date.now();onProgress({bytes,total});}});
 try{await pipeline(res,fs.createWriteStream(file,{mode:0o600}),{signal});if(total&&bytes!==total)throw new Error('The download is incomplete. Please retry.');onProgress({bytes,total});}
 catch(e){fs.rmSync(file,{force:true});throw e;}
}
module.exports={allowed,download};
