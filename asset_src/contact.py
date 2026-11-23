import os, glob
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(ROOT, "..", "public", "assets")
OUT = os.path.join(ROOT, "contact")
os.makedirs(OUT, exist_ok=True)

def sheet(files, name, cell=200, cols=8):
    rows = (len(files) + cols - 1) // cols
    im = Image.new("RGB", (cols * cell, rows * (cell + 20)), (60, 60, 70))
    d = ImageDraw.Draw(im)
    for i, f in enumerate(files):
        t = Image.open(f).convert("RGBA")
        t.thumbnail((cell - 10, cell - 10))
        x = (i % cols) * cell; y = (i // cols) * (cell + 20)
        bg = Image.new("RGBA", (cell, cell), (90, 90, 105, 255))
        bg.alpha_composite(t, ((cell - t.width) // 2, (cell - t.height) // 2))
        im.paste(bg.convert("RGB"), (x, y))
        d.text((x + 4, y + cell + 3), os.path.basename(f), fill=(255, 255, 255))
    im.save(os.path.join(OUT, name + ".png"))

sheet(sorted(glob.glob(os.path.join(PUB, "enemies", "*.webp"))), "enemies")
sheet(sorted(glob.glob(os.path.join(PUB, "icons", "*.webp"))), "icons", 128, 16)
sheet(sorted(glob.glob(os.path.join(PUB, "heroes", "*.webp"))) + sorted(glob.glob(os.path.join(PUB, "bosses", "*.webp"))), "heroes_bosses", 200, 10)
sheet(sorted(glob.glob(os.path.join(PUB, "bg", "*.jpg"))), "bgs", 300, 4)
print("ok")
