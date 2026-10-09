# SIGILLE · Rapport de rendu et de validation

Date : 9 octobre 2026. Échéance du film : 15 octobre 2026.
Statut : **film rendu et vérifié, prêt pour relecture**. Non publié, non déployé.

## 1. Inspection du produit (avant tout montage)

| Question | Constat | Preuve |
|---|---|---|
| Où est le produit ? | Dépôt privé `Dadadu99Tunisia/abos-engine` (ce dépôt-ci ne contient qu'un README de profil) | inspection des dépôts |
| Interface validée la plus récente | Interface « Sceau », recette globale du 4-5 octobre (`cabinet-intelligence-v1`) ; branche la plus récente `cc-1-closed-circuit` (`89162ca`, 9 octobre) | historique git |
| Fonctions disponibles et testées | Import, chronologie et contradictions, provenance, arguments, rédaction de 7 actes, export Word et PDF, sauvegarde, licence hors ligne : **PASS en recette** sur l'application construite (Linux) | `docs/finalisation/FINAL_PRODUCTION_READINESS.md` |
| Fonctions IA | 11 fonctions : contrôles PASS, **qualité NON PROUVÉE** ; IA non embarquée dans la version pilote distribuée | `FINAL_PRODUCTION_READINESS.md` §4, `READY_FOR_PILOTS.md` |
| Indicateur « CLOSED CIRCUIT: ACTIVE » | Existe sur `cc-1-closed-circuit` seulement (« Rien sur main ») | `CC_1_CLOSED_CIRCUIT.md` |
| Site public | sigille.fr servi par Netlify depuis `main` @ `c43412e` (déploiement du 4 octobre, état « ready ») | API Netlify |
| Paiement | **Fermé** : « CHECKOUT LIVE ALLOWED: NO », verrou `COMMERCIAL_ACCESS_IMPLEMENTED = false` en production ; `/tarifs` : « La souscription en ligne ouvre prochainement » | `PRODUCTION_CHECKOUT_STATUS.md`, `website/lib/checkout-gate.ts` |
| Appel à l'action retenu | **DÉCOUVRIR SIGILLE** + `sigille.fr` (ni « s'abonner », ni « accès anticipé ») | ci-dessus |

Lancement réel de l'application : le build de production de `cc-1-closed-circuit` a été construit et
démarré ici avec `SIGILLE_NETWORK_MODE=closed` ; le journal affiche `[sigille] CLOSED CIRCUIT: ACTIVE`.
L'application exige ensuite une licence (écran Licence au premier lancement, capturé).

## 2. Choix du parcours démontré

Une session nouvelle n'a pas pu être filmée : sans licence valide, le build de production bloque
l'import. Deux contournements (ajouter une clé de signature de recette, ou lancer le mode
développement sans contrôle de licence) ont été **refusés par la politique de sécurité de la
session** ; ils n'ont pas été tentés autrement.

Le film utilise donc les **captures réelles de la recette officielle** de l'équipe (application
construite, dossiers fictifs), datées d'octobre 2026, sur un seul dossier cohérent
(« M. DIALLO c/ Préfet de police », fictif) : import → chronologie → pièce et passage → arguments →
conclusions sourcées → retour au Pupitre. Les captures ne sont pas retouchées ; aucun curseur n'est
simulé ; le film indique en permanence « Captures réelles de l'application · recette d'octobre 2026 ·
dossier fictif ». Aucun résultat d'IA n'est présenté comme validé : la mention « Expérimental » de
l'interface est montrée telle quelle.

## 3. Affirmations du film et leurs preuves

| Affirmation | Source |
|---|---|
| Import PDF, Word, images, courriels | interface (écran Dossier vide) ; recette PASS |
| « 200 événements tirés de 25 pièces · rien n'est inventé », « 175 dates contradictoires » | capture Chronologie |
| Renvoi à la pièce, à la page et au passage | capture Pièce, panneau « Passage actif » |
| « Aucune source juridique n'est inventée » | texte de l'interface (Arguments) |
| Exports Word et PDF, « À vérifier », « Confirmer ce fait » | capture Rédaction ; recette PASS |
| Circuit fermé : seul le poste et les services internes déclarés | `CC_1_CLOSED_CIRCUIT.md` |
| 2 connexions sortantes refusées (télémétrie Next.js), le 9 octobre, environnement de test | idem, capture Réseau ; **présenté comme un essai, pas comme une preuve générale** |
| Limites : processus enfants, UDP, pare-feu en seconde barrière | idem, section « Limites » |
| Mode circuit fermé en cours de validation, non distribué | idem (« Rien sur main ») |
| Souscription en ligne : ouverture prochaine | site en ligne, `/tarifs` |

Rien d'inventé : ni client, ni témoignage, ni partenaire, ni certification, ni chiffre de
performance, ni recherche juridique (non montrée : aucun corpus fourni).

## 4. Production

- Motion design : page HTML pilotée par le temps (`render/film.js`), rendue image par image par
  Chromium (Playwright) vers FFmpeg, 4 processus en parallèle.
- Son : bande originale synthétisée (`tools/music.py`), normalisée à -16 LUFS.
- Sous-titres : `script/narration.json` → SRT et ASS (libass, police Onest), 2 lignes maximum.
- Encodage : H.264 High, yuv420p, 25 i/s, GOP 50, AAC 48 kHz, `faststart`.

## 5. Contrôles sur les fichiers rendus

