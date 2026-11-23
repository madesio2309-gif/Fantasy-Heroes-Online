"""Finalizacja animacji ataku:
1) globalne usunięcie zamkniętych wysp koloru tła (flood-fill z krawędzi ich nie łapie),
2) despill krawędzi, 3) obliczenie bboxów klatek, 4) zapis do public/assets/anims + anims.json."""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "public", "assets", "anims")
os.makedirs(OUT, exist_ok=True)
LOOKS = ["warrior_a", "warrior_b", "mage_a", "mage_b", "archer_a", "archer_b", "assassin_a", "assassin_b", "paladin_a", "paladin_b"]
CELL = 896
meta = {}
previews = []
for look in LOOKS:
    d = os.path.join(ROOT, "anim", "out2", look)
    rep = json.load(open(os.path.join(d, "pipeline_report.json"), encoding="utf-8"))
    assert rep["status"] != "fail", look
    key = rep["stages"]["clean"]["key_color"].lstrip("#")
    k = np.array([int(key[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
    im = np.asarray(Image.open(os.path.join(d, f"atk_{look}_sheet.png")).convert("RGBA")).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3]
    dist = np.linalg.norm(rgb - k, axis=-1)
    # wyspy tła: pełne usunięcie blisko klucza, miękkie przejście dalej
    hard, soft = 70.0, 120.0
    fac = np.clip((dist - hard) / (soft - hard), 0, 1)
    a = a * fac
    # despill: dominująca składowa klucza ograniczona do pozostałych
    kc = int(np.argmax(k)) if k.max() - np.sort(k)[-2] > 100 else None
    if kc is None:  # magenta (R i B wysokie)
        lim = rgb[..., 1] + 40
        rgb[..., 0] = np.minimum(rgb[..., 0], np.maximum(lim, rgb[..., 0] * (1 - 0.5 * (1 - fac))))
        rgb[..., 2] = np.minimum(rgb[..., 2], np.maximum(lim, rgb[..., 2] * (1 - 0.5 * (1 - fac))))
        mag = (rgb[..., 0] > rgb[..., 1] + 90) & (rgb[..., 2] > rgb[..., 1] + 90)
        a[mag] *= 0.15
    else:
        others = [c for c in range(3) if c != kc]
        mx = np.maximum(rgb[..., others[0]], rgb[..., others[1]])
        spill = rgb[..., kc] > mx + 25
        rgb[..., kc] = np.where(spill, mx + 25, rgb[..., kc])
    out = np.dstack([rgb, a]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(out)
    W, H = img.size
    n = W // CELL
    # wspólny obrys wszystkich klatek (zachowuje wyrównanie między klatkami)
    ux0, uy0, ux1, uy1 = CELL, H, 0, 0
    raw_boxes = []
    for i in range(n):
        cell = img.crop((i * CELL, 0, (i + 1) * CELL, H))
        bb = cell.split()[-1].point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, CELL, H)
        raw_boxes.append(bb)
        ux0, uy0, ux1, uy1 = min(ux0, bb[0]), min(uy0, bb[1]), max(ux1, bb[2]), max(uy1, bb[3])
    pad = 8
    ux0, uy0, ux1, uy1 = max(0, ux0 - pad), max(0, uy0 - pad), min(CELL, ux1 + pad), min(H, uy1 + pad)
    cw, ch = ux1 - ux0, uy1 - uy0
    sheet = Image.new("RGBA", (cw * n, ch), (0, 0, 0, 0))
    boxes = []
    for i in range(n):
        sheet.paste(img.crop((i * CELL + ux0, uy0, i * CELL + ux1, uy1)), (i * cw, 0))
        bb = raw_boxes[i]
        boxes.append([round((bb[0] - ux0) / cw, 4), round((bb[1] - uy0) / ch, 4), round((bb[2] - ux0) / cw, 4), round((bb[3] - uy0) / ch, 4)])
    img = sheet
    W, H = img.size
    img.save(os.path.join(OUT, f"atk_{look}.webp"), "WEBP", quality=90, method=6)
    meta[look] = {"frames": n, "cw": cw, "ch": ch, "bbox": boxes, "fps": 12, "apex": 4 if look.startswith("archer") else 3}
    prev = Image.new("RGBA", img.size, (45, 45, 55, 255)); prev.alpha_composite(img)
    previews.append(prev.convert("RGB").resize((W // 4, H // 4)))
json.dump(meta, open(os.path.join(OUT, "anims.json"), "w"), indent=1)
sheet = Image.new("RGB", (previews[0].width, sum(p.height for p in previews)))
y = 0
for p in previews: sheet.paste(p, (0, y)); y += p.height
sheet.save(os.path.join(ROOT, "anim", "final_check.png"))
print("ok", {k: v["bbox"][0] for k, v in meta.items()})
