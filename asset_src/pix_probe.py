from PIL import Image
import colorsys, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "assets", "heroes")
im = Image.open(os.path.join(ROOT, "warrior_a.webp")).convert("RGBA")
W, H = im.size
print(W, H)
for fy in (0.06, 0.08, 0.1, 0.12):
    row = []
    for fx in (0.4, 0.45, 0.5, 0.55, 0.6):
        r, g, b, a = im.getpixel((int(fx * W), int(fy * H)))
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        row.append(f"({r},{g},{b},{a}) h{h:.2f} s{s:.2f} v{v:.2f}")
    print(fy, " | ".join(row))
