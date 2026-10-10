# SIGILLE · Film de lancement (version française, v2)

Film produit de 2 min 23 s, sans visage : le produit, la voix off et la direction artistique portent le
film. Signature : **« Chaque fait, sa pièce. »** Chaque image est calculée par du code à partir de
fichiers texte ; le minutage découle de la voix réelle. La v1 (5 min, sans voix) est dans l'historique.

## Livrables (`out/`, non versionnés : dépôt public, film non publié)

| Fichier | Contenu |
|---|---|
| `SIGILLE_film_FR_master_1080p25.mp4` | Master 1920 × 1080, 25 i/s, H.264 High CRF 16, AAC 320 kb/s, voix, sous-titres incrustés |
| `SIGILLE_film_FR_sans-sous-titres_1080p25.mp4` | Même master sans sous-titres incrustés |
| `SIGILLE_film_FR_web.mp4` | Version web (16 Mo), sous-titres incrustés, démarrage rapide |
| `SIGILLE_film_FR.srt` | Sous-titres français synchronisés (versionné) |
| `SIGILLE_voix_off_seule.wav` | Voix off seule, placée sur la timeline |
| `SIGILLE_musique_lit_-24LUFS.wav` | Musique seule, niveau de « lit » |

Également non versionnés : `voix/*.wav`, `render/assets/captures/` et `render/assets/frag/` (issus du
dépôt privé `abos-engine`, chemins dans le manifeste ; `tools/fragments.py` régénère les fragments).

## Documentation (`docs/`)

- `AUDIT_REFERENCE_LEGORA.md` : comparaison avec la référence, écarts de la v1, direction de la v2.
- `SCRIPT_VOIX_OFF.md` : narration minutée, contrôle d'intelligibilité par réplique, consignes comédien.
- `STORYBOARD.md` : plans, direction artistique, son.
- `MANIFESTE_ASSETS_LICENCES.md` : origine et droits de chaque élément, attribution de la voix.
- `RAPPORT_RENDU_VALIDATION.md` : vérité produit, preuves de chaque phrase, contrôles mesurés, limites.

## Refaire le film

```
python3 tools/fragments.py                         # fragments d'interface depuis les captures
python tools/voix.py best                           # voix : 5 prises par réplique, la plus intelligible
bash tools/assemble.sh --render                     # minutage, musique, image, mixage, encodages
python tools/controle_mix.py out/SIGILLE_film_FR_web.mp4   # intelligibilité dans le mixage final
```

`tools/voix.py` et `tools/controle_mix.py` demandent un Python avec `sherpa-onnx` et les modèles
`vits-piper-fr_FR-siwis-medium` et `sherpa-onnx-whisper-small` (versions publiées par k2-fsa/sherpa-onnx
sur GitHub ; dossier indiqué par `SIGILLE_TTS_DIR`). Pour une voix de comédien : déposer
`voix/n01.wav` … `voix/n25.wav` et relancer `bash tools/assemble.sh --render`.

## Structure

```
script/narration.json   narration (texte dit + sous-titres), scènes, pauses  ← source unique
render/film.html|css|js moteur de scènes : window.render(t) dessine l'image à l'instant t
render/assets/          captures réelles, fragments, site, polices
render/frag.js          dimensions des fragments (généré)
tools/build_timeline.py minutage, SRT, ASS, render/data.js
tools/render.mjs        rendu image par image (Playwright + Chromium) vers FFmpeg
tools/music.py          bande sonore originale synthétisée
tools/assemble.sh       chaîne complète : minutage, musique, voix, mixage, encodages
tools/script_doc.py     génère docs/SCRIPT_VOIX_OFF.md
tools/fragments.py      découpe les fragments d'interface
tools/voix.py           voix off locale et contrôle par transcription
tools/controle_mix.py   intelligibilité de la voix dans le mixage final
tools/planche.py        planches contact pour la vérification visuelle
```

## Prérequis

Node 20+, Python 3 avec NumPy, SciPy et Pillow, FFmpeg avec libass, Chromium.

```
cd tools && npm install          # Playwright 1.56.1 (sans téléchargement de navigateur si
                                 # PLAYWRIGHT_BROWSERS_PATH ou CHROMIUM_PATH est défini)
cd .. && bash tools/assemble.sh --render
node tools/render.mjs stills 12 61.5 140   # images de contrôle dans build/stills/
```

Rendu complet : environ 4 minutes sur 4 cœurs, puis 5 minutes d'encodage.

## Modifier le film

- Un texte dit : `script/narration.json`, puis `python tools/voix.py best --only nXX` et `--render`.
- Un plan : la scène correspondante dans `render/film.js` (chaque plan est accroché à une réplique).
- Un fragment : coordonnées dans `tools/fragments.py` ; repères en coordonnées du fragment.
- Couleurs et polices : `render/film.css` (variables reprises du site).
