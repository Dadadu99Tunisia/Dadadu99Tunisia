#!/usr/bin/env python3
"""Bande sonore originale du film SIGILLE (v2), synthétisée : aucun échantillon, aucune musique tierce.

Écrite sur la timeline réelle (build/timeline.json) : les événements musicaux tombent sur les
répliques et les changements de scène. Tempo 96 battements par minute dans les chapitres produit.

  c00  tension : bourdon, horloge feutrée, accord dissonant au « ≠ »
  c01  le sceau : cloches, impact grave, nappe chaude
  c02-c07  le travail : pulsation, arpèges, accords qui changent toutes les deux mesures, montée
  c07b montage : pleine énergie, accent sur chaque plan
  c08  confidentialité : dépouillé, impulsions qui s'arrêtent net (les sorties refusées)
  c09  signature : un accord par mot
  c10  résolution, accord final, silence

Sortie : build/musique.wav (48 kHz, stéréo, 24 bits). Usage : python3 tools/music.py
"""
import json, os, wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "build", "timeline.json"), encoding="utf-8"))
SR = 48000
DUR = TL["total"]
N = int(SR * DUR)
rng = np.random.default_rng(1518)
L = np.zeros(N); R = np.zeros(N)
SC = {s["id"]: s for s in TL["scenes"]}
RP = {r["id"]: r for r in TL["repliques"]}
BPM = 96.0
BEAT = 60.0 / BPM


def hz(note):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    n, acc, octv = note[0], note[1:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + (1 if acc == "#" else -1 if acc == "b" else 0) + (octv - 4) * 12) / 12)


def envelope(n, attack, release):
    e = np.ones(n); a, r = int(attack * SR), int(release * SR)
    if a: e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if r: e[-r:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def lp(x, fc, o=2): return sosfilt(butter(o, fc, "low", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); i = max(0, i); j = min(N, i + len(sig) - a)
    s = sig[a:a + j - i] * gain
    L[i:j] += s * np.cos((pan + 1) * np.pi / 4); R[i:j] += s * np.sin((pan + 1) * np.pi / 4)


def pad(notes, a, b, gain, attack=2.0, release=2.0, bright=1000):
    n = int((b - a) * SR); t = np.arange(n) / SR; e = envelope(n, attack, release)
    for k, note in enumerate(notes):
        f = hz(note)
        for ch, det in ((-1, -0.002), (1, 0.0023)):
            ph = rng.uniform(0, 2 * np.pi); ff = f * (1 + det)
            w = np.sin(2 * np.pi * ff * t + ph) + 0.3 * np.sin(4 * np.pi * ff * t + ph) + 0.12 * np.sin(6 * np.pi * ff * t)
            w *= 1 + 0.1 * np.sin(2 * np.pi * (0.08 + 0.011 * k) * t + k)
            add(lp(w * e, bright) / len(notes), a, gain, ch * 0.6)


def bell(note, start, gain, decay=4.0, pan=0.0):
    f = hz(note); n = int(decay * 1.8 * SR); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.5) + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5))
    add(w * np.exp(-t / decay) * (1 - np.exp(-t * 300)), start, gain, pan)


def thump(start, gain=0.3, f=50, decay=9):
    n = int(0.6 * SR); t = np.arange(n) / SR
    fr = f * (1 + 0.7 * np.exp(-t * 28))
    add(np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * decay), start, gain)


def tick(start, gain=0.08, pan=0.0, hi=7000):
    n = int(0.12 * SR); t = np.arange(n) / SR
    add(bp(rng.standard_normal(n), 3000, hi) * np.exp(-t * 110) + 0.25 * np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 40), start, gain, pan)


def hat(start, gain=0.03, pan=0.0):
    n = int(0.08 * SR); t = np.arange(n) / SR
    add(bp(rng.standard_normal(n), 6000, 14000) * np.exp(-t * 70), start, gain, pan)


def pluck(note, start, gain=0.05, pan=0.0, decay=3.0):
    f = hz(note); n = int(1.3 * SR); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 7)) * np.exp(-t * decay) * (1 - np.exp(-t * 600))
    add(lp(w, 3200), start, gain, pan)


