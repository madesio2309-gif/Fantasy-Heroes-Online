import json, os, sys, io, urllib.request, glob
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(ROOT, "..", "public", "assets")
RAW = os.path.join(ROOT, "raw")
os.makedirs(RAW, exist_ok=True)

def load_results():
    urls = {}
    for f in glob.glob(os.path.join(ROOT, "results", "*.json")):
        raw = open(f, "rb").read()
        if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
            txt = raw.decode("utf-16").strip()
        else:
            txt = raw.decode("utf-8-sig", errors="ignore").strip()
        start = txt.find("{")
        if start < 0:
            continue
        try:
            d = json.loads(txt[start:])
        except Exception as e:
            print("bad json", f, e); continue
        if "results" in d:
            for r in d["results"]:
                if r.get("success") and r.get("image_url_public"):
                    urls[r["asset_id"]] = r["image_url_public"]
        elif d.get("kind") in ("bgm", "sfx") and d.get("success"):
            urls[os.path.splitext(os.path.basename(f))[0]] = d.get("cdn_url") or d["url"]
    return urls

def download(aid, url):
    ext = os.path.splitext(url.split("?")[0])[1] or ".bin"
    p = os.path.join(RAW, aid + ext)
    if not os.path.exists(p):
        import subprocess
        tmp = p + ".part"
        for attempt in range(4):
            r = subprocess.run(["curl.exe", "-sSL", "--ssl-no-revoke", "--retry", "3", "--max-time", "600", "-o", tmp, url])
            if r.returncode == 0 and os.path.getsize(tmp) > 1000:
                os.replace(tmp, p)
                break
            print("retry download", aid, r.returncode)
        else:
            raise RuntimeError("download failed " + aid)
    return p

def trim(im, pad=8):
    a = im.split()[-1].point(lambda v: 255 if v > 12 else 0)
    bb = a.getbbox()
    if not bb:
        return im
    x0, y0, x1, y1 = bb
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(im.width, x1 + pad); y1 = min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1))

def fit(im, maxdim):
    s = min(1.0, maxdim / max(im.width, im.height))
    if s < 1.0:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im

def save_webp(im, path, q=90):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)

