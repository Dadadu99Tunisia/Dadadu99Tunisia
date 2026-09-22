/**
 * Modele de donnees du cockpit.
 *
 * Principe directeur : le solde bancaire n'est JAMAIS de l'argent disponible.
 * Tout ce qui entre est un flux ; tout ce qui est engage (obligations, dettes,
 * enveloppe de vie restante) est soustrait avant d'annoncer un disponible.
 */

/** Date au format 'YYYY-MM-DD'. */
export type ISODate = string

/**
 * Un compte bancaire. Plusieurs comptes changent la lecture : un total
 * positif peut masquer un compte a decouvert, et chaque prelevement tombe
 * sur un compte precis.
 */
/**
 * - 'perso' : ton argent, il compte dans ton disponible
 * - 'pro'   : les encaissements y arrivent et les cotisations en partent
 * - 'joint' : partage, son solde n'est pas le tien
 */
export type AccountKind = 'perso' | 'pro' | 'joint'

export interface Account {
  id: string
  name: string
  emoji: string
  kind: AccountKind
  openingBalance: number
  openingBalanceDate: ISODate
  /** Decouvert autorise, en valeur positive. Au-dela, c'est un incident. */
  overdraftLimit: number
  /** @deprecated remplace par `kind`. Conserve pour lire les anciens exports. */
  shared?: boolean
  /** Compte propose par defaut a la saisie. */
  primary?: boolean
  note?: string
}

export type IncomeStatus = 'prevu' | 'facture' | 'encaisse'
export type IncomeType = 'mission' | 'acompte' | 'prime' | 'aide' | 'autre'

export interface Allocation {
  obligations: number
  vie: number
  dettes: number
  epargne: number
}

export interface Income {
  id: string
  date: ISODate
  client: string
  amount: number
  type: IncomeType
  status: IncomeStatus
  /** Repartition decidee a l'encaissement (guide d'action, pas un solde). */
  allocation?: Allocation
  note?: string
  /** Revenu recurrent attendu chaque mois (sert aux projections). */
  recurring?: boolean
  /** Empreinte de la ligne de releve d'ou vient ce revenu, si importe. */
  importKey?: string
  /** Compte credite. Non renseigne : le compte principal. */
  accountId?: string
}

export type ObligationCategory =
  | 'urssaf'
  | 'impots'
  | 'logement'
  | 'assurance'
  | 'abonnement'
  | 'pro'
  | 'autre'

export type Recurrence = 'none' | 'monthly' | 'quarterly' | 'yearly'

export interface Obligation {
  id: string
  name: string
  amount: number
  dueDate: ISODate
  category: ObligationCategory
  status: 'a_payer' | 'paye'
  recurrence: Recurrence
  paidAt?: ISODate
  note?: string
  /** Compte sur lequel l'echeance est prelevee. */
  accountId?: string
}

export type DebtKind = 'klarna' | 'decouvert' | 'credit' | 'proche' | 'autre'
export type DebtPriority = 'haute' | 'moyenne' | 'basse'

export interface Debt {
  id: string
  name: string
  initialAmount: number
  remainingAmount: number
  monthlyPayment: number
  /** Jour du mois du prelevement (1-28), si mensualite. */
  dueDay?: number
  priority: DebtPriority
  kind: DebtKind
  status: 'active' | 'paid'
  installmentsTotal?: number
  installmentsPaid?: number
  rate?: number
  /** Fin contractuelle annoncee par l'organisme, interets compris. */
  endDate?: ISODate
  note?: string
  paidAt?: ISODate
  /** Compte sur lequel la mensualite est prelevee. */
  accountId?: string
}

export type TxCategory =
  | 'alimentation'
  | 'restaurant'
  | 'shopping'
  | 'transport'
  | 'loisirs'
  | 'logement'
  | 'sante'
  | 'professionnel'
  | 'abonnements'
  | 'dette'
  | 'epargne'
  | 'autre'

/**
 * Un mouvement d'argent sortant (ou un ajustement de solde).
 * - 'vie'        : depense courante, imputee sur l'enveloppe de 1 000 EUR
 * - 'obligation' : reglement d'une obligation, hors enveloppe de vie
 * - 'dette'      : remboursement de dette, hors enveloppe de vie
 * - 'epargne'    : virement vers l'epargne, hors enveloppe de vie
 * - 'ajustement' : recalage du solde reel (montant signe)
 * - 'virement'   : deplacement entre deux de tes comptes, neutre au total
 */
export type TxKind = 'vie' | 'obligation' | 'dette' | 'epargne' | 'ajustement' | 'virement'

