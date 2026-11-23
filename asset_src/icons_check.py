from PIL import Image
import glob, os
files = sorted(glob.glob("public/assets/icons/*.webp"))
cell = 96; cols = 16
rows = (len(files)+cols-1)//cols
sheet = Image.new("RGB", (cols*cell, rows*(cell+14)), (70,70,80))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
stats = []
for i,f in enumerate(files):
    im = Image.open(f).convert("RGBA")
    a = im.split()[-1]
    bb = a.point(lambda v: 255 if v>40 else 0).getbbox()
    cov = sum(1 for v in a.getdata() if v>40)/ (im.width*im.height)
    stats.append((os.path.basename(f), im.size, bb, round(cov,3)))
    t = im.copy(); t.thumbnail((cell-6,cell-6))
    bg = Image.new("RGBA",(cell,cell),(110,110,125,255)); bg.alpha_composite(t,((cell-t.width)//2,(cell-t.height)//2))
    x=(i%cols)*cell; y=(i//cols)*(cell+14)
    sheet.paste(bg.convert("RGB"),(x,y)); d.text((x+2,y+cell),os.path.basename(f)[:-5],fill=(255,255,255))
sheet.save("asset_src/contact/icons_check.png")
for s in stats:
    if s[3] < 0.15 or s[0] in ("weapons_03.webp","armor_09.webp"): print(s)
