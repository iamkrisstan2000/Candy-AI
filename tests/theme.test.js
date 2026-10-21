const test=require('node:test'),assert=require('node:assert/strict');
const {palette,contrast,hex,ensureContrast,SCENES,sceneSettings}=require('../renderer/theme');
const {readAppearance}=require('../src/appearance');
const {DEFAULTS,validateSettings}=require('../src/core');
const configurations=[];
for(const dark of [false,true])for(const scene of Object.keys(SCENES)){
 configurations.push({dark,scene});
 for(const windowsAccent of ['#0078d4','#ffb900','#ff0000','#000000','#ffffff','#808080','#00ff00','#ff00ff','#006400'])configurations.push({dark,scene,accentSource:'windows',windowsAccent});
}
test('all theme/scene/device combinations meet normal-text contrast targets',()=>{
 for(const c of configurations){const v=palette(c).vars;
  for(const bg of ['--surface','--sidebar','--tint','--chat-bg','--bg'])for(const fg of ['--text','--muted'])assert.ok(contrast(v[fg],v[bg])>=4.5,JSON.stringify(c)+fg+bg+' '+contrast(v[fg],v[bg]));
  for(const bg of ['--surface','--sidebar','--tint'])assert.ok(contrast(v['--accent'],v[bg])>=4.5,'Accent text '+JSON.stringify(c));
  assert.ok(contrast(v['--on-accent'],v['--accent'])>=4.5,'Filled action '+JSON.stringify(c));
  assert.ok(contrast(v['--on-accent'],v['--accent-hover'])>=4.5,'Hovered action '+JSON.stringify(c));
  assert.ok(contrast(v['--scene-text'],v['--scene-bg'])>=7,'Scene heading '+JSON.stringify(c));
  assert.ok(contrast(v['--scene-muted'],v['--scene-bg'])>=4.5,'Scene caption '+JSON.stringify(c));
 }
});
test('each scene carries a distinct coordinated accent',()=>{for(const dark of [false,true]){const p=['meadow','lavender','sunset'].map(scene=>palette({scene,dark}));assert.equal(new Set(p.map(x=>x.accent)).size,3);assert.equal(new Set(p.map(x=>x.vars['--scene-bg'])).size,3);}});
test('Windows accent wins only when explicitly enabled and valid',()=>{const a=palette({scene:'lavender',windowsAccent:'#ffb900'});assert.equal(a.raw,'#7954b3');const b=palette({scene:'lavender',accentSource:'windows',windowsAccent:'#ffb900'});assert.equal(b.raw,'#ffb900');assert.equal(b.usesWindows,true);assert.notEqual(a.vars['--scene-bg'],b.vars['--scene-bg']);});
test('unavailable Windows accent preserves scene colors without breaking saved preference',()=>{assert.equal(palette({accentSource:'windows',windowsAccent:null}).raw,'#0078d4');assert.equal(palette({accentSource:'windows',windowsAccent:'url(evil)'}).usesWindows,false);assert.equal(validateSettings({...DEFAULTS,accentSource:'windows'}).accentSource,'windows');});
test('native Windows accent parsing correctly strips only the trailing alpha',()=>{assert.deepEqual(readAppearance({getAccentColor:()=> '0078D4FF'},'win32'),{accentColor:'#0078d4',accentAvailable:true});});
test('Windows API failure and non-Windows platforms fall back safely',()=>{for(const api of [{getAccentColor:()=>{throw new Error('unavailable');}},{getAccentColor:()=> 'malformed'}])assert.equal(readAppearance(api,'win32').accentAvailable,false);assert.equal(readAppearance({getAccentColor:()=>{throw new Error('must not be called');}},'linux').accentAvailable,false);});
test('1.0.0 settings migrate without clearing persona, scene, theme, voice or model',()=>{const old={persona:'creative',humor:75,theme:'dark',scene:'sunset',voice:'Microsoft Zira Desktop',model:'balanced',backend:'cpu'};const migrated=validateSettings(old);for(const [k,v] of Object.entries(old))assert.equal(migrated[k],v);assert.equal(migrated.accentSource,'scene');});
test('invalid accent sources are rejected',()=>{assert.equal(validateSettings({scene:'meadow',accentSource:'remote'}).accentSource,'scene');assert.equal(hex('#AABBCC'),'#aabbcc');assert.equal(hex('bad-color'),null);});
test('contrast utilities match black/white reference ratio',()=>{assert.equal(contrast('#000000','#ffffff'),21);assert.ok(contrast(ensureContrast('#eeeeee','#ffffff'),'#ffffff')>=4.5);});

