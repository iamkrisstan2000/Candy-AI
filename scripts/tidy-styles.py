"""Conservative, idempotent stylesheet cleanup. Requires tinycss2 (dev only).
Removes audited obsolete selectors, superseded exact-selector declarations and
older duplicate keyframes. Does NOT reorder surviving rules or optimize shorthands.
Run the browser style-equivalence/regression suites after changing the audit list.
"""
from pathlib import Path
import re,json,tinycss2
path=Path(__file__).resolve().parents[1]/'renderer/styles.css'
source=path.read_text()
DEAD_CLASSES={'app-title','title-tagline','sidebar-brand','brand-mark','brand-dot','accent-follow-card','accent-follow-row','accent-status','ai-pill','hill','hill-back','hill-front','local-card','local-card-icon','menu-wrap','profile-caption','profile-line','rail-info','scene-daisy','scene-flower','scene-star','scene-status','sidebar-footer','star-one','star-two','sun','thinking-label','title-sep'}
DEAD_IDS={'accent-dot','accent-note','stream-body'}
counts={'unused_selector_branches':0,'superseded_declarations':0,'duplicate_keyframes':0,'unused_keyframes':0}
def split_selectors(tokens):
 parts=[];one=[]
 for t in tokens:
  if t.type=='literal' and t.value==',':parts.append(tinycss2.serialize(one).strip());one=[]
  else:one.append(t)
 parts.append(tinycss2.serialize(one).strip());return parts
# Kept order is vital: identical selectors can still interact with shorthands.
def parse(nodes,context=()):
 out=[]
 for n in nodes:
  if n.type in ['whitespace','comment']:continue
  if n.type=='qualified-rule':
   sels=[]
   for s in split_selectors(n.prelude):
    dead=bool(set(re.findall(r'\.([A-Za-z][\w-]*)',s))&DEAD_CLASSES or set(re.findall(r'#([A-Za-z][\w-]*)',s))&DEAD_IDS or re.fullmatch(r'\.scene\s*>\s*button(?::hover)?(?:\s+svg)?',s)  or re.fullmatch(r'\.empty-conversations\s*>\s*(?:img|\.eyebrow)',s))
    if dead:counts['unused_selector_branches']+=1
    else:sels.append(s)
   if not sels:continue
   decls=[d for d in tinycss2.parse_declaration_list(n.content,skip_comments=True,skip_whitespace=True) if d.type=='declaration']
   out.append({'kind':'rule','selector':','.join(sels),'decls':decls,'context':context})
  elif n.type=='at-rule' and n.content is not None:
   name=n.lower_at_keyword;params=tinycss2.serialize(n.prelude).strip();out.append({'kind':'at','name':name,'params':params,'children':parse(tinycss2.parse_rule_list(n.content),context+((name,params),)),'context':context})
  elif n.type=='at-rule':out.append({'kind':'raw','text':tinycss2.serialize([n]),'context':context})
 return out
rules=parse(tinycss2.parse_stylesheet(source,skip_comments=True,skip_whitespace=True))
seen_keyframes=set();seen_decls={};dropped=set()
def prune(nodes):
 for n in reversed(nodes):
  if n['kind']=='at':
   if n['name'].endswith('keyframes'):
    key=(n['context'],n['name'],n['params'])
    if key in seen_keyframes:n['drop']=True;counts['duplicate_keyframes']+=1;continue
    seen_keyframes.add(key)
   prune(n['children'])
  elif n['kind']=='rule':
   if any(name.endswith('keyframes') for name,_ in n['context']):continue
   for d in reversed(n['decls']):
    key=(n['context'],n['selector'],d.lower_name);importance=seen_decls.get(key)
    if importance is not None and (not d.important or importance):dropped.add(id(d));counts['superseded_declarations']+=1
    else:seen_decls[key]=bool(d.important)
prune(rules)
# A keyframe name referenced by a surviving animation declaration is retained.
references=set()
def refs(nodes):
 for n in nodes:
  if n.get('drop'):continue
  if n['kind']=='at':refs(n['children'])
  elif n['kind']=='rule':
   for d in n['decls']:
    if not id(d) in dropped and d.lower_name in ['animation','animation-name']:references.update(re.findall(r'[A-Za-z][\w-]*',tinycss2.serialize(d.value)))
refs(rules)
def emit(nodes,depth=0):
 lines=[];indent='  '*depth
 for n in nodes:
  if n.get('drop'):continue
  if n['kind']=='raw':lines.append(indent+n['text'])
  elif n['kind']=='at':
   if n['name'].endswith('keyframes') and n['params'] not in references:counts['unused_keyframes']+=1;continue
   child=emit(n['children'],depth+1)
   if child:lines.extend([indent+'@'+n['name']+(' '+n['params'] if n['params'] else '')+'{',*child,indent+'}'])
  else:
   text=';'.join(d.name+':'+tinycss2.serialize(d.value).strip()+('!important' if d.important else '') for d in n['decls'] if not id(d) in dropped)
   if text:lines.append(indent+n['selector']+'{'+text+'}')
 return lines
header='''/* Candy UI. Cascade order is intentional; runtime colors come from theme.js.
   The content corner uses a clipped flat background plus one dual-material tile.
   Scene motion remains scoped, with reduced-motion and forced-colors fallbacks.
   Historical changes and cleanup rationale: CHANGELOG.md / MAINTENANCE.md. */\n'''
result=header+'\n'.join(emit(rules))+'\n';path.write_text(result);print(json.dumps({**counts,'bytes_before':len(source.encode()),'bytes_after':len(result.encode())},indent=2))
