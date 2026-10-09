#!/usr/bin/env python3
"""Génère docs/SCRIPT_VOIX_OFF.md depuis build/timeline.json et script/ecran.json (source unique)."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
ecran = json.load(open(os.path.join(ROOT, "script", "ecran.json"), encoding="utf-8"))["textes"]
tc = lambda s: f"{int(s // 60):02d}:{s % 60:05.2f}"
o = ["# SIGILLE · Script de la voix off (version française)", "",
     "Document généré par `tools/script_doc.py` à partir de `script/narration.json` et `script/ecran.json`.",
     "Ne pas modifier à la main : modifier les fichiers JSON, puis relancer `bash tools/assemble.sh`.", "",
     "## Consignes d'enregistrement", "",
     "- Voix française naturelle, posée, chaleureuse et assurée, accent neutre, débit modéré.",
     "- Pas de ton publicitaire appuyé. Laisser respirer les virgules.",
     "- Ne jamais cloner ni imiter la voix de la fondatrice ; la voix ne la représente pas.",
     "- Prononciation : **Sigille** se dit « si-jil » ; **sigille.fr** se dit « sigille point f r » ;",
     "  **CLOSED CIRCUIT** (libellé anglais de l'interface) n'est pas prononcé : la voix dit « circuit fermé ».",
     "- Un fichier par réplique : `voix/v01.wav` … `voix/v29.wav` (48 kHz, mono ou stéréo, sans silence en tête).",
     "  Le minutage, les sous-titres et le mixage se recalent automatiquement sur les durées réelles.", "",
     f"Durée du film : {t['total']:.0f} s. Minutage ci-dessous : estimation à 13,5 caractères par seconde", "(remplacée par la durée réelle dès que les fichiers voix existent).", ""]
for s in t["scenes"]:
    o += [f"## {s['id'].upper()} · {s['titre']} ({tc(s['debut'])} → {tc(s['fin'])})", ""]
    ec = [e for e in ecran if e["scene"] == s["id"]]
    if ec:
        o += ["Textes à l'écran :", ""] + [f"- `{tc(e['debut'])}` {e['texte'].replace('|', ' / ')}" for e in ec] + [""]
    o += ["| Réplique | Départ | Fin | Texte dit |", "|---|---|---|---|"]
    for r in t["repliques"]:
        if r["scene"] == s["id"]:
            o.append(f"| {r['id']} | {tc(r['start'])} | {tc(r['end'])} | {r['dit']} |")
    o.append("")
open(os.path.join(ROOT, "docs", "SCRIPT_VOIX_OFF.md"), "w", encoding="utf-8").write("\n".join(o))
print("→ docs/SCRIPT_VOIX_OFF.md")