export interface Transaction {
  id: string
  date: ISODate
  description: string
  category: TxCategory
  /** Positif = sortie d'argent. Pour 'ajustement', le signe est libre. */
  amount: number
  kind: TxKind
  debtId?: string
  obligationId?: string
  savingsGoalId?: string
  /** Vrai si la depense a ete faite en paiement fractionne. */
  split?: boolean
  /** Empreinte de la ligne de releve d'ou vient ce mouvement, si importe. */
  importKey?: string
  /** Compte debite. Non renseigne : le compte principal. */
  accountId?: string
  /** Compte credite, pour un virement interne. */
  toAccountId?: string
}

/**
 * Une provision : une depense non mensuelle (taxe fonciere, assurance
 * annuelle, revision) pour laquelle on met de cote un peu chaque mois,
 * au lieu de la subir le jour ou elle tombe.
 */
export interface Provision {
  id: string
  name: string
  emoji: string
  /** Montant de la facture attendue. */
  amount: number
  dueDate: ISODate
  recurrence: Recurrence
  /** Deja mis de cote pour cette echeance. */
  saved: number
  note?: string
}

export type DeadlinePriority = 'urgente' | 'importante' | 'a_prevoir'
/** Sens de l'impact chiffre d'une echeance. */
export type ImpactPeriod = 'an' | 'mois' | 'unique'

/**
 * Une echeance administrative ou fiscale : une action a faire avant une date,
 * qui coute ou rapporte de l'argent. Ce n'est ni une depense ni une dette,
 * mais l'oublier se paie comptant.
 */
export interface Deadline {
  id: string
  title: string
  detail?: string
  dueDate: ISODate
  priority: DeadlinePriority
  /** Positif = gain attendu, negatif = cout subi. */
  impact?: number
  impactPeriod?: ImpactPeriod
  /** Ou agir : site de l'administration, de la banque. */
  link?: string
  done: boolean
  doneAt?: ISODate
}

export interface SavingsGoal {
  id: string
  name: string
  emoji: string
  target: number
  current: number
  /** Objectif systeme non supprimable (epargne libre). */
  system?: boolean
  /** Photo de l'objectif, en data URL redimensionnee. */
  image?: string
}

export interface Settings {
  livingBudget: number
  openingBalance: number
  openingBalanceDate: ISODate
  klarnaAlertEnabled: boolean
  crisisMode: 'auto' | 'on' | 'off'
  /** Revenu mensuel recurrent attendu, utilise par la projection. */
  expectedMonthlyIncome: number
  /** Coussin de tresorerie conserve avant de basculer l'excedent en epargne. */
  safetyBuffer: number
  ownerName: string
  /** Nombre de mois de charges vise par l'epargne de precaution. */
  emergencyMonths: number
  /** Repartition prevue de l'enveloppe de vie, par categorie. */
  categoryBudgets: Partial<Record<TxCategory, number>>
}

export interface AppState {
  version: number
  settings: Settings
  accounts: Account[]
  incomes: Income[]
  obligations: Obligation[]
  debts: Debt[]
  transactions: Transaction[]
  savingsGoals: SavingsGoal[]
  provisions: Provision[]
  deadlines: Deadline[]
}

export const TX_CATEGORY_LABELS: Record<TxCategory, string> = {
  alimentation: 'Alimentation',
  restaurant: 'Restaurant',
  shopping: 'Shopping',
  transport: 'Transport',
  loisirs: 'Loisirs',
  logement: 'Logement',
  sante: 'Sante',
  professionnel: 'Professionnel',
  abonnements: 'Abonnements',
  dette: 'Dette',
  epargne: 'Epargne',
  autre: 'Autre',
}

/** Icone par categorie : une liste se lit plus vite avec un repere visuel. */
export const TX_CATEGORY_EMOJI: Record<TxCategory, string> = {
  alimentation: '\u{1F34E}',
  restaurant: '\u{1F37D}\uFE0F',
  shopping: '\u{1F6CD}\uFE0F',
  transport: '\u{1F687}',
  loisirs: '\u{1F3AC}',
  logement: '\u{1F3E0}',
  sante: '\u{1FA7A}',
  professionnel: '\u{1F4BC}',
  abonnements: '\u{1F501}',
  dette: '\u{1F4C9}',
  epargne: '\u{1F6DF}',
  autre: '\u{1F4CC}',
}

export const OBLIGATION_CATEGORY_LABELS: Record<ObligationCategory, string> = {
  urssaf: 'URSSAF',
  impots: 'Impots',
  logement: 'Logement',
  assurance: 'Assurance',
  abonnement: 'Abonnement',
  pro: 'Frais pro',
  autre: 'Autre',
}

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  klarna: 'Paiement fractionne',
  decouvert: 'Decouvert',
  credit: 'Credit',
  proche: 'Pret d’un proche',
  autre: 'Autre',
}

/** Categories qui, par defaut, pesent sur l'enveloppe de vie. */
export const LIVING_CATEGORIES: TxCategory[] = [
  'alimentation',
  'restaurant',
  'shopping',
  'transport',
  'loisirs',
  'sante',
  'autre',
]
