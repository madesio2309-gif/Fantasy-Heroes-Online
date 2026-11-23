from PIL import Image
import colorsys, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "heroes")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contact")
def smooth(a, b, x):
    t = max(0, min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t)
tiles = []
for name, box in [("warrior_a", (0.3, 0.0, 0.75, 0.22)), ("archer_a", (0.3, 0.0, 0.75, 0.22)), ("mage_a", (0.25, 0.15, 0.7, 0.37)), ("assassin_b", (0.2, 0.0, 0.8, 0.2))]:
    im = Image.open(os.path.join(ROOT, name + ".webp")).convert("RGBA")
    W, H = im.size
    im = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
    im.thumbnail((260, 260))
    out = Image.new("RGB", im.size, (40, 40, 40))
    px = im.load(); op = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 100: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            skin = ((0.02 <= h <= 0.12 and s < 0.8) or ((h > 0.85 or h < 0.02) and s < 0.45)) and v > 0.3
            k = 0 if skin else smooth(0.3, 0.45, s)
            op[x, y] = (0, int(255 * k), 255) if k > 0.5 else (r, g, b)
    tiles.append(im.convert("RGB")); tiles.append(out)
W = sum(t.width for t in tiles); H = max(t.height for t in tiles)
sheet = Image.new("RGB", (W, H)); x = 0
for t in tiles: sheet.paste(t, (x, 0)); x += t.width
sheet.save(os.path.join(OUT, "huemask_heads.png"))
print("ok")