test('Windows is the default scene and automatically follows a valid device accent',()=>{assert.equal(DEFAULTS.scene,'windows');assert.equal(DEFAULTS.accentSource,'windows');assert.deepEqual(sceneSettings(),{scene:'windows',accentSource:'windows'});assert.equal(palette({scene:'windows',windowsAccent:'#ffb900'}).raw,'#ffb900');});
test('old enabled Windows switch migrates to a selected Windows scene',()=>{const s=validateSettings({scene:'sunset',accentSource:'windows',humor:80,persona:'focused'});assert.equal(s.scene,'windows');assert.equal(s.accentSource,'windows');assert.equal(s.humor,80);assert.equal(s.persona,'focused');});
test('every scene round-trips and custom scenes stop following device color',()=>{for(const scene of Object.keys(SCENES)){const s=validateSettings({scene,accentSource:scene==='windows'?'windows':'scene'});assert.equal(s.scene,scene);assert.equal(s.accentSource,scene==='windows'?'windows':'scene');}assert.equal(sceneSettings({scene:'<img>'}).scene,'windows');});
test('scene/device toast surfaces keep at least 7:1 text contrast in both themes',()=>{for(const dark of [false,true])for(const scene of Object.keys(SCENES))for(const windowsAccent of [null,'#000000','#ffffff','#ffff00','#0078d4']){const v=palette({dark,scene,windowsAccent}).vars;assert.ok(contrast(v['--toast-text'],v['--toast-bg'])>=7,`${dark}/${scene}/${windowsAccent}`);assert.match(v['--toast-border'],/^#[a-f\d]{6}$/);}});
test('toast colors follow each scene and live Windows color rather than fixed green',()=>{for(const dark of [false,true]){const colors=Object.keys(SCENES).map(scene=>palette({dark,scene}).vars['--toast-bg']);assert.equal(new Set(colors).size,colors.length);assert.notEqual(palette({dark,scene:'windows',windowsAccent:'#0078d4'}).vars['--toast-bg'],palette({dark,scene:'windows',windowsAccent:'#ffb900'}).vars['--toast-bg']);}});
test('Beach day has its own palette and survives preference migration',()=>{assert.equal(SCENES.beach.name,'Beach day');for(const dark of [false,true]){const p=palette({scene:'beach',dark});assert.equal(p.raw,'#008c9e');assert.ok(contrast(p.vars['--scene-text'],p.vars['--scene-bg'])>=7);assert.notEqual(p.raw,SCENES.ocean.accent);}assert.equal(validateSettings({scene:'beach',accentSource:'scene'}).scene,'beach');});

test('window frame stays neutral across scenes and device colors',()=>{for(const dark of [false,true])for(const scene of Object.keys(SCENES))for(const windowsAccent of [null,'#0078d4','#ff00ff']){const v=palette({dark,scene,windowsAccent}).vars;assert.equal(v['--sidebar'],dark?'#1a1e22':'#f3f5f7');assert.equal(v['--surface'],dark?'#202529':'#ffffff');}});

test('full-width panorama colors preserve readable stationary text across scenes and device accents',()=>{for(const c of configurations){const v=palette(c).vars;for(const key of ['--panorama-sky','--panorama-sky2','--panorama-far','--panorama-near','--panorama-sand']){assert.ok(contrast(v['--scene-text'],v[key])>=7,key+JSON.stringify(c));assert.ok(contrast(v['--scene-muted'],v[key])>=4.5,key+JSON.stringify(c));}}});
