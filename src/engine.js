'use strict';
const fs=require('node:fs');const path=require('node:path');const net=require('node:net');const crypto=require('node:crypto');const {spawn}=require('node:child_process');
const {sampling}=require('./conversation');
const {systemPrompt,contextMessages}=require('./core');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
function findFile(dir,name){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isFile()&&e.name===name)return p;if(e.isDirectory()){const found=findFile(p,name);if(found)return found;}}return null;}
class Engine {
 constructor(root,notify){this.root=root;this.notify=notify;this.child=null;this.active=null;this.starting=null;this.base=null;this.key=crypto.randomBytes(32).toString('hex');this.tail='';this.cancelledStart=false;}
 async start(config,hardware){if(this.base)return;if(this.starting)return this.starting;this.starting=this._start(config,hardware).finally(()=>{this.starting=null;});return this.starting;}
 async _start(config,hardware){
  this.cancelledStart=false;
  const exe=findFile(path.join(this.root,'runtime'),'llama-server.exe');if(!exe)throw new Error('Local runtime is missing. Run Setup Candy again.');
  const model=path.join(this.root,'models',config.modelFile);if(!fs.existsSync(model))throw new Error('Model file is missing. Run Setup Candy again.');
  this.notify({type:'engine',status:'loading'});
  try{await this.launch(exe,model,config.backend,hardware);}catch(e){
   await this.stopProcess();
   if(this.cancelledStart)throw new Error('Reply stopped while the model was loading.');
   if(config.backend==='cpu'){this.notify({type:'engine',status:'error'});throw e;}
   this.notify({type:'engine',status:'loading',note:'GPU unavailable; trying the bundled CPU backend.'});
   try{await this.launch(exe,model,'cpu',hardware);this.notify({type:'engine',status:'ready',note:'Running on CPU (GPU fallback).'});}catch(err){await this.stopProcess();this.notify({type:'engine',status:'error'});throw err;}
  }
 }
 async launch(exe,model,backend,h){
  const port=await freePort();if(this.cancelledStart)throw new Error('Model loading cancelled.');this.tail='';this.base=null;
  const args=['--model',model,'--host','127.0.0.1','--port',String(port),'--ctx-size','4096','--parallel','1','--threads',String(Math.max(1,Math.min(8,(h.cores||4)-1))),'--n-gpu-layers',backend==='cpu'?'0':'99','--api-key',this.key,'--no-webui'];
  const child=spawn(exe,args,{cwd:path.dirname(exe),windowsHide:true,stdio:['ignore','pipe','pipe']});this.child=child;let failure=null;
  child.stdout.on('data',b=>{this.tail=(this.tail+b.toString()).slice(-6000);});child.stderr.on('data',b=>{this.tail=(this.tail+b.toString()).slice(-6000);});
  child.on('error',e=>{failure=e;});child.on('exit',code=>{failure=new Error(`Local engine exited (${code}). ${this.tail.slice(-700)}\nIf Windows reports a missing VCRUNTIME DLL, install the Microsoft Visual C++ 2015–2022 x64 Redistributable. You can also select CPU compatibility in Settings and run Setup again.`);if(this.child===child){this.child=null;this.base=null;this.notify({type:'engine',status:'stopped'});}});
  for(let i=0;i<300;i++){
   if(this.cancelledStart)throw new Error('Model loading cancelled.');if(failure)throw failure;
   try{const r=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Authorization:`Bearer ${this.key}`},signal:AbortSignal.timeout(1500)});if(r.ok){this.base=`http://127.0.0.1:${port}`;this.notify({type:'engine',status:'ready',backend});return;}}catch{}
   await wait(500);
  }throw new Error('The model took too long to load. Try the smaller model or CPU compatibility in Settings.');
 }
 async fitContext(messages,settings,signal){
  const turns=contextMessages(messages);const system={role:'system',content:systemPrompt(settings,messages)};
  const local=async(route,body)=>{const r=await fetch(this.base+route,{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Local context preparation failed (HTTP ${r.status}). Run Setup Candy again.`);return r.json();};
  for(let i=0;i<24;i++){
   const all=[system,...turns];const formatted=await local('/apply-template',{messages:all,chat_template_kwargs:{enable_thinking:false}});
   if(typeof formatted.prompt!=='string')throw new Error('The local runtime returned an invalid chat template.');
   const tokenized=await local('/tokenize',{content:formatted.prompt,add_special:true});
   if(!Array.isArray(tokenized.tokens))throw new Error('The local runtime returned an invalid token count.');
   if(tokenized.tokens.length<=3000)return all;
   if(turns.length>1){turns.shift();while(turns[0]?.role==='assistant')turns.shift();}
   else if(turns[0]?.content.length>200){turns[0].content=turns[0].content.slice(-Math.floor(turns[0].content.length*.7));this.notify({type:'context',note:'This message was shortened for the local model’s context window. The complete text is still saved in your chat.'});}
   else throw new Error('This message could not fit the local model context. Try a shorter message.');
  }throw new Error('Please shorten this message and try again.');
 }
 async chat(messages,settings,onToken){
  if(!this.base)throw new Error('Candy is not ready yet.');if(this.active)throw new Error('A reply is already in progress.');
  const ac=new AbortController();this.active=ac;let result='';
  try{
   const fitted=await this.fitContext(messages,settings,ac.signal);
   const r=await fetch(this.base+'/v1/chat/completions',{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.key}`},body:JSON.stringify({messages:fitted,stream:true,chat_template_kwargs:{enable_thinking:false},max_tokens:768,...sampling(settings)})});
   if(!r.ok)throw new Error(`Local model returned HTTP ${r.status}. Try a new conversation or restart Candy.`);
   const decoder=new TextDecoder();let buffer='';
   for await(const chunk of r.body){buffer+=decoder.decode(chunk,{stream:true});let newline;while((newline=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);if(!line.startsWith('data:'))continue;const text=line.slice(5).trim();if(text==='[DONE]')continue;let j;try{j=JSON.parse(text);}catch{continue;}const t=j.choices?.[0]?.delta?.content;if(typeof t==='string'){result+=t;onToken(t);}}}
   return {text:result,stopped:false};
  }catch(e){if(ac.signal.aborted)return {text:result,stopped:true};throw e;}finally{this.active=null;}
 }
 cancel(){this.active?.abort();if(this.starting){this.cancelledStart=true;this.child?.kill();}}
 async stopProcess(){this.active?.abort();const c=this.child;this.base=null;if(!c)return;await new Promise(resolve=>{const t=setTimeout(resolve,5000);c.once('exit',()=>{clearTimeout(t);resolve();});c.kill();});this.child=null;}
}
module.exports={Engine,findFile};