| Fichier | Images | Durée | Erreurs de décodage | Niveau intégré | Crête | LRA | Taille |
|---|---|---|---|---|---|---|---|
| `SIGILLE_film_FR_master_1080p25.mp4` | 7 500 (1920 × 1080, 25 i/s) | 300,000 s | 0 | -16,3 LUFS | -6,8 dBFS | 3,7 LU | 121 Mo |
| `SIGILLE_film_FR_sans-sous-titres_1080p25.mp4` | 7 500 | 300,000 s | 0 | -16,3 LUFS | -6,8 dBFS | 3,7 LU | 119 Mo |
| `SIGILLE_film_FR_web.mp4` | 7 500 | 300,000 s | 0 | -16,3 LUFS | -6,8 dBFS | 3,7 LU | 45 Mo |

Aucune image manquante (7 500 = 300 s × 25), aucun écrêtage (crête bien sous 0 dBFS).
Sous-titres : 42 cartons, 0 chevauchement, 2 lignes maximum, ligne la plus longue 63 caractères,
dernier carton à 4:57,94. Appel à l'action final vérifié à l'image : `sigille.fr` et « DÉCOUVRIR SIGILLE ».

Contrôle visuel : 34 images extraites du premier rendu puis 8 images du rendu final du fichier web final (sous-titres compris), sur toutes les
scènes et toutes les transitions, examinées en planches contact (`tools/planche.py`). Défauts
trouvés au premier rendu et corrigés avant le rendu final :
1. coupures de sous-titres au milieu d'un groupe de mots (« l'intelligence / artificielle »,
   « encore / en préparation ») → cartons découpés explicitement (`||`) ;
2. signe « ≠ » chevauchant l'étiquette « Un même événement » → repositionné ;
3. défilement de la page d'accueil finissant sur une zone vide → raccourci ;
4. anglicisme « embeddings » dans le schéma → « Services d'IA en ligne » ;
5. titres en colonne réduits par l'ajustement automatique → interlettrage adapté ;
6. fenêtre Pupitre coupée à gauche → cadrage corrigé.

Orthographe : tous les textes dits, sous-titrés et affichés passent au correcteur Hunspell français
(seuls restent les noms propres et termes de produit : SIGILLE, Word, JetBrains, sigille.fr).
Texte anglais résiduel à l'écran : uniquement des éléments réels du produit, expliqués en français
(« CLOSED CIRCUIT: ACTIVE » = circuit fermé ; « Next.js », « UDP » dans une annotation technique).
Accents vérifiés à l'image (É, È, Ê, Ç, À, Ô, œ).

Synchronisation : les sous-titres sont calés sur le minutage de la narration (estimation 13,5
caractères par seconde, débit posé). Sans voix enregistrée, la synchronisation voix et sous-titres
ne peut pas être constatée à l'oreille : elle sera recalculée automatiquement sur les durées réelles.

Écoute : l'environnement n'a pas de sortie audio. Le son a été contrôlé par mesures (niveau intégré,
crête vraie, niveau par tranche de 10 s, absence d'écrêtage), pas à l'oreille. **Une écoute humaine
est requise avant diffusion.**

## 6. Blocages et limites, dits tels quels

1. **Voix off non générée.** Magnific (ElevenLabs) : quota gratuit du jour épuisé pour `eleven_v3`
   et `eleven_turbo_v2_5`, `eleven_v4` indisponible, modèles Gemini hors offre ; compte gratuit à
   0 crédit, 500 caractères par requête. Voix libres (Piper) : Hugging Face bloqué par la politique
   réseau. Livré à la place : script minuté, sous-titres incrustés, SRT, piste voix vide, chaîne
   d'assemblage qui intègre la voix automatiquement. Options : comédien·ne voix (recommandé pour
   une diffusion auprès de cabinets), ou offre payante de synthèse vocale autorisant l'usage commercial.
2. **Pas d'enregistrement d'écran d'une session nouvelle** (licence requise ; voir §2). Le parcours est
   fait de captures fixes réelles animées par cadrage. Pour un vrai enregistrement : lancer l'application
   avec une licence de recette valide, puis rejouer le même parcours ; les plans se remplacent un par un
   dans `render/assets/captures/`.
3. **sigille.fr non joignable d'ici** : le site a été capturé depuis le commit déployé, construit en local.
4. **Plateformes** : la recette et les captures viennent d'un environnement Linux ; la vérification sur
   un Mac réel et sur Windows reste à faire côté produit (voir `READY_FOR_PILOTS.md`).
5. **Rien n'est publié.** Le dépôt `Dadadu99Tunisia` est public : les vidéos et les fichiers audio
   (`out/*.mp4`, `out/*.wav`) ainsi que les captures de l'application (issues du dépôt privé
   `abos-engine`, dont une fonction non distribuée) ne sont pas versionnés ici. Pour reconstituer le
   projet, recopier les captures depuis les chemins du manifeste (section 1). Le master (≈ 120 Mo)
   dépasse de toute façon la limite de 100 Mo par fichier de GitHub.

## 7. Avant diffusion

- Enregistrer et intégrer la voix off (`docs/SCRIPT_VOIX_OFF.md`), puis réécouter le mixage.
- Faire valider par la fondatrice les mentions sur le circuit fermé (fonction non encore distribuée).
- Si le paiement ouvre avant la diffusion : mettre à jour v27, la scène 07 et l'appel à l'action.