def segment(im, n=16):
    """Connected-component split of a transparent sheet into n items (reading order)."""
    W, H = im.size
    sc = 4
    w, h = W // sc, H // sc
    a = im.split()[-1].resize((w, h), Image.BILINEAR)
    px = a.load()
    mask = [[px[x, y] > 30 for x in range(w)] for y in range(h)]
    # dilate 2 px to join thin parts
    r = 2
    dm = [[False] * w for _ in range(h)]
    for y in range(h):
        row = mask[y]
        for x in range(w):
            if row[x]:
                for yy in range(max(0, y - r), min(h, y + r + 1)):
                    drow = dm[yy]
                    for xx in range(max(0, x - r), min(w, x + r + 1)):
                        drow[xx] = True
    lab = [[0] * w for _ in range(h)]
    comps = []
    cid = 0
    for y in range(h):
        for x in range(w):
            if dm[y][x] and not lab[y][x]:
                cid += 1
                stack = [(x, y)]; lab[y][x] = cid
                minx, miny, maxx, maxy, area, sx, sy = x, y, x, y, 0, 0, 0
                while stack:
                    cx, cy = stack.pop()
                    area += 1; sx += cx; sy += cy
                    minx = min(minx, cx); maxx = max(maxx, cx); miny = min(miny, cy); maxy = max(maxy, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and dm[ny][nx] and not lab[ny][nx]:
                            lab[ny][nx] = cid; stack.append((nx, ny))
                comps.append(dict(id=cid, area=area, bb=[minx, miny, maxx, maxy], c=(sx / area, sy / area), members=[cid]))
    comps.sort(key=lambda c: -c["area"])
    big = comps[:n]
    small = comps[n:]
    # merge small components into nearest big by centroid distance to bbox
    for s in small:
        best = min(big, key=lambda b: (max(b["bb"][0] - s["c"][0], 0, s["c"][0] - b["bb"][2]) ** 2 + max(b["bb"][1] - s["c"][1], 0, s["c"][1] - b["bb"][3]) ** 2))
        dist = (max(best["bb"][0] - s["c"][0], 0, s["c"][0] - best["bb"][2]) ** 2 + max(best["bb"][1] - s["c"][1], 0, s["c"][1] - best["bb"][3]) ** 2) ** 0.5
        if dist < max(w, h) * 0.04:
            best["members"].append(s["id"])
            bb = best["bb"]; sb = s["bb"]
            best["bb"] = [min(bb[0], sb[0]), min(bb[1], sb[1]), max(bb[2], sb[2]), max(bb[3], sb[3])]
    if len(big) < n:
        print("WARNING: only", len(big), "components")
    # reading order: sort by y into rows of 4
    big.sort(key=lambda c: (c["bb"][1] + c["bb"][3]) / 2)
    rows = [big[i:i + 4] for i in range(0, len(big), 4)]
    ordered = []
    for row in rows:
        ordered += sorted(row, key=lambda c: (c["bb"][0] + c["bb"][2]) / 2)
    out = []
    full = im.load()
    for c in ordered:
        members = set(c["members"])
        x0, y0, x1, y1 = [v * sc for v in c["bb"]]
        x1 += sc; y1 += sc
        crop = im.crop((x0, y0, min(W, x1), min(H, y1))).copy()
        cp = crop.load()
        for yy in range(crop.height):
            ly = min(h - 1, (y0 + yy) // sc)
            for xx in range(crop.width):
                lx = min(w - 1, (x0 + xx) // sc)
                l = lab[ly][lx]
                if l and l not in members:
                    p = cp[xx, yy]; cp[xx, yy] = (p[0], p[1], p[2], 0)
        out.append(trim(crop, 6))
    return out

def main():
    urls = load_results()
    print("assets:", len(urls))
    for aid, url in sorted(urls.items()):
        if aid.startswith("fix_"):
            continue
        p = download(aid, url)
        if aid.startswith("hero_"):
            im = trim(Image.open(p).convert("RGBA"), 10)
            save_webp(fit(im, 1100), os.path.join(PUB, "heroes", aid[5:] + ".webp"))
        elif aid.startswith("boss_"):
            im = trim(Image.open(p).convert("RGBA"), 10)
            save_webp(fit(im, 1100), os.path.join(PUB, "bosses", aid[5:8] + ".webp"))
        elif aid.startswith("bg_"):
            im = Image.open(p).convert("RGB")
            im = im.resize((1920, round(1920 * im.height / im.width)), Image.LANCZOS)
            os.makedirs(os.path.join(PUB, "bg"), exist_ok=True)
            im.save(os.path.join(PUB, "bg", aid[3:] + ".jpg"), "JPEG", quality=86, optimize=True)
        elif aid.startswith("sheet_"):
            name = aid[6:]
            im = Image.open(p).convert("RGBA")
            parts = segment(im, 16)
            if name.startswith("enemies"):
                base = 0 if name == "enemies1" else 16
                for i, part in enumerate(parts):
                    save_webp(fit(part, 560), os.path.join(PUB, "enemies", f"e{base + i:02d}.webp"))
            else:
                for i, part in enumerate(parts):
                    save_webp(fit(part, 256), os.path.join(PUB, "icons", f"{name}_{i:02d}.webp"))
            print(name, len(parts))
        else:
            os.makedirs(os.path.join(PUB, "audio"), exist_ok=True)
            out = os.path.join(PUB, "audio", aid + ".mp3")
            if not os.path.exists(out):
                import subprocess
                ff = r"C:\Users\Administrator\AppData\Local\Programs\Python\Python312\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg.exe"
                af = []
                if aid == "jingle_win":
                    af = ["-af", "afade=t=out:st=7.5:d=2"]
                elif aid == "sfx_click":
                    af = ["-t", "0.6"]
                elif aid.startswith("sfx_"):
                    af = ["-af", "silenceremove=start_periods=1:start_threshold=-45dB,afade=t=out:st=1.2:d=0.6"] if aid not in ("sfx_levelup", "sfx_lose", "sfx_crit", "sfx_magic") else ["-af", "silenceremove=start_periods=1:start_threshold=-45dB"]
                br = "128k" if aid.startswith("bgm") else "96k"
                r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", p] + af + ["-ac", "2" if aid.startswith(("bgm", "jingle")) else "1", "-b:a", br, out])
                print("audio", aid, r.returncode)
    # poprawione potwory nadpisują wycięcia z arkuszy
    for aid, url in sorted(urls.items()):
        if aid.startswith("fix_"):
            p = download(aid, url)
            im = trim(Image.open(p).convert("RGBA"), 8)
            save_webp(fit(im, 560), os.path.join(PUB, "enemies", aid[4:] + ".webp"))
            print("fixed", aid)
    print("done")

if __name__ == "__main__":
    main()
