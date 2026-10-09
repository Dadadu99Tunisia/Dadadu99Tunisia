#!/usr/bin/env python3
"""Construit le minutage de la narration et les sous-titres (SRT + ASS).

Source : script/narration.json. Si voix/<id>.wav existe, sa durée réelle est utilisée ;
sinon la durée est estimée (débit posé : 13,5 caractères par seconde).
Sorties : build/timeline.json, out/SIGILLE_film_FR.srt, build/sous-titres.ass
Usage : python3 tools/build_timeline.py
"""
import json, os, sys, wave, contextlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CPS = 13.5          # caractères par seconde, voix posée
GAP = 0.55          # respiration entre deux répliques
MIN_CUE = 1.4       # durée minimale d'un sous-titre
TOTAL = 300.0


def wav_duration(path):
    with contextlib.closing(wave.open(path)) as w:
        return w.getnframes() / float(w.getframerate())


def fmt_srt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def fmt_ass(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def main():
    data = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
    scenes = {s["id"]: s for s in data["scenes"]}
    out, cursor, errors = [], 0.0, []
    for r in data["repliques"]:
        wav = os.path.join(ROOT, "voix", r["id"] + ".wav")
        if os.path.exists(wav):
            dur, src = wav_duration(wav), "voix"
        else:
            dur, src = len(r["dit"]) / CPS + 0.35, "estimation"
        start = r["debut"] if r["debut"] is not None else cursor + GAP
        end = start + dur
        sc = scenes[r["scene"]]
        if start < sc["debut"] or end > sc["fin"] - 0.4:
            errors.append(f"{r['id']} déborde de {sc['id']} : {start:.2f} → {end:.2f} (scène {sc['debut']} → {sc['fin']})")
        out.append({**r, "start": round(start, 3), "end": round(end, 3), "duree": round(dur, 3), "source": src})
        cursor = end

    # Découpage en sous-titres : cartons séparés par ||, 2 lignes maximum, temps au prorata des caractères.
    cues = []
    for r in out:
        groups = [c.split("|") for c in r["st"].split("||")]
        if any(len(g) > 2 for g in groups):
            errors.append(f"{r['id']} : plus de 2 lignes dans un sous-titre")
        total_chars = sum(len(" ".join(g)) for g in groups)
        t = r["start"]
        for g in groups:
            d = (r["end"] - r["start"]) * len(" ".join(g)) / total_chars
            cues.append({"start": t, "end": t + max(d, MIN_CUE), "lines": g, "id": r["id"]})
            t += d
    for a, b in zip(cues, cues[1:]):
        if a["end"] > b["start"] - 0.04:
            a["end"] = b["start"] - 0.04

    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    json.dump({"total": TOTAL, "scenes": data["scenes"], "repliques": out, "cartons": cues},
              open(os.path.join(ROOT, "build", "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    ecran = json.load(open(os.path.join(ROOT, "script", "ecran.json"), encoding="utf-8"))["textes"]
    with open(os.path.join(ROOT, "render", "data.js"), "w", encoding="utf-8") as f:
        f.write("// Généré par tools/build_timeline.py : ne pas modifier à la main.\nwindow.FILM = "
                + json.dumps({"total": TOTAL, "scenes": data["scenes"], "repliques": out, "ecran": ecran}, ensure_ascii=False)
                + ";\n")

    with open(os.path.join(ROOT, "out", "SIGILLE_film_FR.srt"), "w", encoding="utf-8") as f:
        for i, c in enumerate(cues, 1):
            f.write(f"{i}\n{fmt_srt(c['start'])} --> {fmt_srt(c['end'])}\n" + "\n".join(c["lines"]) + "\n\n")

    ass = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # Ivoire sur bandeau graphite translucide (BorderStyle 4 = boîte par ligne, libass).
        "Style: SousTitre,Onest,40,&H00E6EFF3,&H00E6EFF3,&H2E140B0B,&H5A140B0B,0,0,0,0,100,100,0.2,0,4,14,0,2,200,200,58,1",
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for c in cues:
        ass.append(f"Dialogue: 0,{fmt_ass(c['start'])},{fmt_ass(c['end'])},SousTitre,,0,0,0,,{{\\fad(140,140)}}" + "\\N".join(c["lines"]))
    open(os.path.join(ROOT, "build", "sous-titres.ass"), "w", encoding="utf-8").write("\n".join(ass) + "\n")

    for r in out:
        print(f"{r['id']} {r['scene']} {r['start']:7.2f} → {r['end']:7.2f}  ({r['duree']:.2f} s, {r['source']})")
    print(f"{len(cues)} sous-titres.")
    if errors:
        print("\nDÉBORDEMENTS :\n" + "\n".join(errors)); sys.exit(1)


if __name__ == "__main__":
    main()
