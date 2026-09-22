# Cockpit financier

Application web personnelle de pilotage financier pour une activite freelance
aux revenus irreguliers.

Elle part d'un principe simple :

> **Le solde bancaire n'est pas de l'argent disponible.**

Tout ce qui est deja engage (obligations, mensualites de dettes, enveloppe de
vie du mois) est retire avant d'annoncer un montant depensable.

---

Tous les ecrans mensuels se parcourent mois par mois, avec le meme selecteur
au meme endroit. Un mois clos est raconte (ce qui a ete depense), un mois a
venir est annonce comme entier : aucun ecran ne projette un mois deja termine.

## La cascade

Le modele n'est pas `SALAIRE -> DEPENSES -> ce qui reste`, mais :

```
REVENU
   |
FRAIS FIXES      (URSSAF, loyer, assurances, abonnements, charges pro)
   |
RESTE
   |
VIE              (enveloppe fermee, 1 000 EUR par defaut)
   |
DETTES           (mensualites du mois)
   |
PROVISIONS       (les factures non mensuelles, lissees)
   |
RESTE REEL       -> epargne
```

Cette cascade est affichee sur le tableau de bord, et rejouee a chaque
encaissement (« Que veux-tu faire de cet argent ? »).

---

## Ce que fait l'application

| Module | Role |
|---|---|
| **Tableau de bord** | Meteo du mois, faits marquants, solde, disponible reel, reserve, dettes, epargne, position nette, enveloppe de vie et cascade |
| **Budget type** | Repartition prevue de l'enveloppe de vie par categorie, comparee au reel |
| **Revenus** | Prevu / facture / encaisse, revenus recurrents, repartition guidee a l'encaissement |
| **Depenses** | Saisie, import de releves bancaires, categories, modification, suppression, et surtout l'analyse d'impact |
| **Obligations** | Echeances ponctuelles ou recurrentes ; une obligation reglee recree automatiquement la suivante |
| **Dettes** | Encours, mensualites, priorites, progression vers zero, celebration a la ligne soldee |
| **Epargne** | Epargne de precaution en mois de charges, taux et rythme, historique mensuel, provisions et objectifs avec images |
| **Calendrier** | Fil des echeances avec le solde projete apres chaque evenement |
| **Projection** | 30 / 60 / 90 jours et 6 mois : tresorerie, dettes, epargne |
| **Sante** | Score sur 100, six facteurs objectifs, chacun explique |
| **Habitudes** | Depenses du mois, panier moyen, comparaison au mois precedent |
| **Reglages** | Budget, alertes, theme, export / import, effacement |

### « Puis-je me le permettre ? »

Une depense n'appelle jamais une reponse oui / non. L'application affiche
l'impact : disponible avant / apres, enveloppe de vie avant / apres, part du
budget mensuel, budget quotidien restant, et les echeances des 14 jours a venir.

### Regle des paiements fractionnes

Une depense marquee « paiement fractionne » cree automatiquement la dette
correspondante et previent :

> Tu transformes une depense d'aujourd'hui en obligation pour ton futur budget.

avec le montant mensuel et l'enveloppe de vie du mois prochain une fois
l'echeance honoree. L'alerte se desactive dans les reglages ; la dette, elle,
est toujours creee.

### Provisions

Une taxe fonciere de 1 100 EUR en octobre n'est pas une surprise : c'est
91 EUR par mois depuis un an. Une provision transforme une facture non
mensuelle en effort regulier. Le cockpit calcule l'effort restant
(`(montant - deja mis de cote) / mois restants`), l'ajoute a la cascade, et
signale une echeance qui approche sans etre couverte. Quand la facture
arrive, la provision est reprise et l'echeance suivante programmee.

### Epargne de precaution

Elle se mesure en **mois de charges tenables sans aucune rentree d'argent**,
pas en euros : c'est ce chiffre qui dit si un mois creux est survivable. Les
charges comptees sont reelles (obligations mensuelles + budget de vie +
mensualites de dettes + provisions). S'y ajoutent le taux d'epargne du mois,
le rythme moyen sur trois mois et le delai estime pour atteindre la cible.

### Budget type

Une repartition prevue de l'enveloppe de vie par categorie, comparee au reel
de chaque mois. Elle ne bloque rien : le seul plafond ferme reste l'enveloppe
globale. Trois repartitions de depart evitent la page blanche.

### Import de releves bancaires

