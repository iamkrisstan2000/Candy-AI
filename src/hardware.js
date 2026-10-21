'use strict';
const os=require('node:os');const {execFile}=require('node:child_process');
function ps(script,{timeout=30000}={}){return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "+script,'utf16le').toString('base64')],{windowsHide:true,timeout,maxBuffer:2*1024**2},(e,out,err)=>e?reject(new Error((err||e.message).slice(0,1000))):resolve(out.trim())));}
async function inspect(){
 const base={platform:process.platform,arch:process.arch,gpus:[],cpu:os.cpus()[0]?.model||'Unknown CPU',cores:os.cpus().length,ramGB:Math.round(os.totalmem()/1024**3)};
 if(process.platform!=='win32')return base;
 // Query graphics adapters first, then the processor and memory.
 try{const g=JSON.parse(await ps("@(Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion) | ConvertTo-Json -Compress"));base.gpus=(Array.isArray(g)?g:[g]).filter(Boolean).map(x=>({name:x.Name,vramGB:Math.round(Number(x.AdapterRAM||0)/1024**3),driver:x.DriverVersion}));}catch{base.gpuWarning='Graphics detection failed; CPU mode is available.';}
 try{const c=JSON.parse(await ps("$c=Get-CimInstance Win32_Processor | Select-Object -First 1; $m=Get-CimInstance Win32_ComputerSystem; @{name=$c.Name;cores=$c.NumberOfLogicalProcessors;ram=$m.TotalPhysicalMemory} | ConvertTo-Json -Compress"));base.cpu=c.name;base.cores=c.cores;base.ramGB=Math.round(Number(c.ram)/1024**3);}catch{}
 return base;
}
async function voices(){if(process.platform!=='win32')return [];try{let v=JSON.parse(await ps("Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; @($s.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { @{name=$_.VoiceInfo.Name;culture=$_.VoiceInfo.Culture.Name} }) | ConvertTo-Json -Compress; $s.Dispose()"));return (Array.isArray(v)?v:[v]).filter(Boolean);}catch{return [];}}
module.exports={ps,inspect,voices};
