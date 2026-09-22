/**
 * Modele de donnees du cockpit.
 *
 * Principe directeur : le solde bancaire n'est JAMAIS de l'argent disponible.
 * Tout ce qui entre est un flux ; tout ce qui est engage (obligations, dettes,
 * enveloppe de vie restante) est soustrait avant d'annoncer un disponible.
 */

/** Date au format 'YYYY-MM-DD'. */
export type ISODate = string

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
  note?: string
  paidAt?: ISODate
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
 */
export type TxKind = 'vie' | 'obligation' | 'dette' | 'epargne' | 'ajustement'

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
}

export interface SavingsGoal {
  id: string
  name: string
  emoji: string
  target: number
  current: number
  /** Objectif systeme non supprimable (epargne libre). */
  system?: boolean
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
}

export interface AppState {
  version: number
  settings: Settings
  incomes: Income[]
  obligations: Obligation[]
  debts: Debt[]
  transactions: Transaction[]
  savingsGoals: SavingsGoal[]
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
