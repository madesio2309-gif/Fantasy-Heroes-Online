from PIL import Image
import colorsys, collections, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "heroes")
for name, box in [("mage_a", (0.3, 0.2, 0.7, 0.36)), ("warrior_a", (0.35, 0.05, 0.65, 0.2)), ("paladin_b", (0.35, 0.05, 0.65, 0.2)), ("archer_b", (0.3, 0.05, 0.7, 0.2))]:
    im = Image.open(os.path.join(ROOT, name + ".webp")).convert("RGBA")
    W, H = im.size
    reg = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
    c = collections.Counter()
    for r, g, b, a in reg.getdata():
        if a < 200: continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if v < 0.4 or s < 0.1: continue
        c[(int(h * 25) / 25, round(s, 1))] += 1
    print(name, [(k[0], k[1], n) for k, n in c.most_common(12)])
