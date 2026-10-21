/* Original offline Candy cues. Synthesis only: no files, network or recordings. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CandySounds=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MASTER_GAIN=.16;
 const note=(frequency,endFrequency,start,duration,gain)=>Object.freeze({frequency,endFrequency,start,duration,gain});
 const CUES=Object.freeze({
  sent:Object.freeze([note(740,830,0,.14,.36),note(1480,1660,.006,.10,.035)]),
  received:Object.freeze([note(659.25,659.25,0,.19,.30),note(783.99,783.99,.085,.23,.27),note(1567.98,1567.98,.09,.14,.025)]),
  nudge:Object.freeze([note(440,493.88,0,.17,.28),note(659.25,659.25,.075,.19,.25),note(880,830.61,.15,.25,.23),note(1760,1661.22,.155,.14,.025)])
 });
 function scheduleCue(context,kind,destination,at=context.currentTime,track=()=>{}){
  const notes=CUES[kind];if(!notes)return [];
  return notes.map(n=>{
   const oscillator=context.createOscillator(),envelope=context.createGain(),start=at+n.start,end=start+n.duration;
   oscillator.type='sine';oscillator.frequency.setValueAtTime(n.frequency,start);oscillator.frequency.exponentialRampToValueAtTime(n.endFrequency,end);
   envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(n.gain,start+.009);envelope.gain.exponentialRampToValueAtTime(.0001,end);
   oscillator.connect(envelope);envelope.connect(destination);
   const voice={oscillator,envelope};track(voice);oscillator.start(start);oscillator.stop(end+.02);return voice;
  });
 }
 class CuePlayer{
  constructor({makeContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),now=()=>performance.now()}={}){
   this.makeContext=makeContext;this.now=now;this.enabled=false;this.context=null;this.master=null;this.voices=new Set();this.epoch=0;this.disposed=false;this.last=-Infinity;
  }
  setEnabled(value){
   const enabled=value===true;if(this.enabled===enabled)return;
   this.enabled=enabled;
   if(!enabled)this.stop();
   else if(this.master&&this.context?.state!=='closed')this.master.gain.setTargetAtTime(MASTER_GAIN,this.context.currentTime,.006);
  }
  async unlock(){
   if(!this.enabled||this.disposed)return false;
   try{
    if(!this.context||this.context.state==='closed'){
     this.context=this.makeContext();this.master=this.context.createGain();this.master.gain.value=MASTER_GAIN;this.master.connect(this.context.destination);
    }
    const context=this.context,epoch=this.epoch;
    if(context.state!=='running')await context.resume();
    return this.enabled&&!this.disposed&&this.context===context&&this.epoch===epoch&&context.state==='running';
   }catch{return false;}
  }
  async play(kind){
   if(!CUES[kind]||!this.enabled||this.disposed)return false;
   const epoch=this.epoch;
   if(!await this.unlock()||epoch!==this.epoch||!this.enabled)return false;
   if(this.now()-this.last<100)return false;
   this.last=this.now();
   try{
    this.master.gain.setTargetAtTime(MASTER_GAIN,this.context.currentTime,.006);
    scheduleCue(this.context,kind,this.master,this.context.currentTime+.006,voice=>{
     this.voices.add(voice);
     voice.oscillator.onended=()=>{this.voices.delete(voice);try{voice.oscillator.disconnect();voice.envelope.disconnect();}catch{}};
    });return true;
   }catch{this.stop();return false;}
  }
  stop(){
   this.epoch++;
   const time=this.context?.currentTime||0;
   try{this.master?.gain.cancelScheduledValues(time);this.master?.gain.setTargetAtTime(0,time,.004);}catch{}
   for(const voice of this.voices){try{voice.oscillator.stop(time+.015);}catch{};try{voice.oscillator.disconnect();voice.envelope.disconnect();}catch{}}
   this.voices.clear();
  }
  close(){
   this.stop();const context=this.context;this.context=null;this.master=null;
   try{Promise.resolve(context?.close()).catch(()=>{});}catch{}
  }
  dispose(){this.disposed=true;this.close();}
 }
 return {MASTER_GAIN,CUES,scheduleCue,CuePlayer};
});