def whoosh(peak, gain=0.12, rise=1.0, fall=0.5):
    n = int((rise + fall) * SR); t = np.arange(n) / SR
    e = np.where(t < rise, (t / rise) ** 2.4, np.exp(-(t - rise) * 7))
    x = rng.standard_normal(n); k = np.clip(t / (rise + fall), 0, 1)
    add((bp(x, 250, 1400) * (1 - k) + bp(x, 1400, 7000) * k) * e, peak - rise, gain, -0.25)
    add(bp(rng.standard_normal(n), 300, 6000) * e, peak - rise, gain * 0.7, 0.25)


def drone(a, b, note, gain):
    n = int((b - a) * SR); t = np.arange(n) / SR; f = hz(note)
    w = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t + 0.3)) * (1 + 0.12 * np.sin(2 * np.pi * 0.06 * t))
    add(w * envelope(n, 2.5, 2.5), a, gain)


def s(id): return SC[id]["debut"], SC[id]["fin"]
def r(id): return RP[id]["start"]


# ── c00 · tension ──
a, b = s("c00")
drone(0.0, b + 0.6, "D2", 0.16)
pad(["D3", "A3", "C4"], 0.3, b + 0.4, 0.13, attack=3, release=1.0, bright=700)
for k, tt in enumerate(np.arange(0.8, b - 0.3, BEAT)):   # horloge feutrée
    tick(tt, 0.022 + 0.012 * (k % 2 == 0), 0.35 if k % 2 else -0.35, hi=5000)
t_neq = r("n01") + 2.4
for note, p in (("C5", -0.2), ("C#5", 0.2), ("G4", 0.0)):   # accord dissonant au « ≠ »
    bell(note, t_neq, 0.05, decay=2.4, pan=p)
thump(t_neq, 0.18, f=44)
whoosh(b, 0.14, rise=1.4)

# ── c01 · le sceau ──
a, b = s("c01")
thump(a + 0.05, 0.42, f=40, decay=5)
for note, dt, p in (("D4", 0, -0.3), ("F#4", 0.04, 0.0), ("A4", 0.08, 0.3), ("E5", 0.14, 0.1)):
    bell(note, a + 1.3 + dt, 0.07, decay=6.0, pan=p)
pad(["D3", "A3", "F#4", "E5"], a, b + 0.8, 0.17, attack=1.5, release=1.6, bright=1500)
drone(a, b + 0.8, "D2", 0.15)

# ── c02 → c07 · le travail ──
a0 = SC["c02"]["debut"]; b0 = SC["c07"]["fin"]
prog = [(["D3", "A3", "F#4"], ["D4", "F#4", "A4", "E5"]), (["B2", "F#3", "D4"], ["B3", "D4", "F#4", "C#5"]),
        (["G2", "D3", "B3"], ["G3", "B3", "D4", "A4"]), (["A2", "E3", "C#4"], ["A3", "C#4", "E4", "B4"])]
bar2 = 8 * BEAT   # deux mesures
k = 0; tt = a0
while tt < b0:
    chord, arp = prog[k % 4]
    pad(chord, tt - 0.4, min(b0 + 1.0, tt + bar2 + 0.4), 0.15, attack=0.8, release=0.8, bright=1200 + 60 * k)
    k += 1; tt += bar2
