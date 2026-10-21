'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {conversationRules}=require('./conversation');
const {sceneSettings}=require('../renderer/theme');
const {guidance}=require('../renderer/personas');
const {candyId,userId}=require('../renderer/avatars');
const MODELS = {
  small: {id:'small', name:'Qwen 2.5 · 1.5B', file:'qwen2.5-1.5b-instruct-q4_k_m.gguf', repo:'Qwen/Qwen2.5-1.5B-Instruct-GGUF', bytes:1117320736, sha256:'6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e'},
  balanced: {id:'balanced', name:'Qwen 3 · 4B', file:'Qwen3-4B-Q4_K_M.gguf', repo:'Qwen/Qwen3-4B-GGUF', bytes:2497280256, sha256:'7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5'}
};
const DEFAULTS = Object.freeze({persona:'friendly', humor:50, voice:'', speak:false, chatSounds:true, rate:0, theme:'light', scene:'windows', accentSource:'windows', candyAvatar:'candy', userAvatar:'initial', bubbleStyle:'outlined', sidebarCollapsed:false, model:'auto', backend:'auto'});
function validateSettings(s={}) {
 const personas=['friendly','thoughtful','creative','focused'];
 return {persona:personas.includes(s.persona)?s.persona:'friendly', humor:Math.max(0,Math.min(100,Number.isFinite(Number(s.humor))?Number(s.humor):50)), voice:typeof s.voice==='string'?s.voice.slice(0,200):'', speak:s.speak===true, chatSounds:s.chatSounds!==false, rate:Math.max(-3,Math.min(3,Number.isFinite(Number(s.rate))?Number(s.rate):0)), theme:['light','dark','system'].includes(s.theme)?s.theme:'light', ...sceneSettings(s), candyAvatar:candyId(s.candyAvatar,s.persona), userAvatar:userId(s.userAvatar), bubbleStyle:['outlined','solid','fruit','metro'].includes(s.bubbleStyle)?s.bubbleStyle:'outlined', sidebarCollapsed:s.sidebarCollapsed===true, model:['auto','small','balanced'].includes(s.model)?s.model:'auto', backend:['auto','cpu'].includes(s.backend)?s.backend:'auto'};
}
function choosePlan(h, settings=DEFAULTS) {
 const model=MODELS[settings.model==='auto'?(h.ramGB>=12?'balanced':'small'):settings.model]||MODELS.small;
 const gpu=(h.gpus||[]).find(x=>/nvidia|radeon|intel.*(arc|iris|uhd)|amd/i.test(x.name)&&!/basic display|remote|virtual/i.test(x.name));
 return {model, backend:settings.backend!=='cpu'&&gpu?'vulkan':'cpu', gpu:gpu?.name||null, diskBytes:model.bytes+650*1024**2, supported:h.platform==='win32'&&h.arch==='x64'&&h.ramGB>=4};
}
function systemPrompt(s,messages=[]) {
 return `You are Candy, a private AI companion running entirely on the user's PC. ${conversationRules(messages,s)}
${guidance(s.persona,s.humor)} Respond naturally as in a friendly messenger, without pretending to be human. Be honest about uncertainty. You cannot browse the web, access files, run commands, or control the PC. Do not claim to perform those actions. Never claim to remember information outside the conversation. Use the language the user uses. Keep answers reasonably short unless asked for detail.`;
}
function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJSON(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(temp,file);}
async function sha256(file) {const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
function safeEntry(name){return !name.includes('\\')&&!path.posix.isAbsolute(name)&&!name.split('/').includes('..')&&!/^[a-z]:/i.test(name);}
function contextMessages(messages,maxChars=8500) {
 const result=[];let chars=0;
 for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(!['user','assistant'].includes(m.role)||!m.content||m.error)continue;const text=m.content.slice(-7000);if(chars+text.length>maxChars&&result.length)break;result.unshift({role:m.role,content:text});chars+=text.length;}
 while(result[0]?.role==='assistant')result.shift();return result;
}
module.exports={MODELS,DEFAULTS,validateSettings,choosePlan,systemPrompt,readJSON,writeJSON,sha256,safeEntry,contextMessages};
