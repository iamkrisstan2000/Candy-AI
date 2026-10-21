/* Playful local status lines. Not real emotions, monitoring or background activities. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CandyMoods=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const POOLS={
  friendly:[[['Here for a quiet chat',''],['Taking things at your pace',''],['Keeping things simple','']],[['Easy pace, good company','☕'],['A little chat, a little brighter','☀️'],['Keeping it light','🙂']],[['Sidekick energy: switched on','⚡'],['Good chats, questionable puns','😄'],['A little spark for your day','✨']]],
  thoughtful:[[['An unhurried moment',''],['Room to take your time',''],['A quiet little corner','']],[['A softer kind of pace','🌿'],['Leaving room to breathe','☁️'],['One thought at a time','🍃']],[['A little warmth for the day','☀️'],['Gentle pace, brighter outlook','🌱'],['Soft landing for big thoughts','✨']]],
  creative:[[['Room for a new idea',''],['A fresh page, no rush',''],['Keeping the possibilities open','']],[['A little room for what-ifs','🎨'],['Making space for a new spark','💡'],['Ideas welcome, perfection optional','✏️']],[['A healthy amount of what-if','💡'],['Plot twists welcome','🎭'],['Tiny ideas, big possibilities','✨']]],
  focused:[[['One step at a time',''],['Keeping the next step clear',''],['Less noise, more focus','']],[['One good idea at a time','💡'],['Steady pace, clear next step','🧩'],['A little focus goes a long way','⌘']],[['Less chaos, more semicolons','💻'],['Side quest: fewer bugs','🐞'],['Big plans, small commits','🛠️']]]
 };
 const bounded=random=>Math.max(0,Math.min(.999999,Number(random())||0));
 function pickMood({persona='friendly',humor=50,previous=null,random=Math.random}={}){const level=Math.max(0,Math.min(100,Number(humor)||0)),band=level<25?0:level>=75?2:1;const pool=(POOLS[persona]||POOLS.friendly)[band];const options=pool.filter(([text])=>text!==previous?.text);const [text,emoji]=options[Math.floor(bounded(random)*options.length)];const show=level>=25&&bounded(random)<((level-25)/75)*.7;return {text,emoji:show?emoji:'',display:text+(show&&emoji?' '+emoji:'')};}
 function moodDelay(random=Math.random){return 120000+Math.floor(bounded(random)*120001);}
 return {POOLS,pickMood,moodDelay};
});
