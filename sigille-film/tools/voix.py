#!/usr/bin/env python3
"""Voix off de synthèse locale, contrôlée par transcription.

Synthèse : voix Piper « fr_FR-siwis-medium » (corpus SIWIS, licence CC BY 4.0, attribution requise)
exécutée localement par sherpa-onnx. Contrôle : chaque réplique est retranscrite par Whisper small
(local) et comparée au texte ; l'écart est consigné dans build/voix_controle.json.

Usage :
  python tools/voix.py synth   [--only v01,v02]   → voix/<id>.wav (48 kHz, mono), une prise
  python tools/voix.py best    [--only v01,v02]   → 5 prises par réplique, garde la plus intelligible
  python tools/voix.py check                       → build/voix_controle.json
Variables : SIGILLE_TTS_DIR (dossier des modèles, défaut /home/user/film-tts/voices).
Python : l'environnement qui a sherpa-onnx (voir README).

Une voix de synthèse n'est pas une voix de comédien : elle sert de narration provisoire ou
définitive selon la décision de la fondatrice. Remplacer voix/*.wav suffit pour changer de voix.
"""
import json, os, re, subprocess, sys, unicodedata, difflib
import numpy as np
import sherpa_onnx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TTS = os.environ.get("SIGILLE_TTS_DIR", "/home/user/film-tts/voices")
VOICE = os.path.join(TTS, "vits-piper-fr_FR-siwis-medium")
ASR = os.path.join(TTS, "sherpa-onnx-whisper-small")
SPEED = float(os.environ.get("SIGILLE_TTS_SPEED", 0.86))      # < 1 : voix posée, articulée
NOISE = float(os.environ.get("SIGILLE_TTS_NOISE", 0.6))       # variabilité (0.33 à 0.667)
NOISE_W = float(os.environ.get("SIGILLE_TTS_NOISE_W", 0.75))  # variabilité des durées

# Le moteur lit le texte : on l'aide sur les mots qu'il ne connaît pas (prononciation seule ;
# le sous-titre garde l'orthographe).
PRONONCE = [
    (r"\bSigille\b", "Sijile"),
    (r"\bsigille point f r\b", "sijile point èfe ère"),
    (r"\bPDF\b", "pé dé èfe"),
    (r"\bfait\b", "fè"),
]


def tts():
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=os.path.join(VOICE, "fr_FR-siwis-medium.onnx"),
                tokens=os.path.join(VOICE, "tokens.txt"),
                data_dir=os.path.join(VOICE, "espeak-ng-data"),
                noise_scale=NOISE, noise_scale_w=NOISE_W, length_scale=1.0),
            num_threads=4),
        max_num_sentences=1)
    return sherpa_onnx.OfflineTts(cfg)


def spoken(text):
    for a, b in PRONONCE:
        text = re.sub(a, b, text)
    return text.replace("«", "").replace("»", "")


def write_wav48(path, samples, sr):
    """Rééchantillonne en 48 kHz avec ffmpeg (meilleure qualité), ajoute 60 ms de silence en fin."""
    raw = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
                    "-af", "aresample=48000:resampler=soxr,highpass=f=70,apad=pad_dur=0.06",
                    "-c:a", "pcm_s24le", path], input=raw, check=True)


def synth(only=None):
    data = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
    os.makedirs(os.path.join(ROOT, "voix"), exist_ok=True)
    engine = tts()
    for r in data["repliques"]:
        if only and r["id"] not in only:
            continue
        a = engine.generate(spoken(r["dit"]), sid=0, speed=SPEED)
        x = np.array(a.samples, dtype=np.float32)
        # retire le silence de tête et de queue (seuil -45 dBFS)
        nz = np.where(np.abs(x) > 10 ** (-45 / 20))[0]
        if len(nz): x = x[max(0, nz[0] - int(0.02 * a.sample_rate)): nz[-1] + int(0.08 * a.sample_rate)]
        write_wav48(os.path.join(ROOT, "voix", r["id"] + ".wav"), x, a.sample_rate)
        print(f"{r['id']}  {len(x) / a.sample_rate:5.2f} s  {r['dit'][:70]}")


def norm(s):
    s = unicodedata.normalize("NFKC", s.lower())
    s = s.replace("sigille point f r", "sigille.fr").replace("’", "'")
    s = re.sub(r"[^\w' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def recognizer():
    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=os.path.join(ASR, "small-encoder.int8.onnx"), decoder=os.path.join(ASR, "small-decoder.int8.onnx"),
        tokens=os.path.join(ASR, "small-tokens.txt"), language="fr", task="transcribe", num_threads=4)


