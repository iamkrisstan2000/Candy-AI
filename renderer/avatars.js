(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CandyAvatars=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CANDY=[{id:'candy',name:'Cute candy',src:'mascot.svg',note:'The original little sweet.'},{id:'anime',name:'Cute anime girl',src:'avatars/candy-anime.webp',note:'A sunny hello.'},{id:'mature',name:'Mature anime girl',src:'avatars/candy-mature.webp',note:'A calm, confident presence.'},{id:'developer',name:'Developer anime girl',src:'avatars/candy-developer.webp',note:'For your focused side.',persona:'focused'},{id:'finger-heart',name:'Finger-heart girl',src:'avatars/candy-finger-heart.webp',poster:'avatars/candy-finger-heart-still.webp',animated:true,note:'A little heart, on repeat.'},{id:'tail-cat',name:'Tail-wiggle cat',src:'avatars/candy-tail-cat.webp',poster:'avatars/candy-tail-cat-still.webp',animated:true,note:'A happy little tail swish.'}];
 const YOU=[{id:'initial',name:'Your initial',src:null},{id:'guitar',name:'Guitar girl',src:'avatars/you-guitar.webp'},{id:'soccer',name:'Soccer ball',src:'avatars/you-soccer.webp'},{id:'frog',name:'Little frog',src:'avatars/you-frog.webp'},{id:'cat',name:'Cute cat',src:'avatars/you-cat.webp'},{id:'hacker',name:'Hacker girl',src:'avatars/you-hacker.webp'}];
 function source(a,still=false){return still&&a.poster?a.poster:a.src;}
 function candyOptions(persona){return CANDY.filter(a=>!a.persona||a.persona===persona);}
 function candyId(id,persona){return candyOptions(persona).some(a=>a.id===id)?id:'candy';}
 function userId(id){return id==='custom'||YOU.some(a=>a.id===id)?id:'initial';}
 function imageInfo(input){
  const b=input instanceof Uint8Array?input:new Uint8Array(input);if(b.length>10*1024**2)throw new Error('Choose a PNG or JPEG smaller than 10 MB.');
  let width=0,height=0,format='';const u16=i=>(b[i]<<8)|b[i+1];const u32=i=>((b[i]*16777216)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3]);
  if(b.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n)&&String.fromCharCode(...b.slice(12,16))==='IHDR'){width=u32(16);height=u32(20);format='png';}
  else if(b[0]===255&&b[1]===216){let i=2;while(i+3<b.length){if(b[i]!==255){i++;continue;}while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;if(marker===0||marker===1||(marker>=208&&marker<=215))continue;const size=u16(i);if(size<2||i+size>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){height=u16(i+3);width=u16(i+5);format='jpeg';break;}i+=size;}}
  if(!width||!height)throw new Error('That file is not a supported PNG or JPEG image.');
  if(width>4096||height>4096||width*height>16*1024**2)throw new Error('Choose an image no larger than 4096 × 4096 pixels.');
  return {width,height,format};
 }
 return {CANDY,YOU,source,candyOptions,candyId,userId,imageInfo};
});
