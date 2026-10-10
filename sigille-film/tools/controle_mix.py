#!/usr/bin/env python3
"""Contrôle du mixage final : pour chaque réplique, on extrait du MP4 la fenêtre [début, fin] de la
timeline et on la fait retranscrire par Whisper. Vérifie à la fois l'intelligibilité de la voix sous la
musique et sa synchronisation avec le minutage (donc avec les sous-titres).
Usage : python tools/controle_mix.py out/SIGILLE_film_FR_web.mp4"""
import json, os, subprocess, sys, difflib, re
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voix import recognizer, norm, ROOT

video = sys.argv[1]
t = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", video, "-vn", "-ar", "16000", "-ac", "1", "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
rec = recognizer(); tot_e = tot_n = 0; res = []
for r in t["repliques"]:
    a, b = int((r["start"] - 0.05) * 16000), int((r["end"] + 0.15) * 16000)
    x = np.concatenate([np.zeros(4800, np.float32), audio[a:b], np.zeros(24000, np.float32)])
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st)
    heard = st.result.text.strip()
    ref, hyp = norm(r["dit"]).split(), norm(heard).split()
    hyp = ["sigille" if re.fullmatch(r"s[iy][gjz]+[iyeè]?l*e?s?", w) else w for w in hyp]
    ops = [o for o in difflib.SequenceMatcher(a=ref, b=hyp).get_opcodes() if o[0] != "equal"]
    e = sum(max(i2 - i1, j2 - j1) for _, i1, i2, j1, j2 in ops); tot_e += e; tot_n += len(ref)
    res.append({"id": r["id"], "erreurs": e, "mots": len(ref), "entendu": heard})
    if e: print(f"{r['id']}  {e}/{len(ref)}  " + "; ".join(" ".join(ref[i1:i2]) + " → " + " ".join(hyp[j1:j2]) for _, i1, i2, j1, j2 in ops))
wer = tot_e / tot_n
json.dump({"video": os.path.basename(video), "taux_erreur_mots": round(wer, 4), "repliques": res},
          open(os.path.join(ROOT, "build", "controle_mix.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Mixage final, voix sous musique : taux d'erreur de mots {wer * 100:.1f} % sur {tot_n} mots")