drone(a0, b0 + 0.6, "D2", 0.13)
intensity = lambda t: np.clip((t - a0) / (b0 - a0), 0, 1)
beat_i = 0; tt = a0
while tt < b0 - 0.2:
    it = float(intensity(tt))
    if beat_i % 2 == 0: thump(tt, 0.12 + 0.08 * it, f=48)
    hat(tt + BEAT / 2, 0.012 + 0.02 * it, 0.3)
    chord, arp = prog[int((tt - a0) // bar2) % 4]
    pluck(arp[beat_i % 4], tt, 0.035 + 0.02 * it, pan=(-0.35, 0.35)[beat_i % 2])
    if it > 0.45: pluck(arp[(beat_i + 2) % 4], tt + BEAT / 2, 0.02 + 0.015 * it, pan=(0.35, -0.35)[beat_i % 2])
    beat_i += 1; tt += BEAT
for id in ("c03", "c04", "c05", "c06", "c07"):   # passage de chapitre
    whoosh(SC[id]["debut"] + 0.15, 0.07, rise=0.7, fall=0.35)
for id in ("n05", "n07", "n09", "n11", "n12", "n14", "n15", "n16"):   # apparitions d'interface
    tick(r(id) + 0.9, 0.045, 0.2)

# ── c07b · montage ──
a, b = s("c07b")
whoosh(a, 0.15, rise=0.9)
pad(["D3", "A3", "D4", "F#4", "B4"], a - 0.2, b + 0.4, 0.2, attack=0.3, release=0.6, bright=2600)
d = (b - a - 1.6) / 6
for i in range(6):
    t0 = a + 0.2 + i * d
    thump(t0, 0.26, f=46); tick(t0, 0.07, (-0.4, 0.4)[i % 2])
    for j, note in enumerate(["D5", "A4", "F#5", "E5"]):
        pluck(note, t0 + j * d / 4, 0.045, pan=(-0.3, 0.3)[j % 2], decay=4.5)
bell("D5", b - 1.3, 0.06, decay=3.0)

# ── c08 · confidentialité ──
a, b = s("c08")
thump(a + 0.02, 0.3, f=38, decay=4)
drone(a, b + 0.6, "D2", 0.15)
pad(["B2", "F#3", "D4"], a, a + (b - a) / 2 + 1, 0.13, attack=2.5, release=2.0, bright=800)
pad(["G2", "D3", "B3"], a + (b - a) / 2 - 1, b + 0.6, 0.13, attack=2.0, release=1.6, bright=800)
for i in range(4):   # les sorties qui s'arrêtent à la limite du poste (film.js, c08)
    t0 = r("n18") + 0.6 + i * 0.5
    n = int(0.9 * SR); t = np.arange(n) / SR
    add(np.sin(2 * np.pi * np.cumsum(500 + 500 * t) / SR) * (t / 0.9) ** 2 * 0.3, t0, 0.05, (-0.2, 0.2)[i % 2])
    thump(t0 + 0.9, 0.12, f=70, decay=18); tick(t0 + 0.9, 0.05, 0.3)
for tt in np.arange(a + 1.0, b - 0.5, 2 * BEAT):
    pluck("F#5", tt, 0.018, 0.4, decay=5)

# ── c09 · signature : un accord par mot ──
a, b = s("c09")
n21 = RP["n21"]; parts = [1, 1.25, 1.45, 2.2]; acc = n21["start"]
for i, chord in enumerate([["D4", "A4"], ["B3", "F#4"], ["G3", "D4"], ["A3", "E4", "C#5"]]):
    for note in chord: bell(note, acc, 0.045, decay=3.5, pan=(-0.3, 0.3)[i % 2])
    thump(acc, 0.12, f=46)
    acc += parts[i] / sum(parts) * n21["duree"]
pad(["D3", "A3", "F#4", "B4"], a, b + 0.8, 0.16, attack=1.2, release=1.4, bright=1600)
t_h = r("n22") + 1.3
pad(["G2", "D3", "B3", "F#4"], t_h - 0.2, b + 0.8, 0.14, attack=0.8, release=1.2, bright=1900)

# ── c10 · résolution ──
a, b = s("c10")
pad(["D3", "A3", "F#4", "E5"], a - 0.4, r("n25") + 0.2, 0.15, attack=1.2, release=1.2, bright=1400)
for tt in np.arange(a + 0.2, r("n25") - 0.6, BEAT):
    hat(tt, 0.01, 0.3)
for tt in np.arange(a + 0.2, r("n25") - 0.6, 2 * BEAT):
    thump(tt, 0.08, f=48)
t_end = r("n25") - 0.1
thump(t_end, 0.32, f=40, decay=4)
for note, dt, p in (("D3", 0, 0), ("A3", 0.05, -0.3), ("F#4", 0.1, 0.3), ("E5", 0.16, 0.0), ("A5", 0.22, 0.2)):
    bell(note, t_end + dt, 0.07, decay=7.0, pan=p)
pad(["D2", "A2", "D3", "F#3", "A3", "E4"], t_end, DUR, 0.18, attack=0.6, release=4.5, bright=1300)

# ── mastering du lit musical ──
mix = np.stack([L, R])
mix = sosfilt(butter(2, 30, "high", fs=SR, output="sos"), mix, axis=1)
f_out = int(0.6 * SR); mix[:, -f_out:] *= np.linspace(1, 0, f_out)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.2) / np.tanh(1.2) * 0.5
os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
out = os.path.join(ROOT, "build", "musique.wav")
pcm = (np.clip(mix.T, -1, 1) * (2 ** 23 - 1)).astype("<i4")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes(pcm.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
print(f"→ {out} ({DUR:.2f} s)")
