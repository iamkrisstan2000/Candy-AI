/* Shared conversation rules; never discard older chats to enforce the new limit. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CandyConversations=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_CONVERSATIONS=10;
 function createConversation(chats,id,created){
  if(chats.length>=MAX_CONVERSATIONS)throw new Error('Maximum 10 conversations. Delete older chats before creating another.');
  if(typeof id!=='string'||!id||chats.some(c=>c.id===id))throw new Error('A unique conversation ID is required.');
  const titles=new Set(chats.map(c=>c.title));let n=1;while(titles.has('Conversation '+n))n++;
  return {id,title:'Conversation '+n,created,messages:[]};
 }
 function validateChats(value,existing=[]){
  if(!Array.isArray(value)||value.length>500)throw new Error('Invalid conversation list.');
  const ids=new Set();
  for(const c of value){
   if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.title!=='string'||!Array.isArray(c.messages)||c.messages.length>3000)throw new Error('Invalid conversation.');
   ids.add(c.id);
   for(const m of c.messages)if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>100000)throw new Error('Invalid message.');
  }
  // Existing installations may exceed ten. Permit saves/deletions, never adding IDs
  // while over the limit. Do not silently truncate or delete user history.
  if(value.length>MAX_CONVERSATIONS){const old=new Set(existing.map(c=>c.id));if(existing.length<=MAX_CONVERSATIONS||value.length>existing.length||value.some(c=>!old.has(c.id)))throw new Error('Maximum 10 conversations. Delete an existing conversation first.');}
  if(JSON.stringify(value).length>30*1024**2)throw new Error('Chat archive is too large. Export older conversations first.');
  return value;
 }
 function removeConversation(chats,id,activeId){
  if(!chats.some(c=>c.id===id))throw new Error('Conversation not found.');
  const next=chats.filter(c=>c.id!==id);
  return {chats:next,activeId:next.some(c=>c.id===activeId)?activeId:next[0]?.id||null};
 }
 return {MAX_CONVERSATIONS,createConversation,validateChats,removeConversation};
});
