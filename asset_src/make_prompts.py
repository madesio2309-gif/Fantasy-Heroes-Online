import os, json
OUT = os.path.join(os.path.dirname(__file__), "prompts")
os.makedirs(OUT, exist_ok=True)
STYLE = ("Stylized hand-painted fantasy RPG game art, modern premium mobile game style, bold clean dark outlines, "
         "rich saturated colors, soft cel shading with painted highlights, slightly humorous exaggerated proportions, "
         "highly detailed costume and equipment, crisp sharp edges.")
HERO = ("Single full-body character, entire body visible from head to feet, standing in a confident battle-ready idle pose, "
        "three-quarter side view facing RIGHT, centered with generous empty padding around the figure, no ground, no shadow, no text, no logo. ")
heroes = {
 "warrior_a": "A muscular male warrior with a braided brown beard and a confident grin, steel and leather armor with a red cloth tabard, holding a huge two-handed sword.",
 "warrior_b": "A tough female warrior with long red braids and a horned steel helmet, fur-trimmed plate armor, a round wooden shield and a battle axe.",
 "mage_a": "An old male wizard with a long white beard, tall pointed deep indigo hat decorated with golden stars, flowing blue robes, holding a staff topped with a glowing cyan crystal.",
 "mage_b": "A young female sorceress in purple and gold robes with a hood down, short black hair, a floating open spellbook beside her and a small fireball in her raised hand.",
 "archer_a": "A male elf ranger in a green hooded cloak and leather armor, holding a carved longbow, quiver of arrows on his back, sly smile.",
 "archer_b": "A female huntress in teal and brown leather with a fox fur pauldron, feathers in her blonde ponytail, holding a recurve bow.",
 "assassin_a": "A male rogue assassin in dark hooded leather with a crimson scarf covering his face, holding two curved daggers in reverse grip, crouched stance.",
 "assassin_b": "A female assassin in black and violet leather, short white hair, a glowing green poisoned dagger in one hand, throwing knives on her belt.",
 "paladin_a": "A male paladin in shining white and gold plate armor with a blue cape, holding a holy warhammer and a tower shield with a golden sun emblem.",
 "paladin_b": "A female paladin in polished silver plate armor with gold trim and a white cape, holding a glowing longsword, golden sun emblem on her chest, braided blonde hair.",
}
for k, v in heroes.items():
    open(os.path.join(OUT, f"hero_{k}.txt"), "w", encoding="utf-8").write(HERO + v + " " + STYLE)

SHEET = ("A 4x4 grid sprite sheet containing exactly 16 different {what}, arranged in 4 rows and 4 columns. Each one is fully contained and centered "
         "inside its own equal square cell with wide empty margins, nothing crosses the cell boundaries, nothing overlaps, no grid lines, no borders, no frames, "
         "no text, no numbers, no ground, no shadows. {extra} Reading order left to right, top to bottom: {items}. " + STYLE)
sheets = {
 "enemies1": ("fantasy RPG monsters", "Every monster is shown full body facing LEFT in a menacing but funny pose.",
   "1 green slime wearing a tiny crown, 2 giant rat holding a rusty dagger, 3 sneaky goblin thief with a sack, 4 angry red mushroom creature, "
   "5 grey forest wolf, 6 skeleton warrior with sword and shield, 7 giant hairy spider, 8 bandit with a spiked club, 9 swamp frogman with a spear, "
   "10 giant vampire bat, 11 kobold miner with a pickaxe and helmet candle, 12 living scarecrow with a scythe, 13 green orc grunt with an axe, "
   "14 wild boar with big tusks, 15 red imp with a pitchfork, 16 zombie peasant with a pitchfork"),
 "enemies2": ("fantasy RPG monsters", "Every monster is shown full body facing LEFT in a menacing but funny pose.",
   "1 armored orc berserker with two axes, 2 dark elf witch with a staff, 3 mossy stone golem, 4 harpy with feathered wings, 5 werewolf, "
   "6 giant desert scorpion, 7 bandaged mummy, 8 fire salamander lizard, 9 blue ice troll with a club, 10 hooded cultist necromancer with a skull staff, "
   "11 minotaur with a giant axe, 12 ghostly wraith in tattered robes, 13 stone gargoyle with wings, 14 giant sand worm, 15 glowing crystal elemental, "
   "16 black armored shadow knight with a glowing red sword"),
 "weapons": ("fantasy RPG weapon item icons", "Each item is shown as a single game inventory icon at a slight diagonal angle.",
   "1 iron longsword, 2 flaming greatsword, 3 double-bladed battle axe, 4 heavy war hammer, 5 wooden staff with a green crystal, 6 arcane staff with a floating purple orb, "
   "7 magic wand with a star tip, 8 thick leather spellbook with glowing runes, 9 wooden longbow, 10 crossbow, 11 golden elven bow, 12 curved dagger, "
   "13 two crossed daggers, 14 dagger dripping green poison, 15 holy golden mace, 16 legendary radiant sword glowing with golden light"),
 "armor": ("fantasy RPG armor item icons", "Each item is shown as a single game inventory icon.",
   "1 leather cap, 2 steel knight helmet with visor, 3 horned viking helmet, 4 pointed blue wizard hat, 5 leather tunic, 6 steel plate chest armor, "
   "7 purple mage robe, 8 golden paladin cuirass with sun emblem, 9 pair of leather gloves, 10 pair of steel gauntlets, 11 pair of enchanted glowing blue gloves, "
   "12 pair of spiked black gauntlets, 13 pair of leather boots, 14 pair of steel armored boots, 15 pair of winged golden boots, 16 pair of dark shadow boots with purple smoke"),
 "jewelry": ("fantasy RPG jewelry item icons", "Each item is shown as a single game inventory icon.",
   "1 simple gold ring, 2 gold ring with a big ruby, 3 silver ring with a sapphire, 4 ring with an emerald, 5 bone skull ring, 6 ring shaped like a coiled dragon, "
   "7 silver ring with a glowing moonstone, 8 legendary ring with a rainbow gem, 9 wooden totem amulet on a cord, 10 silver pendant necklace, 11 ruby heart amulet, "
   "12 amulet with a magic eye, 13 holy golden sun amulet, 14 shark tooth necklace, 15 crescent moon amulet, 16 legendary phoenix feather amulet glowing orange"),
 "ui": ("fantasy RPG interface icons", "Each item is shown as a single bold game icon.",
   "1 pile of gold coins, 2 cluster of blue crystal gems, 3 wooden treasure chest, 4 golden legendary treasure chest, 5 red health potion bottle, "
   "6 blue bottle with a lightning bolt, 7 golden trophy cup, 8 rolled quest scroll with red seal, 9 old iron dungeon key, 10 two crossed swords, "
   "11 heraldic guild banner shield, 12 gift box with ribbon, 13 hourglass with sand, 14 golden star badge, 15 cartoon skull, 16 anvil with a hammer"),
}
for k, (what, extra, items) in sheets.items():
    open(os.path.join(OUT, f"sheet_{k}.txt"), "w", encoding="utf-8").write(SHEET.format(what=what, extra=extra, items=items))

