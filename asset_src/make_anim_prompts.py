import os, json, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "anim", "prompts")
os.makedirs(OUT, exist_ok=True)

# Kolor kluczujący wg reguły sekcji 0 (postacie czerwone/fioletowe -> zielony; zielono-fioletowe -> niebieski)
CHROMA = {
    "warrior_a": ("#00FF00", "green"), "warrior_b": ("#00FF00", "green"),
    "mage_a": ("#00FF00", "green"), "mage_b": ("#00FF00", "green"),
    "archer_a": ("#FF00FF", "magenta"), "archer_b": ("#FF00FF", "magenta"),
    "assassin_a": ("#00FF00", "green"), "assassin_b": ("#0000FF", "blue"),
    "paladin_a": ("#FF00FF", "magenta"), "paladin_b": ("#FF00FF", "magenta"),
}
ACTION = {
    "warrior": "a powerful melee weapon attack toward the RIGHT: frame 1 battle-ready stance, frame 2 wind-up with the weapon raised high behind the head, frame 3 explosive forward step starting the swing, frame 4 full-extension strike with the weapon slashing down in front (apex), frame 5 follow-through with the weapon low, frame 6 recovering back toward the ready stance",
    "mage": "casting an attack spell toward the RIGHT: frame 1 ready stance holding the staff or spellbook, frame 2 drawing the staff or hand back while magic gathers, frame 3 leaning forward with growing glowing energy at the staff tip or hand, frame 4 thrusting the staff or hand forward releasing a bright burst of magic (apex), frame 5 small recoil with fading sparks, frame 6 recovering back toward the ready stance",
    "archer": "shooting the bow toward the RIGHT: frame 1 ready stance holding the bow, frame 2 nocking an arrow, frame 3 drawing the bowstring halfway, frame 4 full draw aiming right, frame 5 release with the bowstring snapping forward and the arrow gone (apex), frame 6 recovering back toward the ready stance",
    "assassin": "a fast dagger attack toward the RIGHT: frame 1 low crouched ready stance, frame 2 coiling back with daggers pulled in, frame 3 springing forward low, frame 4 lunging forward with a double dagger slash at full extension (apex), frame 5 follow-through crossing the blades, frame 6 recovering back toward the crouched stance",
    "paladin": "a holy weapon smash toward the RIGHT: frame 1 ready stance behind the shield or with the weapon, frame 2 raising the weapon high overhead glowing with golden light, frame 3 stepping forward bringing the weapon down, frame 4 heavy downward smash at full extension with a golden flash (apex), frame 5 follow-through with the weapon low, frame 6 recovering back toward the ready stance",
}

TPL = """Edit this image into a production 2D game animation strip.
[Image 1] is the identity and costume reference; preserve the exact same character, art style, proportions, outfit, colors, weapon and facing direction (facing RIGHT, side view) in every frame.
Create exactly 6 sequential frames of the character performing {action}, as ONE horizontal row of exactly 6 equal cells in chronological order left to right.
One complete full-body character per cell, fully inside its cell with generous padding; never crossing or touching cell boundaries. Identical camera, scale, ground baseline and horizontal centering in every cell. The character attacks in place without traveling across cells.
Distinct readable motion phases — no missing phase, no duplicated phase.
The entire strip has a perfectly flat solid {hex} {name} background with zero variation.
No text, labels, numbers, borders, grid lines, scenery, cast shadows, reflections, gradients, watermark, perspective drift or variable zoom."""

# adresy bazowych postaci z poprzednich wyników
urls = {}
for f in glob.glob(os.path.join(ROOT, "results", "*.json")):
    raw = open(f, "rb").read()
    txt = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig", errors="ignore")
    s = txt.find("{")
    if s < 0: continue
    try: d = json.loads(txt[s:])
    except Exception: continue
    for r in d.get("results", []):
        if r.get("success") and r.get("asset_id", "").startswith("hero_"):
            urls[r["asset_id"][5:]] = r["image_url_public"]

plan = []
for look, (hexc, name) in CHROMA.items():
    cls = look.split("_")[0]
    p = os.path.join(OUT, f"atk_{look}.txt")
    open(p, "w", encoding="utf-8").write(TPL.format(action=ACTION[cls], hex=hexc, name=name))
    plan.append({"look": look, "base": urls[look], "prompt": p, "chroma": hexc})
json.dump(plan, open(os.path.join(ROOT, "anim", "plan.json"), "w"), indent=1)
print(len(plan), "prompts")
