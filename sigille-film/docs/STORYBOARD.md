# SIGILLE · Storyboard du film v2

Durée : 2 min 23 s. 1920 × 1080, 25 images par seconde. Aucun visage, aucun avatar.
Signature : **« Chaque fait, sa pièce. »** Le minutage exact de chaque plan découle de la voix
(`build/timeline.json`). La v1 (5 min) reste dans l'historique git.

## Direction artistique

- **Deux matières.** Le papier (`#f4f6f9`, fond du site) pour le travail dans le produit ; l'encre
  (`#0b1424`) pour la marque, la confidentialité, la signature. L'alternance rythme le film.
- **Le fil de preuve.** Un trait cobalt relie un fait à sa pièce (orange quand deux pièces se
  contredisent). Il devient le cercle du symbole aux moments de marque, et la limite du poste dans la
  scène de confidentialité. C'est la traçabilité, rendue visible, propre à SIGILLE.
- **L'interface en gestes.** Fragments réels découpés dans les captures de recette, agrandis, un geste
  par plan, entrée en cascade, repères bleus (orange pour les contradictions). Mention permanente :
  « Interface réelle · dossier fictif de recette ».
- **Typographie.** Newsreader (énoncés, italique cobalt sur l'idée forte), Onest (chapitres, interface),
  JetBrains Mono (numéros de chapitre, mentions).

## Plans

| Scène | Durée | Image | Voix |
|---|---|---|---|
| c00 Ouverture | 12,5 s | Deux fragments réels : la même scolarité datée du 05/01/2015 (chronologie, pièce 6) et du 9 septembre 2015 (pièce 24). Les deux dates s'encadrent d'orange, un fil les relie, « ≠ ». Puis « Une date fausse *ne se voit pas.* » | « Le même fait. Deux pièces. Deux dates. Laquelle est la bonne ? … » |
| c01 Titre | 7,4 s | Encre. Le symbole se trace (cercle, puis lames), se remplit ; SIGILLE ; « Chaque fait, *sa pièce.* » | « Sigille. Le poste de travail juridique où chaque fait garde sa source. » |
| c02 Importer | 13,7 s | « Ce que Sigille prépare dès l'import », zone d'import, trois cartes ; repères sur « traitement local » et « sans rien envoyer à l'extérieur » | « Vous déposez les pièces … sans les envoyer ailleurs. » |
| c03 Comprendre | 10,6 s | Chronologie : titre « 200 événements tirés de 25 pièces · … rien n'est inventé », lignes révélées de haut en bas, repères sur les pièces sources | « Il reconstitue la chronologie … Rien n'est inventé. » |
| c04 Vérifier | 9,9 s | Même plan (continuité) : « 175 dates contradictoires à vérifier », colonne « Date contradictoire » en orange, liens « Autre date dans … pièces » | « Quand les pièces se contredisent, Sigille ne choisit pas à votre place. Il vous le signale, pièce par pièce. » |
| c05 Source | 8,0 s | La pièce 24 ouverte, passage exact encadré ; panneau « Passage actif » ; le fil relie le panneau au passage | « Un clic, et vous êtes dans la pièce : la page, le passage exact. » |
| c06 Argumenter | 9,5 s | Tableau de couverture des arguments ; colonne « Fragilité » ; repère sur « Aucune source juridique n'est inventée. » (texte de l'interface) | « Les arguments partent du dossier, avec leurs points faibles. Aucune source juridique n'est inventée. » |
| c07 Rédiger | 16,8 s | Conclusions ; le badge « Pièce n°24 · p. 1 » est relié par le fil au passage de la pièce 24 ; panneau « Expérimental · à relire avant de remplacer », « À vérifier / Confirmer ce fait » ; barre d'export Word et PDF | « Dans vos conclusions, chaque fait renvoie à sa pièce. Les propositions de l'IA restent à relire. La décision vous appartient. Puis vous exportez, en Word ou en PDF. » |
| c07b Montage | 7,0 s | Six écrans réels en coupes rapides sur la musique, puis « Un seul espace *de travail.* » | (musique seule) |
| c08 Confidentialité | 20,7 s | Encre. Le cercle du sceau devient la limite du poste ; quatre sorties s'arrêtent à la limite (✕). Indicateur réel « CLOSED CIRCUIT: ACTIVE », page Réseau, ligne des 2 refus ; mention : mode en validation, non distribué, essai du 9 octobre 2026 en environnement de test, limites connues | « Vos dossiers restent sur votre poste. Un mode circuit fermé, en cours de validation, … limites comprises. » |
| c09 Signature | 11,4 s | Symbole ; PRÉCISION · TRAÇABILITÉ · CONFIDENTIALITÉ · SOURCES AFFICHÉES, un mot par temps ; « L'humain *décide.* » | « Précision. Traçabilité. Confidentialité. Des sources toujours affichées. Et une règle qui ne change pas : l'humain décide. » |
| c10 Appel à l'action | 16,0 s | Le vrai site sigille.fr ; zoom sur le vrai bouton « Être prévenu de l'ouverture » ; carton final : symbole, SIGILLE, « Chaque fait, *sa pièce.* », sigille.fr, ÊTRE PRÉVENU DE L'OUVERTURE | « La souscription ouvre prochainement. Laissez votre adresse sur sigille.fr pour être prévenu de l'ouverture. Sigille. Chaque fait, sa pièce. » |

## Son

Bande originale synthétisée (`tools/music.py`) : horloge feutrée et accord dissonant au « ≠ » ;
cloches et impact grave au sceau ; pulsation à 96 battements par minute et arpèges qui montent pendant le
travail ; montage à pleine énergie ; confidentialité dépouillée, quatre impulsions qui s'arrêtent net ;
un accord par mot de la signature ; accord final. La musique s'efface sous la voix (sidechain).

## Appel à l'action

« Être prévenu de l'ouverture » : c'est le parcours principal réel du site (formulaire `/essai`), la
souscription en ligne n'étant pas ouverte (verrou de paiement actif en production).
