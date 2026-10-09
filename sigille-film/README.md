# SIGILLE · Film de lancement (version française)

Film commercial de 5 minutes, sans visage : le produit, la typographie, le mouvement et le son
racontent l'histoire. Projet entièrement éditable : chaque image est calculée par du code à partir
de fichiers texte, ce qui permet de mettre le film à jour quand SIGILLE évolue.

## Livrables (`out/`)

| Fichier | Contenu |
|---|---|
| `SIGILLE_film_FR_master_1080p25.mp4` | Master 1920 × 1080, 25 i/s, H.264 High CRF 16, AAC 320 kb/s, sous-titres français incrustés |
| `SIGILLE_film_FR_sans-sous-titres_1080p25.mp4` | Même master sans sous-titres incrustés (post-production, sous-titres activables) |
| `SIGILLE_film_FR_web.mp4` | Version web compressée (environ 45 Mo), sous-titres incrustés, démarrage rapide |
| `SIGILLE_film_FR.srt` | Sous-titres français synchronisés avec la narration |
| `SIGILLE_musique_lit_-24LUFS.wav` | Musique seule, au niveau de « lit » pour le mixage avec la voix |
| `SIGILLE_voix_off_A_REMPLACER.wav` | Piste voix vide de 300 s, à remplacer par l'enregistrement |

> **Voix off non enregistrée à ce jour.** Les outils de synthèse vocale disponibles étaient bloqués
> (voir `docs/RAPPORT_RENDU_VALIDATION.md`). Le film est complet et diffusable en l'état avec
> sous-titres et musique ; la voix s'ajoute sans retoucher l'image.

> **Non versionnés** (dépôt public, film non publié) : les vidéos et WAV de `out/`, et les captures
> de `render/assets/captures/`, à recopier depuis `abos-engine` (chemins dans le manifeste).

## Documentation (`docs/`)

- `SCRIPT_VOIX_OFF.md` : narration complète et minutée, consignes d'enregistrement.
- `STORYBOARD.md` : découpage scène par scène, intentions, éléments à l'écran.
- `MANIFESTE_ASSETS_LICENCES.md` : origine et droits de chaque élément.
- `RAPPORT_RENDU_VALIDATION.md` : vérification du produit, contrôles du rendu, limites et blocages.

## Ajouter la voix off

1. Enregistrer une prise par réplique, nommée selon `docs/SCRIPT_VOIX_OFF.md` : `voix/v01.wav` … `voix/v29.wav`.
2. Lancer `bash tools/assemble.sh --render`.

Le minutage s'aligne sur les durées réelles, les sous-titres sont régénérés, la musique s'efface
sous la voix (compression en sidechain) et le tout est normalisé à -16 LUFS. Si une réplique
devient trop longue pour sa scène, le script s'arrête et la signale : raccourcir le texte ou
ajuster les bornes de la scène dans `script/narration.json`.

## Structure

```
script/narration.json   narration (texte dit + sous-titres), scènes, minutage  ← source unique
script/ecran.json       textes à l'écran et leurs instants
render/film.html|css|js moteur de scènes : window.render(t) dessine l'image à l'instant t
render/assets/          captures réelles, site, polices
tools/build_timeline.py minutage, SRT, ASS, render/data.js
tools/render.mjs        rendu image par image (Playwright + Chromium) vers FFmpeg
tools/music.py          bande sonore originale synthétisée
tools/assemble.sh       chaîne complète : minutage, musique, voix, mixage, encodages
tools/script_doc.py     génère docs/SCRIPT_VOIX_OFF.md
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

Rendu complet : environ 6 minutes sur 4 cœurs, puis 9 minutes d'encodage.

## Modifier le film

- Un texte dit ou un sous-titre : `script/narration.json`.
- Un texte à l'écran : `script/ecran.json`.
- Une capture : remplacer le fichier dans `render/assets/captures/` en gardant ses dimensions, ou
  mettre à jour dimensions, cadrages (`cam`) et repères (`focus`) dans `render/film.js`.
- Couleurs et polices : `render/film.css` (variables reprises du site).
