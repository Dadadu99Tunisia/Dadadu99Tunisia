#!/usr/bin/env python3
"""Bande sonore originale du film SIGILLE, entièrement synthétisée (aucun échantillon, aucune
musique tierce : aucune licence à acquérir).

Texture d'ouverture, nappe grave, sons de transition précis, développement rythmique minimal,
clôture assurée mais retenue. Les accents suivent script/ecran.json et les scènes de
script/narration.json, pour rester synchrones si le minutage change.

Sortie : build/musique.wav (48 kHz, stéréo, 24 bits), niveau de « lit » (environ -24 LUFS) pour
laisser la place à la voix. Usage : python3 tools/music.py
"""
import json, os
import numpy as np
from scipy.signal import butter, sosfilt
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, DUR = 48000, 300.0
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(1518)  # graine fixe : rendu reproductible

L = np.zeros(N); R = np.zeros(N)
nar = json.load(open(os.path.join(ROOT, "script", "narration.json"), encoding="utf-8"))
ecran = json.load(open(os.path.join(ROOT, "script", "ecran.json"), encoding="utf-8"))["textes"]
SC = {s["id"]: s for s in nar["scenes"]}


def hz(note):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n, acc, octv = note[0], note[1:-1], int(note[-1])
    semi = names[n] + (1 if acc == "#" else -1 if acc == "b" else 0) + (octv - 4) * 12
    return 440.0 * 2 ** (semi / 12)


def seg(a, b):
    return slice(int(a * SR), min(N, int(b * SR)))


def envelope(n, attack, release, sr=SR):
    e = np.ones(n)
    a, r = int(attack * sr), int(release * sr)
    if a: e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if r: e[-r:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def lowpass(x, fc, order=2):
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(sig, start, gain=1.0, pan=0.0):
    """Ajoute un signal mono à partir de start (s), pan -1 (gauche) … 1 (droite)."""
    i = int(start * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.cos((pan + 1) * np.pi / 4)
    R[i:j] += s * np.sin((pan + 1) * np.pi / 4)


def pad(notes, a, b, gain, attack=3.0, release=3.0, bright=900):
    """Nappe : voix légèrement désaccordées, harmoniques douces, filtrée, respiration lente."""
    n = int((b - a) * SR); t = np.arange(n) / SR
    e = envelope(n, attack, release)
    for k, note in enumerate(notes):
        f = hz(note)
        for ch, det in ((0, -0.0018), (1, 0.0021)):
            ph = rng.uniform(0, 2 * np.pi)
            ff = f * (1 + det)
            w = np.sin(2 * np.pi * ff * t + ph) + 0.28 * np.sin(4 * np.pi * ff * t + ph) + 0.1 * np.sin(6 * np.pi * ff * t)
            lfo = 1 + 0.12 * np.sin(2 * np.pi * (0.07 + 0.013 * k) * t + k)
            sig = lowpass(w * lfo * e, bright) * gain / len(notes)
            i = int(a * SR); j = min(N, i + n)
            (L if ch == 0 else R)[i:j] += sig[: j - i]


def bell(note, start, gain, decay=4.0, pan=0.0):
    f = hz(note); n = int(decay * 1.6 * SR); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.5)
         + 0.18 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5))
    e = np.exp(-t / decay) * (1 - np.exp(-t * 300))
    add(w * e, start, gain, pan)


def tick(start, gain=0.18, pan=0.0):
    """Son de transition précis : clic feutré + petit corps tonal (pas de « bruit de clavier »)."""
    n = int(0.25 * SR); t = np.arange(n) / SR
    noise = bandpass(rng.standard_normal(n), 2500, 7000) * np.exp(-t * 90)
    body = np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 28) * 0.4
    add(noise * 0.6 + body, start, gain, pan)


