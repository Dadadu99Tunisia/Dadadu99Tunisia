# SIGILLE · Script de la voix off (v2)

Généré par `tools/script_doc.py` depuis `script/narration.json` et les durées réelles de la voix.
Ne pas modifier à la main : modifier le JSON puis relancer `bash tools/assemble.sh --render`.

Durée du film : 2:23.47. Signature : **« Chaque fait, sa pièce. »**

## Voix actuelle

Voix de synthèse locale `fr_FR-siwis-medium` (corpus SIWIS, CC BY 4.0), cinq prises par réplique,
prise retenue sur mesure d'intelligibilité (transcription Whisper small, locale). Taux d'erreur de mots du film : **4.3 %**.
Les écarts restants sont listés par réplique (homophones et nom de marque pour l'essentiel).

## Consignes pour un enregistrement par comédien·ne

- Français naturel, posé, chaleureux, assuré ; accent neutre ; aucun ton publicitaire appuyé.
- Jamais la voix de la fondatrice, ni un clone, ni une imitation.
- **Sigille** se dit « si-jil » ; **sigille.fr** : « sigille point f r ».
- Un fichier par réplique `voix/n01.wav` … `voix/n25.wav`, sans silence en tête. L'image, les sous-titres
  et le mixage se recalent sur les nouvelles durées (`bash tools/assemble.sh --render`).

## c00 · Ouverture : la contradiction (0:00.00 → 0:12.53)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n01 | 0:01.20 | 3.09 s | Le même fait. Deux pièces. Deux dates. | conforme |
| n02 | 0:04.99 | 1.14 s | Laquelle est la bonne ? | conforme |
| n03 | 0:07.13 | 4.00 s | Dans un dossier, une date fausse ne se voit pas. Jusqu'au jour où elle compte. | conforme |

## c01 · Titre (0:12.53 → 0:19.94)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n04 | 0:13.13 | 4.21 s | Sigille. Le poste de travail juridique où chaque fait garde sa source. | conforme |

## c02 · Importer (0:19.94 → 0:33.60)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n05 | 0:21.94 | 5.20 s | Vous déposez les pièces du dossier : PDF, documents Word, images, courriels. | courriels → courriel |
| n06 | 0:27.64 | 3.16 s | Sigille les lit sur votre poste, sans les envoyer ailleurs. | lit → lits |

## c03 · Comprendre (0:33.60 → 0:44.22)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n07 | 0:34.60 | 2.38 s | Il reconstitue la chronologie du dossier. | conforme |
| n08 | 0:37.48 | 3.94 s | Chaque événement est rattaché à la pièce dont il vient. Rien n'est inventé. | conforme |

## c04 · Vérifier (0:44.22 → 0:54.07)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n09 | 0:45.02 | 3.89 s | Quand les pièces se contredisent, Sigille ne choisit pas à votre place. | se → ; à →  |
| n10 | 0:49.41 | 2.06 s | Il vous le signale, pièce par pièce. | conforme |

## c05 · Remonter à la source (0:54.07 → 1:02.09)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n11 | 0:55.07 | 4.02 s | Un clic, et vous êtes dans la pièce : la page, le passage exact. | conforme |

## c06 · Argumenter (1:02.09 → 1:11.59)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n12 | 1:03.09 | 3.23 s | Les arguments partent du dossier, avec leurs points faibles. | conforme |
| n13 | 1:06.82 | 2.37 s | Aucune source juridique n'est inventée. | conforme |

## c07 · Rédiger, relire, exporter (1:11.59 → 1:28.36)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n14 | 1:12.59 | 2.98 s | Dans vos conclusions, chaque fait renvoie à sa pièce. | fait → fer |
| n15 | 1:16.18 | 5.41 s | Les propositions de l'intelligence artificielle restent à relire. La décision vous appartient. | conforme |
| n16 | 1:22.19 | 3.17 s | Puis vous exportez, en Word ou en PDF. | conforme |

## c07b · Montage : un seul espace de travail (1:28.36 → 1:35.36)

*Plan musical, sans voix.*

## c08 · Confidentialité (1:35.36 → 1:56.08)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n17 | 1:36.96 | 2.12 s | Vos dossiers restent sur votre poste. | conforme |
| n18 | 1:39.68 | 5.40 s | Un mode circuit fermé, en cours de validation, bloque les connexions sortantes et affiche son état. | conforme |
| n19 | 1:45.69 | 4.62 s | Lors d'un essai, il a refusé deux connexions de télémétrie venues d'un composant tiers. | deux connexions → de connexion; venues → venue |
| n20 | 1:50.91 | 2.97 s | Nous montrons nos essais tels qu'ils sont, limites comprises. | tels → telles |

## c09 · Signature (1:56.08 → 2:07.48)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n21 | 1:57.08 | 5.03 s | Précision. Traçabilité. Confidentialité. Des sources toujours affichées. | conforme |
| n22 | 2:02.80 | 2.88 s | Et une règle qui ne change pas : l'humain décide. | conforme |

## c10 · Appel à l'action (2:07.48 → 2:23.47)

| Réplique | Départ | Durée | Texte dit | Contrôle |
|---|---|---|---|---|
| n23 | 2:08.48 | 2.45 s | La souscription ouvre prochainement. | conforme |
| n24 | 2:11.43 | 4.07 s | Laissez votre adresse sur sigille point f r, pour être prévenu de l'ouverture. | conforme |
| n25 | 2:16.80 | 2.67 s | Sigille. Chaque fait, sa pièce. | sigille → sigele |
