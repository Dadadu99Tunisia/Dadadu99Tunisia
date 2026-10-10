# SIGILLE · Rapport de rendu et de validation (v2)

Date : 10 octobre 2026. Échéance : 15 octobre 2026.
Statut : **film v2 rendu et vérifié, avec voix off, prêt pour relecture.** Non publié, non déployé.
La v1 (5 min, sans voix) et son rapport restent dans l'historique git (commits `aefc430`, `21a750d`).
Comparaison avec la référence et choix de direction : `docs/AUDIT_REFERENCE_LEGORA.md`.

## 1. Vérité produit (inchangée depuis la v1)

| Question | Constat | Preuve |
|---|---|---|
| Fonctions montrées | Import, chronologie, contradictions, provenance pièce/page/passage, arguments, rédaction sourcée, export Word et PDF : **PASS en recette** sur l'application construite | `abos-engine` `docs/finalisation/FINAL_PRODUCTION_READINESS.md` |
| IA | Propositions marquées « Expérimental » dans l'interface ; qualité **non prouvée** ; le film dit « restent à relire » | idem §4 |
| Circuit fermé | Branche `cc-1-closed-circuit` seulement, non distribuée ; essai du 9 octobre 2026 en environnement de test | `CC_1_CLOSED_CIRCUIT.md` |
| Paiement | Fermé en production (« CHECKOUT LIVE ALLOWED: NO ») | `PRODUCTION_CHECKOUT_STATUS.md` |
| Appel à l'action | « Être prévenu de l'ouverture », parcours principal réel de sigille.fr (`/essai`), montré sur le vrai site | `website/app/essai`, `components/HeroCinema.tsx` |

## 2. Affirmations de la v2 et leurs preuves

| Phrase du film | Ce qui la fonde |
|---|---|
| « Le même fait. Deux pièces. Deux dates. » | Fragments réels : scolarité du 05/01/2015 (chronologie, pièce 6) et du 9 septembre 2015 (pièce 24), même dossier fictif |
| « Sigille les lit sur votre poste, sans les envoyer ailleurs. » | Texte de l'interface : « Sigille les lit en local … sans rien envoyer à l'extérieur » |
| « Chaque événement est rattaché à la pièce dont il vient. Rien n'est inventé. » | Chronologie : colonne Sources ; « rien n'est inventé » dans l'interface |
| « Sigille ne choisit pas à votre place. Il vous le signale. » | « 175 dates contradictoires à vérifier », état « Date contradictoire » |
| « Un clic, et vous êtes dans la pièce : la page, le passage exact. » | Panneau « Passage actif », passage surligné, « Pièce 24 · 1 page · page 1 » |
| « Aucune source juridique n'est inventée. » | Texte de l'interface (Arguments) |
| « Les propositions de l'IA restent à relire. La décision vous appartient. » | « Expérimental · Propositions du moteur local, toujours à relire avant de remplacer » ; « Confirmer ce fait » |
| « Vous exportez, en Word ou en PDF. » | Boutons réels ; recette PASS |
| « Vos dossiers restent sur votre poste. » | Stockage local (SQLite par cabinet, `COMMERCIAL_ACCESS_TRUTH.md` §2.1) |
| Circuit fermé, essai, limites | Dits tels quels, avec mention « en cours de validation », date, environnement, limites |
| « La souscription ouvre prochainement. » | Site en ligne, `/tarifs` et `/essai` |

Aucun client, témoignage, partenaire, certification, chiffre de performance ou garantie de sécurité.

## 3. Production

- **Image** : `render/film.js` (moteur v2), rendu image par image (Chromium) vers FFmpeg, 4 processus.
  29 fragments réels découpés par `tools/fragments.py` ; repères placés par **mesure automatique de la
  position des mots** (segmentation des pixels), pas à l'œil.
- **Voix** : `tools/voix.py`, synthèse locale `fr_FR-siwis-medium` (CC BY 4.0) via sherpa-onnx, débit
  0,86, cinq prises par réplique, prise retenue sur mesure d'intelligibilité (Whisper small, local).
  Prononciations corrigées : « Sigille » (si-jil), « fait » (fè), « PDF » ; deux répliques reformulées
  pour la diction.