def whoosh(peak, gain=0.22, rise=1.3, fall=0.7):
    """Souffle filtré qui monte vers une transition de scène."""
    n = int((rise + fall) * SR); t = np.arange(n) / SR
    e = np.where(t < rise, (t / rise) ** 2.2, np.exp(-(t - rise) * 6))
    x = rng.standard_normal(n)
    # balayage du filtre : deux bandes fondues
    lo = bandpass(x, 200, 1200); hi = bandpass(x, 1200, 6000)
    k = np.clip(t / (rise + fall), 0, 1)
    sig = (lo * (1 - k) + hi * k) * e
    add(sig, peak - rise, gain, -0.3)
    add(bandpass(rng.standard_normal(n), 300, 5000) * e, peak - rise, gain * 0.7, 0.3)


def thump(start, gain=0.35, f=52):
    n = int(0.5 * SR); t = np.arange(n) / SR
    fr = f * (1 + 0.6 * np.exp(-t * 30))
    w = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 9)
    add(w, start, gain)


def pluck(note, start, gain=0.09, pan=0.0):
    f = hz(note); n = int(1.4 * SR); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)) * np.exp(-t * 3.2) * (1 - np.exp(-t * 500))
    add(lowpass(w, 2600), start, gain, pan)


def drone(a, b, f, gain):
    n = int((b - a) * SR); t = np.arange(n) / SR
    e = envelope(n, 4.0, 4.0)
    w = np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t + 0.3)
    w *= 1 + 0.15 * np.sin(2 * np.pi * 0.05 * t)
    add(w * e, a, gain)


# ── S01 · Ouverture : texture, tracé du symbole, cloche au remplissage ──
drone(0.0, 22.0, hz("D2"), 0.18)
n = int(4.0 * SR); tt = np.arange(n) / SR
glide = np.sin(2 * np.pi * np.cumsum(620 + 260 * (tt / 4.0) ** 1.5) / SR) * envelope(n, 1.2, 1.4)
add(glide, 0.6, 0.035, 0.2)
air = bandpass(rng.standard_normal(int(20 * SR)), 3000, 9000) * envelope(int(20 * SR), 5, 4)
add(air, 0.0, 0.012)
for note, dt, p in (("D4", 0.0, -0.2), ("A4", 0.05, 0.2), ("E5", 0.11, 0.0)):
    bell(note, 3.9 + dt, 0.08, decay=5.0, pan=p)
pad(["D3", "A3", "E4"], 4.0, 21.0, 0.16, attack=5, release=3)

# ── S02 · Le problème : nappe mineure, pouls, tension à la contradiction ──
pad(["D3", "F3", "A3", "C4"], 19.5, 37.0, 0.2, attack=3, release=2.5, bright=800)
pad(["Bb2", "D3", "F3", "A3"], 35.5, 55.5, 0.2, attack=2.5, release=1.5, bright=850)
pad(["E5", "F5"], 37.2, 44.5, 0.05, attack=1.5, release=2.5, bright=3000)  # frottement de seconde
drone(20.0, 56.0, hz("D2"), 0.22)
for k, tb in enumerate(np.arange(27.0, 52.6, 1.0)):
    thump(tb, 0.16 + 0.1 * min(1, k / 20))
whoosh(55.0, 0.2, rise=2.2)

# ── S03 · Voici SIGILLE : résolution majeure ──
for note, dt, p in (("D4", 0, -0.3), ("F#4", 0.04, 0.0), ("A4", 0.08, 0.3), ("E5", 0.14, 0.1)):
    bell(note, 55.9 + dt, 0.075, decay=6.0, pan=p)
pad(["D3", "A3", "F#4", "E5"], 55.2, 86.0, 0.2, attack=2.5, release=3, bright=1400)
drone(55.0, 86.0, hz("D2"), 0.2)

# ── S04 · Circuit fermé : pouls régulier, refus signalés par un son grave discret ──
pad(["B2", "D3", "F#3", "A3"], 85.0, 111.0, 0.18, attack=3, release=3, bright=1000)
pad(["G2", "D3", "G3", "B3"], 109.0, 137.0, 0.18, attack=3, release=3, bright=1000)
drone(85.0, 137.0, hz("D2"), 0.18)
for tb in np.arange(88.0, 134.0, 60 / 80):
    thump(tb, 0.12, f=48)
