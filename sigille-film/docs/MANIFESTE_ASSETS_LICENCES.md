# SIGILLE · Manifeste des éléments et des licences

Film de lancement, version française. Inventaire de tout ce qui apparaît ou s'entend dans le film,
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
| `captures/07-licence-premier-lancement.png` | Capturée le 9 octobre 2026 pour ce film : build de production de `cc-1-closed-circuit` (`89162ca`), premier lancement. **Non utilisée au montage**, conservée comme preuve. | — |

Droits : propriété de SIGILLE. Aucune donnée client réelle.

## 2. Site sigille.fr

`site/home.png`, `site/home-full.png`, `site/securite.png`, `site/tarifs.png` : captures du site
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

**Entièrement originaux**, synthétisés par `tools/music.py` (Python, NumPy, SciPy) : nappes, bourdon,
cloches, pouls, clics feutrés, souffles de transition. Aucun échantillon, aucune bibliothèque sonore,
aucune musique tierce. Droits : propriété de SIGILLE, sans redevance. La graine aléatoire est fixe :
le son est reproductible à l'identique.

## 6. Voix off

**Non générée à ce jour** (voir le rapport de rendu, section « Blocages »). Aucune voix n'a été clonée,
imitée ou attribuée à la fondatrice. Le film est livré avec les sous-titres incrustés et une piste voix
vide (`out/SIGILLE_voix_off_A_REMPLACER.wav`).

Avant diffusion, la voix retenue devra être couverte par une licence d'usage commercial :
- comédien·ne enregistré·e : cession de droits écrite (diffusion web, salons, démonstrations, durée et territoires) ;
- synthèse vocale : vérifier que l'offre souscrite autorise l'usage commercial et la diffusion publique
  (l'offre gratuite Magnific / ElevenLabs testée ne le garantit pas et était épuisée).

## 7. Ce qui n'est pas dans le film, volontairement

Aucun visage, aucun avatar, aucune fondatrice à l'écran, aucun témoignage, aucun logo client, aucun
partenaire, aucune certification, aucun chiffre de performance, aucune statistique de marché, aucune
image d'archive (tribunaux, poignées de main, robots).