- **Minutage** : `tools/build_timeline.py` ; la voix commande l'image et les sous-titres.
- **Son** : `tools/music.py`, bande originale synthétisée sur la timeline (96 battements par minute).
  Mixage : voix compressée et éclaircie, musique −9 dB et effacée sous la voix (sidechain), normalisation
  −16 LUFS, crête vraie −1,5 dBTP.

## 4. Contrôles sur les fichiers rendus

| Fichier | Images | Durée | Erreurs de décodage | Niveau | Crête | Taille |
|---|---|---|---|---|---|---|
| `SIGILLE_film_FR_master_1080p25.mp4` | 3 586 (1920 × 1080, 25 i/s) | 143,47 s | 0 | −16,2 LUFS | −1,5 dBFS | 35 Mo |
| `SIGILLE_film_FR_sans-sous-titres_1080p25.mp4` | 3 586 | 143,47 s | 0 | −16,2 LUFS | −1,5 dBFS | 34 Mo |
| `SIGILLE_film_FR_web.mp4` | 3 586 | 143,47 s | 0 | −16,2 LUFS | −1,5 dBFS | 16 Mo |

**Intelligibilité, mesurée.** Voix seule : 4,3 % de mots mal retranscrits par Whisper. Mixage final
(voix sous la musique, extraite du MP4 réplique par réplique) : **8,1 %** sur 234 mots. Les écarts
restants sont surtout des homophones (« leurs points faibles » / « leur point faible », « tels » /
« telles », « limites » / « limite ») ou le nom de marque, inconnu de Whisper. Détail :
`build/controle_mix.json`.

**Synchronisation.** Chaque réplique est reconnue dans sa propre fenêtre de la timeline : la voix est
calée sur le minutage, dont découlent les sous-titres (26 cartons, 2 lignes maximum, 0 chevauchement).

**Image.** 29 images extraites du fichier web final (sous-titres compris), toutes scènes et transitions,
examinées en planche. Défauts corrigés avant le rendu final : repères de dates et de liens mal placés
(remesurés automatiquement), chapitre « Importer » décentré, mots de la signature décentrés.

**Langue.** Tous les textes dits, sous-titrés et affichés passent le correcteur Hunspell français ; seuls
restent SIGILLE, sigille.fr et Word. Anglais à l'écran : uniquement « CLOSED CIRCUIT: ACTIVE », libellé
réel de l'interface, traduit par la voix (« circuit fermé »).

## 5. Limites, dites telles quelles

1. **Voix de synthèse.** Intelligible et contrôlée, mais une voix de synthèse n'a pas la chaleur d'un
   comédien. Aucune écoute humaine n'a été possible ici (pas de sortie audio) : **une écoute avant
   diffusion est indispensable**. Remplacement sans retouche d'image : `docs/SCRIPT_VOIX_OFF.md`.
2. **Attribution obligatoire** de la voix (CC BY 4.0) dans la description de la vidéo : texte prêt dans
   `docs/MANIFESTE_ASSETS_LICENCES.md` §6.
3. **Démonstration en fragments de captures**, pas en enregistrement d'écran : l'application exige une
   licence au lancement et les contournements ont été refusés par la politique de sécurité de la session.
4. **Legora non consulté directement** (domaine bloqué) : l'audit s'appuie sur des sources secondaires.
5. **Rien n'est publié.** Le dépôt `Dadadu99Tunisia` est public : vidéos, audio, voix, captures et
   fragments (issus du dépôt privé `abos-engine`) ne sont pas versionnés ici.

## 6. Avant diffusion

- Écouter le film en entier ; si la voix de synthèse ne convient pas, enregistrer un·e comédien·ne.
- Ajouter la mention d'attribution de la voix à la publication.
- Faire valider les mentions sur le circuit fermé (fonction non distribuée).
- Si la souscription ouvre avant la diffusion : mettre à jour n23, n24 et le carton final.