for k in range(4):  # chaque tentative de sortie refusée (film.js, scène 4)
    tr = 95.0 + 4.0 * k + 1.4
    if tr < 111: thump(tr, 0.22, f=70); tick(tr, 0.08, 0.4)

# ── S05 · Démonstration : développement rythmique minimal ──
prog = [(["D3", "A3", "F#4"], "D"), (["B2", "F#3", "D4"], "B"), (["G2", "D3", "B3"], "G"), (["A2", "E3", "C#4"], "A")]
arps = {"D": ["D4", "F#4", "A4", "E5"], "B": ["B3", "D4", "F#4", "C#5"], "G": ["G3", "B3", "D4", "A4"], "A": ["A3", "C#4", "E4", "B4"]}
t0, bar = 136.0, 8.0
k = 0
while t0 + k * bar < 218.0:
    notes, name = prog[k % 4]
    a = t0 + k * bar
    pad(notes, a - 0.8, min(219.0, a + bar + 0.8), 0.17, attack=1.2, release=1.2, bright=1100)
    for i, tb in enumerate(np.arange(a, min(217.0, a + bar), 0.5)):
        if i % 4 in (0, 1, 2, 3):
            pluck(arps[name][i % 4], tb, 0.05 + 0.02 * (i % 4 == 0), pan=(-0.35, 0.35)[i % 2])
    k += 1
drone(136.0, 219.0, hz("D2"), 0.16)
for tb in np.arange(136.0, 216.0, 1.0):
    thump(tb, 0.09, f=46)

# ── S06 · Vision : la nappe s'élève ──
pad(["G2", "D3", "B3", "F#4"], 217.5, 234.0, 0.2, attack=2, release=2.5, bright=1600)
pad(["A2", "E3", "C#4", "A4", "E5"], 232.0, 251.0, 0.2, attack=2.5, release=2.5, bright=1900)
drone(218.0, 251.0, hz("D2"), 0.16)
for i, tb in enumerate(np.arange(219.0, 248.0, 1.0)):
    pluck(["D5", "A4", "F#5", "E5"][i % 4], tb, 0.035, pan=(-0.4, 0.4)[i % 2])

# ── S07 · L'offre : chaleur, rythme allégé ──
pad(["D3", "A3", "F#4", "B4"], 249.5, 279.0, 0.19, attack=2, release=3, bright=1500)
drone(250.0, 279.0, hz("D2"), 0.15)
for i, tb in enumerate(np.arange(250.0, 276.0, 2.0)):
    pluck(["A4", "F#4", "D4", "E4"][i % 4], tb, 0.04)

# ── S08 · Clôture : accord final, extinction ──
for note, dt, p in (("D3", 0, 0), ("A3", 0.05, -0.3), ("F#4", 0.1, 0.3), ("E5", 0.16, 0.0)):
    bell(note, 280.5 + dt, 0.085, decay=8.0, pan=p)
pad(["D2", "A2", "D3", "F#3", "A3", "E4"], 278.0, 299.8, 0.22, attack=3, release=7, bright=1300)
tick(288.4, 0.12)

# ── Accents : transitions de scène et apparitions de textes ──
for s in nar["scenes"][1:]:
    if s["id"] != "s03": whoosh(s["debut"], 0.14)
for e in ecran:
    tick(e["debut"], 0.07 if e["style"] == "etape" else 0.1, 0.15)

# ── Mastering du lit : léger filtrage, limite douce, niveau ──
mix = np.stack([L, R])
mix = sosfilt(butter(2, 30, "high", fs=SR, output="sos"), mix, axis=1)
fade = np.ones(N); fade[-int(0.4 * SR):] = np.linspace(1, 0, int(0.4 * SR))
mix *= fade
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.3) / np.tanh(1.3) * 0.5  # crête à -6 dBFS environ ; niveau final fixé par loudnorm

os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
out = os.path.join(ROOT, "build", "musique.wav")
pcm = (np.clip(mix.T, -1, 1) * (2 ** 23 - 1)).astype("<i4")
raw = pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()  # 24 bits petit-boutiste
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(raw)
print("→", out)
