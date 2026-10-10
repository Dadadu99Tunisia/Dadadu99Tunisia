# SIGILLE · Manifeste des éléments et des licences

Film de lancement, version française (v2, 2 min 23 s). Inventaire de tout ce qui apparaît ou s'entend dans le film,
avec son origine et ses droits d'usage. Aucun élément n'a été inventé ou retouché pour simuler une
fonction absente.

## 1. Captures de l'application (réelles)

Toutes proviennent des preuves de recette du dépôt privé `Dadadu99Tunisia/abos-engine`, produites par
l'équipe sur l'application construite, avec des **dossiers fictifs de recette** (« M. DIALLO c/ Préfet
de police », « Dossier vide · Client test »). Les personnes et faits de ces dossiers sont fictifs.
Elles ne sont ni redessinées ni retouchées : le film les cadre, les déplace et pose des repères
(rectangles bleus ou orangés) par-dessus.

| Fichier du film | Source dans `abos-engine` (branche `cc-1-closed-circuit`) | Scène |
|---|---|---|
| `captures/00-pupitre.png` | `docs/finalisation/evidence/cabinet-intelligence-v1/captures/pupitre-summary-1440.png` | 03, 05 |
| `captures/01-dossier-vide-import.png` | `docs/finalisation/evidence/validation-finale/recette-globale/captures/05-sceau/etat-vide-1440.png` | 05 |
| `captures/02-chronologie.png` | `…/recette-globale/captures/05-sceau/contraste-renforce-1440.png` | 05 |
| `captures/03-piece-passage.png` | `…/recette-globale/captures/04-conclusions-v2/piece-passage-1440.png` | 05 |
| `captures/04-arguments.png` | `…/recette-globale/captures/04-conclusions-v2/arguments-1440.png` | 05 |
| `captures/05-redaction.png` | `…/recette-globale/captures/04-conclusions-v2/redaction-1920.png` | 03, 05 |
| `captures/06-reseau-closed-circuit.png` | `docs/finalisation/evidence/closed-circuit-cc1/cc1-reseau-closed.png`, **recadrée** (bas de l'image retiré : il contenait l'indicateur du serveur de développement Next.js, qui n'appartient pas au produit) | 04 |
| `frag/*.png` (29 fragments) | **Recadrages** de ces mêmes captures par `tools/fragments.py` (coordonnées dans `render/assets/frag/fragments.json`). Aucun pixel n'est modifié : le film isole un geste par plan. | v2 |
| `captures/07-licence-premier-lancement.png` | Capturée le 9 octobre 2026 pour ce film : build de production de `cc-1-closed-circuit` (`89162ca`), premier lancement. **Non utilisée au montage**, conservée comme preuve. | — |

Droits : propriété de SIGILLE. Aucune donnée client réelle.

## 2. Site sigille.fr

`site/home.png` (v2 : scène finale, vrai bouton « Être prévenu de l'ouverture »), `site/home-full.png`, `site/securite.png`, `site/tarifs.png` (v1) : captures du site
construit en local depuis `abos-engine` `main` @ `c43412e`, **le commit exact servi en production**
sur sigille.fr (déploiement Netlify `6ac2a813…`, publié le 4 octobre 2026, vérifié par l'API Netlify).
Le domaine sigille.fr n'était pas joignable depuis l'environnement de production du film (politique
réseau) : la capture locale du même code a été préférée à toute reconstitution.
L'illustration « Bonjour Claire » de la page d'accueil est celle du site, telle quelle.

## 3. Identité visuelle

| Élément | Origine |
|---|---|
| Symbole SIGILLE | Tracé officiel `website/components/Logo.tsx` (`MARK_PATH`), géométrie inchangée, couleur blanche (autorisée : cobalt, blanc ou encre) |
| Couleurs | `website/app/globals.css` : encre `#0b1424`, cobalt `#004aad`, cobalt sur encre `#5b8fe0` / `#9dbbee`, signal (orange) éclairci pour fond sombre |
| Mot SIGILLE | Composé en Onest, capitales espacées, comme dans l'interface |

## 4. Polices (licence libre SIL Open Font License 1.1, usage commercial autorisé)

| Police | Usage | Source |
|---|---|---|
| Newsreader (Production Type) | énoncés éditoriaux, étapes | Google Fonts |
| Onest (Dmitri Voloshin) | titres, textes, sous-titres incrustés | Google Fonts (`ttf/Onest-Medium.ttf` pour libass) |
| JetBrains Mono (JetBrains) | références, dates, mentions | Google Fonts |

Ce sont les trois polices du site sigille.fr (`website/app/layout.tsx`).

## 5. Musique et sons

**Entièrement originaux**, synthétisés par `tools/music.py` (Python, NumPy, SciPy) sur la timeline réelle
du film : nappes, bourdon, cloches, pulsation, arpèges, clics feutrés, souffles de transition. Aucun
échantillon, aucune bibliothèque sonore, aucune musique tierce. Droits : propriété de SIGILLE, sans
redevance. Graine aléatoire fixe : son reproductible à l'identique.

## 6. Voix off (v2)

| Élément | Licence | Usage |
|---|---|---|
| Modèle de voix `fr_FR-siwis-medium` (Piper), entraîné sur le corpus **SIWIS French Speech Synthesis Database** (University of Edinburgh, datashare 10283/2353) | **CC BY 4.0** : usage commercial autorisé, **attribution obligatoire** | voix du film |
| Moteur sherpa-onnx (k2-fsa) | Apache 2.0 | synthèse locale |
| Données de phonétisation espeak-ng | GPL 3.0 | utilisées localement à la génération, non distribuées avec le film |
| Whisper small (OpenAI), version sherpa-onnx | MIT | contrôle d'intelligibilité uniquement |

Mention d'attribution à joindre à toute diffusion (description de la vidéo, page qui l'héberge) :
> Voix de synthèse : modèle Piper fr_FR-siwis-medium, entraîné sur le SIWIS French Speech Synthesis
> Database (University of Edinburgh), licence CC BY 4.0.

Aucune voix n'a été clonée ni imitée ; la voix n'est pas celle de la fondatrice et le film ne le laisse
pas entendre. Pour une diffusion premium, un enregistrement par comédien·ne (cession de droits écrite)
peut remplacer la synthèse sans retoucher l'image : voir `docs/SCRIPT_VOIX_OFF.md`.

Les modèles Magnific / ElevenLabs n'ont pas pu être utilisés (offre gratuite sans quota disponible) ;
les voix Piper `tom` (AGPL) et `upmc` (CC BY-SA) ont été écartées pour leurs licences moins nettes.

## 7. Ce qui n'est pas dans le film, volontairement

Aucun visage, aucun avatar, aucune fondatrice à l'écran, aucun témoignage, aucun logo client, aucun
partenaire, aucune certification, aucun chiffre de performance, aucune statistique de marché, aucune
image d'archive (tribunaux, poignées de main, robots).
