#!/usr/bin/env python3
"""DEVELOPMENT ONLY. Bake local seamless WebP loops from the bundled stills.
Requires Pillow, numpy, opencv-python-headless. No runtime or network dependency.
48 frames * 60 ms = 2880 ms. Phase samples exclude a duplicate endpoint so
last->first has the same angular spacing as every other pair of frames.
"""
from pathlib import Path
import math, json
import numpy as np
import cv2
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]/'renderer/avatars'
N=48;SIZE=256
Y,X=np.mgrid[0:SIZE,0:SIZE].astype(np.float32);x=X/SIZE;y=Y/SIZE
def smooth(v):
 v=np.clip(v,0,1);return v*v*(3-2*v)
def frame(base,kind,phase):
 dx=np.zeros_like(X);dy=np.zeros_like(Y)
 if kind=='finger-heart':
  # Bend the raised hand about its anchored wrist, not the whole portrait.
  w=np.clip(1-((x-.322)/.175)**2-((y-.652)/.202)**2,0,1)
  w=smooth(w)
  dx+=w*(3.5*math.sin(phase)+.035*math.sin(phase)*(Y-.79*SIZE))
  dy+=w*(-9*(1-math.cos(phase))/2-.035*math.sin(phase)*(X-.355*SIZE))
  hair=np.exp(-(((x-.72)/.12)**2+((y-.77)/.16)**2))
  dx+=hair*2*math.sin(phase)
 else:
  # Tail turns about its base; body/face remain planted. Smooth spatial mask
  # also remaps the plain background: no cutout seams or missing pixels.
  w=smooth((x-.60)/.08)*smooth((.91-y)/.12)*smooth((y-.20)/.08)
  a=.125*math.sin(phase);px=X-.71*SIZE;py=Y-.82*SIZE
  dx+=w*(px*(math.cos(a)-1)-py*math.sin(a))
  dy+=w*(px*math.sin(a)+py*(math.cos(a)-1))
 out=Image.fromarray(cv2.remap(base,X-dx,Y-dy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101))
 if kind=='finger-heart':
  pulse=(1-math.cos(phase))/2
  if pulse>.005:
   layer=Image.new('RGBA',out.size);d=ImageDraw.Draw(layer)
   cx=(.308+.008*math.sin(phase))*SIZE;cy=(.519-.035*pulse)*SIZE;s=SIZE*(.013+.006*pulse)
   # One small heart blooms from the finger-heart, then softly disappears.
   pts=[]
   for t in np.linspace(0,math.tau,64):
    hx=16*math.sin(t)**3;hy=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
    pts.append((cx+hx*s/16,cy-hy*s/16))
   d.polygon(pts,fill=(227,77,120,round(220*pulse)))
   out=Image.alpha_composite(out.convert('RGBA'),layer).convert('RGB')
 return out
results=[]
for kind in ['finger-heart','tail-cat']:
 base=np.array(Image.open(ROOT/f'candy-{kind}-still.webp').convert('RGB'))
 frames=[frame(base,kind,math.tau*i/N) for i in range(N)]
 path=ROOT/f'candy-{kind}.webp';frames[0].save(path,save_all=True,append_images=frames[1:],duration=60,loop=0,quality=78,method=6,minimize_size=True)
 with Image.open(path) as w:
  assert w.n_frames==N and w.info['loop']==0
  decoded=[]
  for i in range(N):w.seek(i);decoded.append(np.array(w.convert('RGB')).astype(float))
 diffs=[float(np.abs(decoded[(i+1)%N]-decoded[i]).mean()) for i in range(N)]
 assert max(diffs)>0 and diffs[-1]<=max(diffs[:-1])*1.5
 results.append(dict(avatar=kind,frames=N,durationMs=N*60,loop=0,bytes=path.stat().st_size,boundaryMeanAbsDiff=diffs[-1],maxAdjacentMeanAbsDiff=max(diffs)))
print(json.dumps(results,indent=2))
