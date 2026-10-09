#!/usr/bin/env python3
"""Planche contact des images fixes : python3 tools/planche.py sortie.png img1.png img2.png ... (2 colonnes)."""
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
TW, TH, cols = 960, 540, 2
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * TW, rows * (TH + 26)), "white")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((TW, TH), Image.LANCZOS)
    x, y = (i % cols) * TW, (i // cols) * (TH + 26)
    sheet.paste(im, (x, y + 26)); d.text((x + 6, y + 6), f.split("/")[-1], fill="black")
sheet.save(out)
