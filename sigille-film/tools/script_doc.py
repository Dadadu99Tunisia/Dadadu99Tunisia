#!/usr/bin/env python3
"""Génère docs/SCRIPT_VOIX_OFF.md depuis build/timeline.json et build/voix_controle.json (source unique)."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
ctl_path = os.path.join(ROOT, "build", "voix_controle.json")
ctl = {r["id"]: r for r in json.load(open(ctl_path, encoding="utf-8"))["repliques"]} if os.path.exists(ctl_path) else {}
wer = json.load(open(ctl_path, encoding="utf-8"))["taux_erreur_mots"] if ctl else None
tc = lambda s: f"{int(s // 60)}:{s % 60:05.2f}"
o = ["# SIGILLE · Script de la voix off (v2)", "",
     "Généré par `tools/script_doc.py` depuis `script/narration.json` et les durées réelles de la voix.",
     "Ne pas modifier à la main : modifier le JSON puis relancer `bash tools/assemble.sh --render`.", "",
     f"Durée du film : {tc(t['total'])}. Signature : **« Chaque fait, sa pièce. »**", "",
     "## Voix actuelle", "",
     "Voix de synthèse locale `fr_FR-siwis-medium` (corpus SIWIS, CC BY 4.0), cinq prises par réplique,",
     "prise retenue sur mesure d'intelligibilité (transcription Whisper small, locale)."
     + (f" Taux d'erreur de mots du film : **{wer * 100:.1f} %**." if wer is not None else ""),
     "Les écarts restants sont listés par réplique (homophones et nom de marque pour l'essentiel).", "",
     "## Consignes pour un enregistrement par comédien·ne", "",
     "- Français naturel, posé, chaleureux, assuré ; accent neutre ; aucun ton publicitaire appuyé.",
     "- Jamais la voix de la fondatrice, ni un clone, ni une imitation.",
     "- **Sigille** se dit « si-jil » ; **sigille.fr** : « sigille point f r ».",
     "- Un fichier par réplique `voix/n01.wav` … `voix/n25.wav`, sans silence en tête. L'image, les sous-titres",
     "  et le mixage se recalent sur les nouvelles durées (`bash tools/assemble.sh --render`).", ""]
for s in t["scenes"]:
    o += [f"## {s['id']} · {s['titre']} ({tc(s['debut'])} → {tc(s['fin'])})", ""]
    rows = [r for r in t["repliques"] if r["scene"] == s["id"]]
    if not rows:
        o += ["*Plan musical, sans voix.*", ""]; continue
    o += ["| Réplique | Départ | Durée | Texte dit | Contrôle |", "|---|---|---|---|---|"]
    for r in rows:
        c = ctl.get(r["id"])
        chk = "conforme" if c and not c["erreurs_mots"] else ("; ".join(c["ecarts"]) if c else "")
        o.append(f"| {r['id']} | {tc(r['start'])} | {r['duree']:.2f} s | {r['dit']} | {chk} |")
    o.append("")
open(os.path.join(ROOT, "docs", "SCRIPT_VOIX_OFF.md"), "w", encoding="utf-8").write("\n".join(o))
print("→ docs/SCRIPT_VOIX_OFF.md")
