#!/usr/bin/env python3
"""Génère l'icône AGOA CG (build/icon.png et build/icon.ico).

Charte de la gamme AGOA : carré de fond rouge agence, avec uniquement le code
de 2 ou 3 lettres, en gras. Pour changer la couleur ou le code, modifier les
deux constantes ci-dessous puis relancer : python3 scripts/make_icon.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

CODE = "CG"
RED = (200, 16, 46)  # à remplacer par le rouge exact de l'agence si besoin
WHITE = (255, 255, 255)
FONTS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
SIZE = 512
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build")


def find_font(px):
    for path in FONTS:
        if os.path.exists(path):
            return ImageFont.truetype(path, px)
    raise SystemExit("Aucune police grasse trouvée : ajoutez-en une à FONTS.")


def draw():
    img = Image.new("RGBA", (SIZE, SIZE), RED + (255,))
    d = ImageDraw.Draw(img)
    px = int(SIZE * 0.56)
    font = find_font(px)
    while True:
        box = d.textbbox((0, 0), CODE, font=font)
        if box[2] - box[0] <= SIZE * 0.72 or px < 40:
            break
        px -= 4
        font = find_font(px)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((SIZE - w) / 2 - box[0], (SIZE - h) / 2 - box[1]), CODE, font=font, fill=WHITE)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    img = draw()
    img.save(os.path.join(OUT, "icon.png"))
    img.save(os.path.join(OUT, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Icône générée dans", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