BOSS = ("Single huge fantasy RPG boss monster, full body entirely visible, facing LEFT, imposing and slightly comical, dramatic pose, centered with generous empty padding, "
        "no ground, no shadow, no text. ")
bosses = {
 "b01_king_slime": "A gigantic green King Slime with a golden crown, a royal cape and a tiny scepter, angry eyes, gooey drips.",
 "b02_goblin_warlord": "A Goblin Warlord riding a huge armored war boar, wearing a spiked helmet, swinging a giant cleaver.",
 "b03_ancient_treant": "An Ancient Treant, a massive walking tree with a carved angry face, mossy bark, glowing green eyes, branch claws, mushrooms growing on it.",
 "b04_lich_king": "A Lich King, skeletal sorcerer in ornate dark purple robes and a spiked crown, holding a staff with a glowing green skull, ghostly flames.",
 "b05_swamp_hydra": "A three-headed Swamp Hydra, murky green scales, each head with a different silly angry expression, dripping swamp water.",
 "b06_pharaoh_sphinx": "A golden Sphinx Pharaoh with a lion body, human face wearing a blue and gold striped nemes headdress, glowing hieroglyph tattoos, golden wings.",
 "b07_frost_giant": "A Frost Giant with blue skin, a beard made of icicles, fur armor, holding a massive ice hammer, frosty breath.",
 "b08_demon_lord": "A Demon Lord with red skin, huge curved horns, bat wings, black spiked armor, a flaming whip and burning eyes.",
 "b09_volcano_dragon": "A colossal red Volcano Dragon with glowing lava cracks on its scales, spread wings, smoke from its nostrils.",
 "b10_void_titan": "A cosmic Void Titan, an enormous armored humanoid made of dark purple starry void energy with a cracked golden mask and floating rune rings.",
}
for k, v in bosses.items():
    open(os.path.join(OUT, f"boss_{k}.txt"), "w", encoding="utf-8").write(BOSS + v + " " + STYLE)

BG = ("Wide 16:9 side-view background scene for a 2D fantasy RPG battle and hub screen, painted like a theatre stage: a clear open flat ground area across the lower middle "
      "where characters will stand, interesting detailed scenery on the left, right and in the distance, strong depth with foreground, midground and background layers, "
      "no characters, no people, no creatures, no text, no UI. Stylized hand-painted fantasy art, modern premium mobile game style, rich saturated colors, painterly lighting, highly detailed, crisp. Scene: ")
bgs = {
 "hub": "A cozy fantasy town square at golden hour with a timber-framed tavern with a hanging sign, colorful market stalls, a stone fountain, banners and lanterns, a castle on a hill in the distance.",
 "forest": "An enchanted forest clearing with giant ancient trees, glowing mushrooms, soft god rays through the canopy, ferns and a mossy path.",
 "swamp": "A misty swamp with twisted dead trees, murky water, lily pads, glowing fireflies and an old witch hut in the distance under a teal sky.",
 "volcano": "A volcanic mountain pass with rivers of glowing lava, black jagged rocks, ash in the air and a dramatic red and orange sky.",
 "desert": "Ancient desert ruins with broken sandstone pillars, a half-buried giant statue, sand dunes and a blazing sun in a turquoise sky.",
 "dungeon": "A dark stone dungeon hall with burning torches on the walls, hanging chains, braziers, cracked flagstone floor and an ominous archway in the back.",
 "arena": "A grand fantasy colosseum arena with a sand floor, tall stone walls, colorful flags and banners, crowds as soft silhouettes in the stands, bright daylight.",
 "guildhall": "A warm guild hall interior with long wooden tables, heraldic banners, a roaring fireplace, mounted trophies, weapon racks and candle chandeliers.",
}
for k, v in bgs.items():
    open(os.path.join(OUT, f"bg_{k}.txt"), "w", encoding="utf-8").write(BG + v)
print("ok", len(os.listdir(OUT)))
