const {contextBridge,ipcRenderer}=require('electron');
const invoke=(name)=>(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('candy',{
 desktop:true,nudge:invoke('nudge'),chooseAvatar:invoke('choose-avatar'),removeAvatar:invoke('remove-avatar'),appearance:invoke('appearance'),load:invoke('load'),saveSettings:invoke('save-settings'),hardware:invoke('hardware'),voices:invoke('voices'),setup:invoke('setup'),cancelSetup:invoke('cancel-setup'),chat:invoke('chat'),stop:invoke('stop'),saveChats:invoke('save-chats'),exportChat:invoke('export-chat'),speak:invoke('speak'),stopSpeech:invoke('stop-speech'),reset:invoke('reset'),window:invoke('window'),
 onEvent(fn){const listener=(_,data)=>fn(data);ipcRenderer.on('candy-event',listener);return()=>ipcRenderer.removeListener('candy-event',listener);}
});
