'use strict';
// Electron's native Windows API reads the device accent locally; no registry scripts/network.
function readAppearance(preferences,platform=process.platform){
 if(platform!=='win32')return {accentColor:null,accentAvailable:false};
 try{const rgba=preferences.getAccentColor();if(!/^[a-f\d]{8}$/i.test(rgba))throw new Error('Invalid Windows accent');return {accentColor:'#'+rgba.slice(0,6).toLowerCase(),accentAvailable:true};}
 catch{return {accentColor:null,accentAvailable:false};}
}
function supportsAcrylic(platform,release){return platform==='win32'&&/^10\.0\.\d+$/.test(release)&&Number(release.split('.')[2])>=22621;}
module.exports={readAppearance,supportsAcrylic};
