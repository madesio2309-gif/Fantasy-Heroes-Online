"""Pobranie i obróbka grafik aktualizacji 8: pety, ikony, tła -> public/assets."""
import io, json, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GEN = Path(__file__).resolve().parent
PUB = ROOT / 'public' / 'assets'
RAW = GEN / 'raw'
RAW.mkdir(exist_ok=True)


def load_json(p):
    b = p.read_bytes()
    for enc in ('utf-8-sig', 'utf-16'):
        try:
            return json.loads(b.decode(enc))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    raise ValueError(f'nie można odczytać {p}')


def fetch(url, dest):
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    r = subprocess.run(['curl.exe', '-sSL', '--ssl-no-revoke', '--retry', '3', '-o', str(dest), url])
    if r.returncode != 0 or not dest.exists():
        raise RuntimeError(f'pobieranie nieudane: {url}')
    return dest


def trim(im, pad=8):
    a = im.getchannel('A').point(lambda v: 255 if v > 12 else 0)
    box = a.getbbox()
    if not box:
        raise RuntimeError('pusty obraz')
    l, t, r, b = box
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(im.width, r + pad), min(im.height, b + pad)
    return im.crop((l, t, r, b))


def fit(im, max_side):
    k = max_side / max(im.width, im.height)
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    return im


MAP = {
    'pet_slime': ('pets/slime.webp', 512), 'pet_fox': ('pets/fox.webp', 512), 'pet_owl': ('pets/owl.webp', 512),
    'pet_golem': ('pets/golem.webp', 512), 'pet_cat': ('pets/cat.webp', 512), 'pet_dragon': ('pets/dragon.webp', 512),
    'pet_phoenix': ('pets/phoenix.webp', 512), 'pet_unicorn': ('pets/unicorn.webp', 512),
    'icon_mythic_chest': ('icons/ui_16.webp', 256), 'icon_pet_egg': ('icons/ui_17.webp', 256), 'icon_token': ('icons/ui_18.webp', 256),
    'bg_armory': ('bg/armory.jpg', 1920), 'bg_abyss': ('bg/abyss.jpg', 1920),
}

done = []
for res in ('res_pets1.json', 'res_pets2.json', 'res_icons.json', 'res_bgs.json'):
    data = load_json(GEN / res)
    for item in data['results']:
        if not item.get('success'):
            raise RuntimeError(f"{item.get('asset_id')}: generacja nieudana")
        aid = item['asset_id']
        out, size = MAP[aid]
        url = item['image_url_public']
        src = fetch(url, RAW / (aid + Path(url).suffix))
        dest = PUB / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src)
        if out.endswith('.jpg'):
            im = fit(im.convert('RGB'), size)
            im.save(dest, 'JPEG', quality=86, optimize=True, progressive=True)
        else:
            im = fit(trim(im.convert('RGBA')), size)
            im.save(dest, 'WEBP', quality=90, method=6)
        done.append((out, im.width, im.height, dest.stat().st_size))

for o, w, h, s in done:
    print(f'{o:24s} {w}x{h}  {s // 1024} KB')

# arkusz kontrolny
thumbs = [Image.open(PUB / o).convert('RGBA') for o, *_ in done if not o.endswith('.jpg')]
cell = 220
sheet = Image.new('RGBA', (cell * 6, cell * 2), (58, 52, 68, 255))
for i, t in enumerate(thumbs):
    t = t.copy(); t.thumbnail((cell - 16, cell - 16))
    x, y = (i % 6) * cell + (cell - t.width) // 2, (i // 6) * cell + (cell - t.height) // 2
    sheet.alpha_composite(t, (x, y))
sheet.convert('RGB').save(GEN / 'check_sheet.jpg', quality=88)
print('arkusz: check_sheet.jpg')
