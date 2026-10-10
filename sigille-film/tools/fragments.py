#!/usr/bin/env python3
"""Découpe des fragments d'interface dans les captures réelles (aucune retouche : recadrage seul).
Sortie : render/assets/frag/<nom>.png + build/fragments.png (planche de contrôle)."""
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "render", "assets", "captures")
FRAG = {
    # Chronologie (02)
    "chrono-ligne1":   ("02-chronologie.png", (52, 250, 1052, 352)),
    "chrono-evenement1": ("02-chronologie.png", (126, 262, 785, 343)),
    "chrono-titre":    ("02-chronologie.png", (50, 140, 600, 206)),
    "chrono-alerte":   ("02-chronologie.png", (798, 178, 1060, 208)),
    "chrono-lignes":   ("02-chronologie.png", (50, 216, 1052, 706)),
    "chrono-contexte": ("02-chronologie.png", (1100, 115, 1420, 412)),
    # Pièce et passage (03)
    "piece-passage":   ("03-piece-passage.png", (205, 748, 942, 816)),
    "piece-reference": ("03-piece-passage.png", (104, 98, 266, 120)),
    "piece-entete":    ("03-piece-passage.png", (100, 96, 940, 232)),
    "piece-panneau":   ("03-piece-passage.png", (1078, 155, 1404, 476)),
    "piece-texte":     ("03-piece-passage.png", (110, 380, 1044, 900)),
    "piece-actions":   ("03-piece-passage.png", (108, 284, 876, 324)),
    # Dossier vide, import (01)
    "import-entete":   ("01-dossier-vide-import.png", (14, 112, 580, 196)),
    "import-carte1":   ("01-dossier-vide-import.png", (20, 212, 367, 358)),
    "import-carte2":   ("01-dossier-vide-import.png", (379, 212, 725, 358)),
    "import-carte3":   ("01-dossier-vide-import.png", (737, 212, 1084, 358)),
    "import-zone":     ("01-dossier-vide-import.png", (20, 422, 1084, 656)),
    # Arguments (04)
    "args-titre":      ("04-arguments.png", (18, 118, 700, 182)),
    "args-note":       ("04-arguments.png", (18, 212, 1044, 238)),
    "args-table":      ("04-arguments.png", (20, 270, 1084, 832)),
    # Rédaction (05, 1920 × 1080)
    "redac-entete":    ("05-redaction.png", (96, 80, 800, 186)),
    "redac-page":      ("05-redaction.png", (400, 300, 1140, 582)),
    "redac-paragraphes": ("05-redaction.png", (410, 600, 1130, 852)),
    "redac-paragraphe1": ("05-redaction.png", (410, 650, 1124, 726)),
    "redac-panneau":   ("05-redaction.png", (1462, 165, 1818, 482)),
    "redac-export":    ("05-redaction.png", (876, 192, 1438, 236)),
    # Réseau (06)
    "reseau-etat":     ("06-reseau-closed-circuit.png", (556, 280, 1372, 642)),
    "reseau-indicateur": ("06-reseau-closed-circuit.png", (1100, 14, 1308, 50)),
    # Pupitre (00)
    "pupitre-panneau": ("00-pupitre.png", (1062, 180, 1420, 640)),
}
out = os.path.join(ROOT, "render", "assets", "frag"); os.makedirs(out, exist_ok=True)
meta = {}
for name, (src, box) in FRAG.items():
    im = Image.open(os.path.join(C, src)).crop(box)
    im.save(os.path.join(out, name + ".png"))
    meta[name] = {"src": src, "box": box, "w": im.width, "h": im.height}
json.dump(meta, open(os.path.join(out, "fragments.json"), "w"), indent=1)
open(os.path.join(ROOT, "render", "frag.js"), "w").write("// Généré par tools/fragments.py\nwindow.FRAG = " + json.dumps({k: [v["w"], v["h"]] for k, v in meta.items()}) + ";\n")
# planche
W = 1800; y = 0; rows = []
for name in FRAG:
    im = Image.open(os.path.join(out, name + ".png")); s = min(1.0, 860 / im.width); rows.append((name, im.resize((int(im.width * s), int(im.height * s)))))
H = sum(r[1].height + 30 for r in rows[::2]) + 40
sheet = Image.new("RGB", (W, H), (40, 40, 48)); d = ImageDraw.Draw(sheet)
for i in range(0, len(rows), 2):
    h = 0
    for j, (name, im) in enumerate(rows[i:i + 2]):
        x = 20 + j * 890; d.text((x, y + 4), name, fill="yellow"); sheet.paste(im, (x, y + 22)); h = max(h, im.height)
    y += h + 30
os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
sheet.save(os.path.join(ROOT, "build", "fragments.png")); print(len(FRAG), "fragments")
