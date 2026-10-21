"""TEST ONLY: after facelift-check.playwright.js; Pillow required.
Samples actual rendered art pixels under stationary banner text, not CSS background alone.
"""
from pathlib import Path
import json,re,math,sys
from PIL import Image
log=Path(sys.argv[1] if len(sys.argv)>1 else str(Path(__file__).resolve().parents[1]/'.cache'/'test-output'/'candy100-facelift.log')).read_text()
report=json.loads(log.split('### Result\n',1)[1].split('\n###',1)[0])
def lum(rgb):
 c=[v/255 for v in rgb];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
def contrast(a,b):
 a,b=sorted([lum(a),lum(b)]);return (b+.05)/(a+.05)
bad=[];minimum=99
for case in report['cases']:
 im=Image.open(case['file']).convert('RGB');scale=im.width/case['clip']['width'];low=99
 for rect in case['ranges']:
  fg=tuple(round(float(x)) for x in re.findall(r'[\d.]+',rect['color'])[:3]);x0=(rect['x']-case['clip']['x'])*scale;y0=(rect['y']-case['clip']['y'])*scale
  for x in range(math.ceil(x0)+1,min(im.width,math.floor(x0+rect['width']*scale)),2):
   for y in range(math.ceil(y0)+1,min(im.height,math.floor(y0+rect['height']*scale)),2):low=min(low,contrast(fg,im.getpixel((x,y))))
 minimum=min(minimum,low)
 if low<4.5:bad.append({k:case[k] for k in ['width','collapsed','theme','scene','phase']}|{'contrast':round(low,3)})
print(json.dumps({'pixelContrastCases':len(report['cases']),'minimumContrast':round(minimum,3),'failures':bad},indent=2))
assert not bad,'Rendered artwork beneath text needs adjustment.'

# White art + black veil makes alpha/transition position measurable in pixels.
veil=(Path(__file__).resolve().parents[1]/'.cache'/'test-output'/'veil155-center.png')
if veil.exists():
 im=Image.open(veil).convert('RGB');w,h=im.size
 left=im.getpixel((int(w*.1),h//2))[0];mid=im.getpixel((w//2,h//2))[0];right=im.getpixel((int(w*.9),h//2))[0]
 assert 36<=left<=40,('left must transmit 15%',left)
 assert 143<=mid<=151,('half fade must occur at banner center',mid)
 assert right>=253,('right must be clear',right)
 print('PASS: rendered left transparency 15%, fade midpoint at 50%, clear right:',left,mid,right)
