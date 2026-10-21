/* Shared, deterministic color system. No OS access, network calls or DOM required. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CandyTheme=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SCENES={windows:{name:'Windows',accent:'#0078d4',sun:'#b9dbff'},meadow:{name:'Meadow',accent:'#287b69',sun:'#eedca3'},lavender:{name:'Daydream',accent:'#7954b3',sun:'#d4c3f1'},sunset:{name:'Golden hour',accent:'#b45b27',sun:'#f6c67f'},ocean:{name:'Ocean breeze',accent:'#167da4',sun:'#c1e7ec'},rose:{name:'Rose garden',accent:'#b04f79',sun:'#f7cee0'},aurora:{name:'Northern lights',accent:'#277e81',sun:'#beedda'},beach:{name:'Beach day',accent:'#008c9e',sun:'#ffc968'},sakura:{name:'Sakura breeze',accent:'#be4b85',sun:'#ffe5ee'},matrix:{name:'Matrix',accent:'#16804a',sun:'#99ffc4'}};
 function sceneSettings(s={}){const scene=s.accentSource==='windows'?'windows':Object.hasOwn(SCENES,s.scene)?s.scene:'windows';return {scene,accentSource:scene==='windows'?'windows':'scene'};}
 function hex(value){return typeof value==='string'&&/^#?[\da-f]{6}$/i.test(value)?'#'+value.replace('#','').toLowerCase():null;}
 function rgb(value){const h=hex(value);if(!h)throw new Error('Invalid color');return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
 function color(channels){return '#'+channels.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
 function mix(a,b,weight){const x=rgb(a),y=rgb(b);return color(x.map((v,i)=>v+(y[i]-v)*weight));}
 function luminance(value){const c=rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function ensureContrast(foreground,background,min=4.5){if(contrast(foreground,background)>=min)return foreground;const target=contrast('#000000',background)>contrast('#ffffff',background)?'#000000':'#ffffff';for(let i=1;i<=100;i++){const c=mix(foreground,target,i/100);if(contrast(c,background)>=min)return c;}return target;}
 function palette({dark=false,scene='windows',accentSource='scene',windowsAccent=null}={}){
  const definition=SCENES[scene]||SCENES.windows;
  const usesWindows=(scene==='windows'||accentSource==='windows')&&!!hex(windowsAccent);
  const raw=usesWindows?hex(windowsAccent):definition.accent;
  const surface=dark?'#202529':'#ffffff';
  // The window frame stays neutral; scene/device hues belong to the content and controls.
  const sidebar=dark?'#1a1e22':'#f3f5f7';
  const tint=dark?mix(surface,raw,.19):mix('#ffffff',raw,.085);
  const sceneBg=dark?mix('#242a31',raw,.18):mix('#ffffff',raw,.125);
  const accentBase=dark?mix(raw,'#ffffff',.44):raw;
  // One readable accent works as text on every accented surface as well as a fill.
  let accent=accentBase;
  for(const bg of [surface,sidebar,tint,sceneBg,mix(sidebar,dark?'#ffffff':'#000000',dark?.10:.04),mix(surface,dark?'#ffffff':'#000000',dark?.05:.02)])accent=ensureContrast(accent,bg,4.8);
  const accentHover=dark?mix(accent,'#ffffff',.12):mix(accent,'#000000',.12);
  const onAccent=contrast('#ffffff',accent)>contrast('#111820',accent)?'#ffffff':'#111820';
  let muted=dark?'#b1bbc7':'#566474';
  for(const bg of [surface,sidebar,tint,dark?'#2b323c':'#f1f4f8',dark?'#1a1e22':'#f6f8fa',mix(sidebar,dark?'#ffffff':'#000000',dark?.10:.04),mix(surface,dark?'#ffffff':'#000000',dark?.05:.02)])muted=ensureContrast(muted,bg,4.8);
  const text=dark?'#f0f3f8':'#22313f';
  const sceneText=ensureContrast(text,sceneBg,7);
  const sceneMuted=ensureContrast(muted,sceneBg,4.8);
  // All full-width art colors under the stationary words remain readable.
  const readableArt=base=>{let c=ensureContrast(base,sceneText,7);return ensureContrast(c,sceneMuted,4.8);};
  // Notifications share the scene/device hue, with high-contrast text in both themes.
  const toastBg=ensureContrast(dark?mix(surface,raw,.30):mix(accent,'#111820',.12),'#ffffff',7);
  // Bloom always uses the live Windows hue, including its scene-picker preview.
  const bloomRaw=hex(windowsAccent)||SCENES.windows.accent;
  const vars={
   '--bg':dark?'#1a1e22':'#f6f8fa','--surface':surface,'--sidebar':sidebar,'--text':text,'--muted':muted,
   '--line':dark?'#424b58':'#d7dfe7','--accent':accent,'--accent-hover':accentHover,'--accent-raw':raw,'--on-accent':onAccent,
   '--tint':tint,'--chat-bg':dark?'#2b323c':'#f1f4f8','--danger':dark?'#ffa9b7':'#b52f45',
   '--scene-bg':sceneBg,'--scene-text':sceneText,'--scene-muted':sceneMuted,
   '--panorama-sky':sceneBg,'--panorama-sky2':readableArt(mix(sceneBg,raw,.11)),'--panorama-far':readableArt(mix(sceneBg,raw,.22)),'--panorama-near':readableArt(mix(sceneBg,raw,.34)),'--panorama-sand':readableArt(dark?mix(sceneBg,'#f7d697',.14):'#f7e8ca'),
   '--hill-back':dark?mix(sceneBg,raw,.38):mix('#ffffff',raw,.24),
   '--hill-front':dark?mix(sceneBg,raw,.64):mix('#ffffff',raw,.4),
   '--scene-sun':dark?mix(definition.sun,raw,.2):definition.sun,
   '--border-accent':dark?mix(accent,surface,.35):mix(accent,surface,.5),
   '--toast-bg':toastBg,'--toast-text':'#ffffff','--toast-border':mix(toastBg,accent,dark?.42:.30),
   '--win-bloom-shadow':mix(bloomRaw,'#080d14',dark?.76:.48),'--win-bloom-deep':mix(bloomRaw,'#101720',dark?.42:.23),
   '--win-bloom-base':mix(bloomRaw,'#ffffff',dark?.03:.16),'--win-bloom-mid':mix(bloomRaw,'#ffffff',dark?.24:.38),
   '--win-bloom-silk':mix(bloomRaw,'#ffffff',dark?.48:.68),'--win-bloom-light':mix(bloomRaw,'#ffffff',dark?.73:.87),
   '--win-bloom-edge':mix(bloomRaw,'#ffffff',dark?.88:.95),
   '--divider-shadow':dark?'0 2px 7px #00000038':'0 2px 6px #18233216',
   '--shadow':dark?'0 12px 48px #00000040':'0 12px 48px #183d3214'
  };
  return {vars,raw,accent,usesWindows,name:usesWindows?'Windows accent':definition.name,dark};
 }
 return {SCENES,sceneSettings,hex,mix,luminance,contrast,ensureContrast,palette};
});
