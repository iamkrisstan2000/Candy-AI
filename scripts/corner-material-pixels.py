"""TEST ONLY. Requires Pillow; after corner-material-check.playwright.js.
Inside the curved tile must equal regular chat, outside it must equal the frame.
"""
from pathlib import Path
from PIL import Image,ImageChops
import re,math
root=(Path(__file__).resolve().parents[1]/'.cache'/'test-output')
def delta(a,b):return max(abs(x-y) for x,y in zip(a,b))
def colors(im):return im.getpixel((14,14)),im.getpixel((28,20)),im.getpixel((8,8)),im.getpixel((4,10))
old=root/'corner156-old-blue.png'
if old.exists():
 a,b,_,_=colors(Image.open(old).convert('RGB'));print('Old overlap reproduced:',a,b,'delta',delta(a,b));assert delta(a,b)>=3
new=root/'corner156-new-blue.png'
if new.exists():
 a,b,_,_=colors(Image.open(new).convert('RGB'));assert delta(a,b)<=1;print('New single-paint corner:',a,b)
files=[p for p in root.glob('corner156-*.png') if re.fullmatch(r'corner156-[\d.]+-(?:light|dark)-(?:true|false)-(?:true|false)-(?:blue|green|black|white)\.png',p.name)]
assert len(files)==96,len(files)
for p in files:
 im=Image.open(p).convert('RGB');chat,reference,frame,frameReference=colors(im);assert delta(chat,reference)<=1,(p.name,'dark patch',chat,reference);assert delta(frame,frameReference)<=1,(p.name,'frame mismatch',frame,frameReference)
 for x in range(9):
  for y in range(9):
   px=im.getpixel((8+x,8+y));r=math.hypot(x+.5-8,y+.5-8)
   if r<=7:assert delta(px,reference)<=1,(p.name,'inside arc double tint',x,y,px,reference)
   for v,a,b in zip(px,reference,frameReference):assert min(a,b)-1<=v<=max(a,b)+1,(p.name,'colored fringe',x,y,px,reference,frameReference)
print('PASS:',len(files),'material/backdrop/theme/collapse/emulated-scale pixel cases; no dark tile or colored fringe')
a=root/'corner156-banner-before.png';b=root/'corner156-banner-after.png'
if a.exists() and b.exists():
 a=Image.open(a).convert('RGB');b=Image.open(b).convert('RGB');assert a.size==b.size
 diff=ImageChops.difference(a,b);values=list(diff.getdata());changed=sum(any(v) for v in values);maximum=max(max(v) for v in values);assert maximum<=2 and changed/len(values)<.001,(maximum,changed)
 print(f'PASS: approved frozen banner unchanged apart from raster rounding: {changed}/{len(values)} pixels, maximum {maximum}/255 per channel')
