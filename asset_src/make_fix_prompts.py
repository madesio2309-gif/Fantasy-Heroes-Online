import os
OUT = os.path.join(os.path.dirname(__file__), "prompts")
STYLE = ("Stylized hand-painted fantasy RPG game art, modern premium mobile game style, bold clean dark outlines, "
         "rich saturated colors, soft cel shading with painted highlights, slightly humorous exaggerated proportions, highly detailed, crisp sharp edges.")
P = ("Single fantasy RPG monster, full body entirely visible, facing LEFT in a menacing but funny pose, centered with generous empty padding, "
     "fully opaque solid colors, no ground, no shadow, no text. ")
items = {
 "e12": "A green orc grunt with a crude axe, leather armor and a big underbite.",
 "e13": "A wild brown boar with huge white tusks, bristly fur and angry red eyes.",
 "e14": "A small red imp devil with tiny wings, horns and a pitchfork, mischievous grin.",
 "e15": "A zombie peasant farmer with torn clothes, green skin and a pitchfork.",
 "e28": "A stone gargoyle with bat wings, horns and claws, grey stone skin with moss.",
 "e29": "A giant sand worm bursting upward with a round mouth full of teeth, sandy brown segmented body.",
 "e30": "A glowing crystal elemental golem made of blue and purple crystals with bright glowing core.",
}
for k, v in items.items():
    open(os.path.join(OUT, f"fix_{k}.txt"), "w", encoding="utf-8").write(P + v + " " + STYLE)
print("ok")
