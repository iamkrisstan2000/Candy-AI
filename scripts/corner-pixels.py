"""TEST ONLY: run after visual-fixes-check.playwright.js (Pillow required).
Playwright may normalize screenshots to CSS pixels; infer image scale from width.
A computed border-radius alone missed the old overpainted square; inspect pixels.
"""
from pathlib import Path
import re
from PIL import Image
root=(Path(__file__).resolve().parents[1]/'.cache'/'test-output')
files=[p for p in root.glob('candy153-corner-*.png') if re.fullmatch(r'candy153-corner-[\d.]+-(?:true|false)-(?:true|false)\.png',p.name)]
assert len(files)==12,len(files)
for p in sorted(files):
 im=Image.open(p).convert('RGB');scale=im.width/48
 frame=im.getpixel((int(8.5*scale),int(8.5*scale)))
 curved=im.getpixel((int(14.5*scale),int(14.5*scale)))
 assert max(frame)<45,(p.name,'outside arc not frame',frame)
 assert min(curved)>200,(p.name,'square backing overpaints arc',curved)
 print('PASS rendered curve pixels:',p.name,frame,curved)

native=root/'candy153-native-corner.png'
if native.exists():
 im=Image.open(native).convert('RGB')
 assert max(im.getpixel((8,8)))<45 and min(im.getpixel((14,14)))>200
 print('PASS: actual Linux Electron corner pixels after compositor frame')