Depuis **Depenses** ou **Reglages**, un export de banque au format **CSV, OFX ou
QIF** est lu directement dans le navigateur. Le module encaisse ce que les
banques francaises produisent reellement :

- encodage UTF-8 ou Windows-1252 (detecte automatiquement) ;
- separateur `;`, `,`, tabulation ou `|` ;
- lignes de preambule avant l'en-tete ;
- colonnes Debit / Credit separees ou colonne Montant signee ;
- dates en JJ/MM/AAAA, JJ/MM/AA, AAAA-MM-JJ ou AAAAMMJJ ;
- montants `1 234,56`, `1,234.56`, `(45,00)`, `12,50 EUR`.

Chaque ligne est pre-categorisee par son libelle (URSSAF et impots en
obligation, Klarna et organismes de credit en dette, enseignes du quotidien en
depense de vie, virements d'epargne en epargne), puis **relue et corrigee avant
enregistrement**. Une empreinte par mouvement fait qu'un releve reimporte
n'ajoute rien : seules les vraies nouveautes entrent.

Les entrees d'argent deviennent des revenus encaisses, les sorties des
mouvements. Seules les categories du quotidien pesent sur l'enveloppe de vie.

### Images des objectifs d'epargne

Un objectif peut porter une photo. Elle est redimensionnee (900 px maximum) et
recompressee par paliers jusqu'a tenir sous 260 Ko avant d'etre stockee, parce
que `localStorage` plafonne autour de 5 Mo pour toute l'application : une photo
de telephone brute effacerait les donnees financieres. Si une ecriture echoue
malgre tout, un bandeau le dit clairement au lieu de laisser croire que la
saisie est enregistree.

### Mode stabilisation

Si le compte est a decouvert, si une obligation est en retard, ou si les
engagements des 30 prochains jours depassent le solde, l'interface se reduit a
l'essentiel : disponible, obligations urgentes, dettes, budget de vie,
prochaine rentree, actions prioritaires. Les modules secondaires sont masques.

---

## Publication

Le build produit un bundle unique (`inlineDynamicImports`), ce qui permet de
servir l'application comme une page autonome : un `<style>` et un
`<script type="module">` inlines, sans fichier annexe.

Sur une plateforme qui interdit a la page de declencher elle-meme un
telechargement, l'export passe par `claude.use('downloads')` et retombe sur
un lien classique dans un navigateur ordinaire. Sans ce detour, le bouton
d'export serait inerte et la sauvegarde -- seul filet de securite de donnees
locales -- perdue en silence.

## Donnees

- **Tout reste dans le navigateur** (`localStorage`). Aucun serveur, aucun compte,
  aucun envoi reseau.
- Export et import JSON depuis les reglages.
- Le dossier `donnees/` et les fichiers `*.fcc.json` sont volontairement
  exclus du depot : **aucune donnee personnelle n'est versionnee ici.**

Le solde bancaire n'est pas saisi librement : il est derive d'un solde
d'ouverture et de tous les mouvements. Un ecart avec la banque se corrige par
un ajustement date, ce qui garde l'historique vrai.

---

## Developpement

```bash
npm install
npm run dev        # serveur de developpement
npm run build      # build de production dans dist/
npm run preview    # sert le build
npm test           # 142 tests : moteur de calcul et import bancaire
```

Stack : Vite + React + TypeScript, sans dependance d'interface. Les couleurs de
graphique sont validees pour la vision des couleurs et le contraste, et un
tableau equivalent accompagne toujours la courbe.

### Architecture

```
src/
  types.ts            modele de donnees
  store.tsx           etat global (reducer) + persistance
  lib/
    engine.ts         tous les calculs derives — aucune logique metier ailleurs
    engine.test.ts    cas limites : mois sans revenu, depassement, dette
                      partielle, recurrences, fractionnes, projection,
                      provisions, mois clos, meteo
    bankImport.ts     lecture des releves CSV / OFX / QIF, categorisation,
                      detection des doublons
    bankImport.test.ts formats reels des banques francaises
    image.ts          redimensionnement avant stockage
    storage.ts        chargement, normalisation, export / import, quota
    dates.ts money.ts utilitaires
  components/         primitives d'interface, graphiques, cascade, toasts,
                      selecteur de mois
  views/              un fichier par ecran
  modals/             saisie et analyse d'impact
```

Le moteur est pur : il prend un etat et une date de reference, et renvoie des
nombres. C'est ce qui permet de tester les cas limites sans interface.
