#!/usr/bin/env python3
"""Minutage du film (version 2) : la voix commande l'image.

Source : script/narration.json. Chaque réplique part 'pause' secondes après la fin de la précédente ;
une scène s'ouvre 'avance' secondes avant sa première réplique et se ferme 'apres' secondes après la
dernière (début de la scène suivante). Les durées viennent de voix/<id>.wav ; sans fichier, estimation
à 14 caractères par seconde.
Sorties : build/timeline.json, render/data.js, out/SIGILLE_film_FR.srt, build/sous-titres.ass
"""
import json, os, sys, wave, contextlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CPS = 14.0
MIN_CUE = 1.2


def wav_duration(path):
    with contextlib.closing(wave.open(path)) as w:
        return w.getnframes() / float(w.getframerate())


def fmt_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def fmt_ass(t):
    cs = int(round(t * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def main():
    data = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
    scenes = data["scenes"]
    lines = data["repliques"]
    out, errors = [], []
    t = data.get("debut", 1.0)
    scene_bounds = {}
    for i, sc in enumerate(scenes):
        own = [r for r in lines if r["scene"] == sc["id"]]
        if not own:  # scène musicale, sans voix
            if "duree" not in sc:
                errors.append(f"scène {sc['id']} sans réplique ni durée"); continue
            scene_bounds[sc["id"]] = [round(t, 3), round(t + sc["duree"], 3)]
            t += sc["duree"]
            continue
        if i > 0:
            t += sc["avance"]  # la scène précédente s'est fermée à t ; on laisse 'avance' d'image seule
        start_scene = t - sc["avance"]
        for k, r in enumerate(own):
            wav = os.path.join(ROOT, "voix", r["id"] + ".wav")
            dur, src = (wav_duration(wav), "voix") if os.path.exists(wav) else (len(r["dit"]) / CPS + 0.3, "estimation")
            if k: t += r["pause"]
            out.append({**r, "start": round(t, 3), "end": round(t + dur, 3), "duree": round(dur, 3), "source": src})
            t += dur
        t += sc["apres"]
        scene_bounds[sc["id"]] = [round(max(0.0, start_scene), 3), round(t, 3)]
    total = round(t + data.get("fin", 3.0), 3)
    sc_list = [{**sc, "debut": scene_bounds[sc["id"]][0], "fin": scene_bounds[sc["id"]][1]} for sc in scenes]
    sc_list[0]["debut"] = 0.0
    sc_list[-1]["fin"] = total

    cues = []
    for r in out:
        groups = [c.split("|") for c in r["st"].split("||")]
        if any(len(g) > 2 for g in groups):
            errors.append(f"{r['id']} : plus de 2 lignes dans un sous-titre")
        total_chars = sum(len(" ".join(g)) for g in groups)
        tt = r["start"]
        for g in groups:
            d = (r["end"] - r["start"]) * len(" ".join(g)) / total_chars
            cues.append({"start": tt, "end": tt + max(d, MIN_CUE) + 0.25, "lines": g, "id": r["id"]})
            tt += d
    for a, b in zip(cues, cues[1:]):
        if a["end"] > b["start"] - 0.04:
            a["end"] = b["start"] - 0.04

    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True); os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    timeline = {"total": total, "scenes": sc_list, "repliques": out, "cartons": cues}
    json.dump(timeline, open(os.path.join(ROOT, "build", "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "render", "data.js"), "w", encoding="utf-8") as f:
        f.write("// Généré par tools/build_timeline.py : ne pas modifier à la main.\nwindow.FILM = "
                + json.dumps({"total": total, "scenes": sc_list, "repliques": out}, ensure_ascii=False) + ";\n")
    with open(os.path.join(ROOT, "out", "SIGILLE_film_FR.srt"), "w", encoding="utf-8") as f:
        for i, c in enumerate(cues, 1):
            f.write(f"{i}\n{fmt_srt(c['start'])} --> {fmt_srt(c['end'])}\n" + "\n".join(c["lines"]) + "\n\n")
    ass = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # Texte blanc cassé sur bandeau encre translucide : lisible sur fond papier comme sur fond encre.
        "Style: SousTitre,Onest,38,&H00F2F4F7,&H00F2F4F7,&H33241409,&H40241409,0,0,0,0,100,100,0.2,0,4,13,0,2,220,220,54,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for c in cues:
        ass.append(f"Dialogue: 0,{fmt_ass(c['start'])},{fmt_ass(c['end'])},SousTitre,,0,0,0,,{{\\fad(120,120)}}" + "\\N".join(c["lines"]))
    open(os.path.join(ROOT, "build", "sous-titres.ass"), "w", encoding="utf-8").write("\n".join(ass) + "\n")

    for sc in sc_list:
        print(f"{sc['id']} {sc['titre']:<28} {sc['debut']:7.2f} → {sc['fin']:7.2f}  ({sc['fin'] - sc['debut']:.1f} s)")
    print(f"Total : {total:.2f} s · {len(out)} répliques ({sum(r['source'] == 'voix' for r in out)} voix réelles) · {len(cues)} sous-titres")
    if errors:
        print("\nERREURS :\n" + "\n".join(errors)); sys.exit(1)


if __name__ == "__main__":
    main()