def score(rec, path, text):
    """Écart mot à mot entre le texte et ce que Whisper entend dans path : (erreurs, mots, entendu, écarts)."""
    pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ar", "16000", "-ac", "1", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32)
    x = np.concatenate([np.zeros(4800, np.float32), x, np.zeros(24000, np.float32)])
    st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st)
    heard = st.result.text.strip()
    ref, hyp = norm(text).split(), norm(heard).split()
    hyp = ["sigille" if re.fullmatch(r"s[iy][gjz]+[iyeè]?l*e?s?", w) else w for w in hyp]
    sm = difflib.SequenceMatcher(a=ref, b=hyp)
    ops = [o for o in sm.get_opcodes() if o[0] != "equal"]
    err = sum(max(i2 - i1, j2 - j1) for _, i1, i2, j1, j2 in ops)
    return err, len(ref), heard, [f"{' '.join(ref[i1:i2])} → {' '.join(hyp[j1:j2])}" for _, i1, i2, j1, j2 in ops]


def best(takes=5, only=None):
    """Plusieurs prises par réplique ; on garde la plus intelligible (moins d'écarts entendus)."""
    data = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
    os.makedirs(os.path.join(ROOT, "voix"), exist_ok=True)
    tmp = os.path.join(ROOT, "build", "prises"); os.makedirs(tmp, exist_ok=True)
    engine, rec = tts(), recognizer()
    for r in data["repliques"]:
        if only and r["id"] not in only:
            continue
        cands = []
        for k in range(takes):
            a = engine.generate(spoken(r["dit"]), sid=0, speed=SPEED)
            x = np.array(a.samples, dtype=np.float32)
            nz = np.where(np.abs(x) > 10 ** (-45 / 20))[0]
            if len(nz): x = x[max(0, nz[0] - int(0.02 * a.sample_rate)): nz[-1] + int(0.08 * a.sample_rate)]
            path = os.path.join(tmp, f"{r['id']}_{k}.wav")
            write_wav48(path, x, a.sample_rate)
            err, n, heard, _ = score(rec, path, r["dit"])
            cands.append((err, abs(len(x) / a.sample_rate - len(r["dit"]) / 14.0), path, heard))
            if err == 0: break
        cands.sort(key=lambda c: (c[0], c[1]))
        os.replace(cands[0][2], os.path.join(ROOT, "voix", r["id"] + ".wav"))
        print(f"{r['id']}  meilleure prise : {cands[0][0]} écart(s) sur {len(cands)} prise(s)")


def check():
    rec = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=os.path.join(ASR, "small-encoder.int8.onnx"), decoder=os.path.join(ASR, "small-decoder.int8.onnx"),
        tokens=os.path.join(ASR, "small-tokens.txt"), language="fr", task="transcribe", num_threads=4)
    data = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
    out, total_err, total_words = [], 0, 0
    for r in data["repliques"]:
        path = os.path.join(ROOT, "voix", r["id"] + ".wav")
        if not os.path.exists(path):
            continue
        pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-ar", "16000", "-ac", "1", "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
        x = np.frombuffer(pcm, dtype=np.float32)
        # Whisper (sherpa-onnx) tronque la fin sans marge : 0,3 s de silence avant, 1,5 s après.
        x = np.concatenate([np.zeros(4800, np.float32), x, np.zeros(24000, np.float32)])
        st = rec.create_stream(); st.accept_waveform(16000, x); rec.decode_stream(st)
        heard = st.result.text.strip()
        ref, hyp = norm(r["dit"]).split(), norm(heard).split()
        # Le mot de marque n'est pas dans le vocabulaire de Whisper : on l'accepte sous ses graphies proches.
        hyp = ["sigille" if re.fullmatch(r"s[iy][gj]+[iy]l+e?s?", w) else w for w in hyp]
        sm = difflib.SequenceMatcher(a=ref, b=hyp)
        err = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal")
        total_err += err; total_words += len(ref)
        diffs = [f"{' '.join(ref[i1:i2])!s} → {' '.join(hyp[j1:j2])!s}" for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
        out.append({"id": r["id"], "texte": r["dit"], "entendu": heard, "erreurs_mots": err, "mots": len(ref), "ecarts": diffs})
        print(f"{r['id']}  {err:2d}/{len(ref):2d}  {'; '.join(diffs)[:110]}")
    res = {"taux_erreur_mots": round(total_err / max(1, total_words), 4), "repliques": out}
    json.dump(res, open(os.path.join(ROOT, "build", "voix_controle.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Taux d'erreur de mots (WER) : {res['taux_erreur_mots'] * 100:.1f} %")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    if cmd == "synth": synth(only)
    elif cmd == "best": best(int(os.environ.get("SIGILLE_TTS_TAKES", 5)), only)
    elif cmd == "check": check()
    else: print(__doc__); sys.exit(1)
