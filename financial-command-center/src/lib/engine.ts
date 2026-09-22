import type {
  Account,
  AppState,
  Deadline,
  DeadlinePriority,
  Debt,
  Income,
  ISODate,
  Obligation,
  Provision,
  Transaction,
  TxCategory,
} from '../types'
import { TX_CATEGORY_LABELS } from '../types'
import { round2, ratio, clamp, euro } from './money'
import {
  addDays,
  addMonths,
  daysInMonth,
  daysLeftInMonth,
  dayOfMonth,
  diffDays,
  endOfMonth,
  fromISO,
  monthKey,
  previousMonthKey,
  longDate,
  relativeDue,
  startOfMonth,
  today as todayISO,
} from './dates'

/* ------------------------------------------------------------------ */
/* Solde bancaire : derive du ledger, jamais saisi a la main           */
/* ------------------------------------------------------------------ */

/** Sortie de tresorerie d'une transaction (un ajustement est signe). */
export function txCashEffect(tx: Transaction): number {
  return tx.kind === 'ajustement' ? tx.amount : -Math.abs(tx.amount)
}

/** Le compte propose par defaut, et celui qui recoit les mouvements orphelins. */
export function primaryAccount(s: AppState): Account | undefined {
  return s.accounts.find((a) => a.primary) ?? s.accounts[0]
}

/** Le compte d'un mouvement : celui qui est renseigne, sinon le principal. */
function accountOf(s: AppState, accountId?: string): Account | undefined {
  if (accountId) {
    const found = s.accounts.find((a) => a.id === accountId)
    if (found) return found
  }
  return primaryAccount(s)
}

export function accountBalance(s: AppState, accountId: string, ref: ISODate = todayISO()): number {
  const account = s.accounts.find((a) => a.id === accountId)
  if (!account) return 0
  const inWindow = (d: ISODate) => d >= account.openingBalanceDate && d <= ref

  let total = account.openingBalance
  for (const i of s.incomes) {
    if (i.status !== 'encaisse') continue
    if (accountOf(s, i.accountId)?.id !== accountId) continue
    if (inWindow(i.date)) total += i.amount
  }
  for (const t of s.transactions) {
    if (!inWindow(t.date)) continue
    const from = accountOf(s, t.accountId)?.id
    // Un virement sort d'un compte et entre dans l'autre : il touche deux
    // soldes, et ne coute rien au total tant qu'il reste entre tes comptes.
    if (t.kind === 'virement') {
      if (from === accountId) total -= Math.abs(t.amount)
      if (t.toAccountId === accountId) total += Math.abs(t.amount)
      continue
    }
    if (from !== accountId) continue
    total += txCashEffect(t)
  }
  return round2(total)
}

/**
 * Ce qui, sur un compte, est deja promis a quelqu'un d'autre.
 * Un compte pro affiche un solde confortable dont une bonne part est de
 * l'URSSAF a venir : ce chiffre-la evite de s'y tromper.
 */
export function reservedOnAccount(s: AppState, accountId: string, ref: ISODate = todayISO()): number {
  const obligations = obligationsDueWithin(s, 30, ref)
    .filter((o) => accountOf(s, o.accountId)?.id === accountId)
    .reduce((a, o) => a + o.amount, 0)
  const debts = activeDebts(s)
    .filter((d) => accountOf(s, d.accountId)?.id === accountId)
    .reduce((a, d) => a + Math.min(d.remainingAmount, d.monthlyPayment), 0)
  return round2(obligations + debts)
}

export interface AccountBalance {
  account: Account
  balance: number
  /** Sous le decouvert autorise : la banque facture des incidents. */
  breached: boolean
  negative: boolean
  /** Deja engage sur ce compte dans les 30 prochains jours. */
  reserved: number
  /** Solde moins ce qui est deja engage. */
  free: number
}

export function accountBalances(s: AppState, ref: ISODate = todayISO()): AccountBalance[] {
  return s.accounts.map((account) => {
    const balance = accountBalance(s, account.id, ref)
    const reserved = reservedOnAccount(s, account.id, ref)
    return {
      account,
      balance,
      negative: balance < 0,
      breached: balance < -account.overdraftLimit,
      reserved,
      free: round2(balance - reserved),
    }
  })
}

/**
 * Le solde bancaire personnel : la somme des comptes qui sont a toi.
 * Un compte joint en est exclu — son solde n'est pas ton argent disponible.
 */
export function bankBalance(s: AppState, ref: ISODate = todayISO()): number {
  if (s.accounts.length === 0) return 0
  return round2(
    accountBalances(s, ref)
      .filter((a) => a.account.kind !== 'joint')
      .reduce((total, a) => total + a.balance, 0),
  )
}

/** Les comptes dans le rouge, meme si le total, lui, est positif. */
export function accountsInTrouble(s: AppState, ref: ISODate = todayISO()): AccountBalance[] {
  return accountBalances(s, ref).filter((a) => a.negative)
}

export function savingsTotal(s: AppState): number {
  return round2(s.savingsGoals.reduce((a, g) => a + g.current, 0))
}

/* ------------------------------------------------------------------ */
/* Enveloppe de vie                                                     */
/* ------------------------------------------------------------------ */

export interface LivingSnapshot {
  budget: number
  spent: number
  remaining: number
  /** Part du budget consommee, bornee a 1 pour la barre. */
  progress: number
  overspent: number
  daysLeft: number
  perDay: number
  perWeek: number
  /** Ce qui "aurait du" etre depense a ce stade du mois. */
  paceTarget: number
  /** > 0 = en avance sur le budget, < 0 = en retard (trop depense). */
  paceDelta: number
  count: number
}

export function livingSnapshot(s: AppState, ref: ISODate = todayISO()): LivingSnapshot {
  const key = monthKey(ref)
  const budget = s.settings.livingBudget
  const month = s.transactions.filter((t) => t.kind === 'vie' && monthKey(t.date) === key)
  const spent = round2(month.reduce((a, t) => a + Math.abs(t.amount), 0))
  const remaining = round2(budget - spent)
  const daysLeft = daysLeftInMonth(ref)
  const d = fromISO(ref)
  const total = daysInMonth(d.getFullYear(), d.getMonth())
  const paceTarget = round2((budget * dayOfMonth(ref)) / total)
  const perDay = remaining > 0 ? round2(remaining / daysLeft) : 0
  return {
    budget,
    spent,
    remaining,
    progress: ratio(spent, budget),
    overspent: remaining < 0 ? round2(-remaining) : 0,
    daysLeft,
    perDay,
    perWeek: remaining > 0 ? round2(Math.min(remaining, perDay * 7)) : 0,
    paceTarget,
    paceDelta: round2(paceTarget - spent),
    count: month.length,
  }
}

/* ------------------------------------------------------------------ */
/* Obligations et dettes                                                */
/* ------------------------------------------------------------------ */

export function unpaidObligations(s: AppState): Obligation[] {
  return s.obligations
    .filter((o) => o.status === 'a_payer')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function overdueObligations(s: AppState, ref: ISODate = todayISO()): Obligation[] {
  return unpaidObligations(s).filter((o) => o.dueDate < ref)
}

export function obligationsTotal(s: AppState): number {
  return round2(unpaidObligations(s).reduce((a, o) => a + o.amount, 0))
}

export function obligationsDueWithin(s: AppState, days: number, ref: ISODate = todayISO()): Obligation[] {
  const limit = addDays(ref, days)
  return unpaidObligations(s).filter((o) => o.dueDate <= limit)
}

export function activeDebts(s: AppState): Debt[] {
  const rank = { haute: 0, moyenne: 1, basse: 2 }
  return s.debts
    .filter((d) => d.status === 'active')
    .sort((a, b) => rank[a.priority] - rank[b.priority] || b.remainingAmount - a.remainingAmount)
}

export function debtTotal(s: AppState): number {
  return round2(activeDebts(s).reduce((a, d) => a + d.remainingAmount, 0))
}

export function debtInitialTotal(s: AppState): number {
  return round2(s.debts.reduce((a, d) => a + Math.max(d.initialAmount, d.remainingAmount), 0))
}

/** Mensualites de dettes tombant dans les `days` prochains jours. */
export function debtPaymentsWithin(s: AppState, days: number): number {
  if (days <= 0) return 0
  const months = Math.max(1, Math.round(days / 30))
  return round2(
    activeDebts(s).reduce(
      (a, d) => a + Math.min(d.remainingAmount, (d.monthlyPayment || 0) * months),
      0,
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Argent reellement disponible                                         */
/* ------------------------------------------------------------------ */

export interface AvailabilitySnapshot {
  bank: number
  /** Obligations non reglees a echeance <= 30 jours. */
  obligationsSoon: number
  /** Toutes obligations non reglees, quelle que soit l'echeance. */
  obligationsAll: number
  /** Mensualites de dettes des 30 prochains jours. */
  debtsSoon: number
  /** Encours total des dettes. */
  debtsAll: number
  /** Enveloppe de vie restante, deja engagee. */
  livingCommitted: number
  /** bank - obligationsSoon - debtsSoon (ce que la banque doit couvrir). */
  reserved: number
  /** Le chiffre qui compte : ce qui reste apres tout ce qui est engage. */
  available: number
  savings: number
  /** bank + epargne - obligations - dettes : la verite patrimoniale. */
  netPosition: number
}

export function availability(s: AppState, ref: ISODate = todayISO()): AvailabilitySnapshot {
  const bank = bankBalance(s, ref)
  const obligationsSoon = round2(
    obligationsDueWithin(s, 30, ref).reduce((a, o) => a + o.amount, 0),
  )
  const obligationsAll = obligationsTotal(s)
  const debtsSoon = debtPaymentsWithin(s, 30)
  const debtsAll = debtTotal(s)
  const living = livingSnapshot(s, ref)
  const livingCommitted = Math.max(0, living.remaining)
  const reserved = round2(obligationsSoon + debtsSoon)
  const savings = savingsTotal(s)
  return {
    bank,
    obligationsSoon,
    obligationsAll,
    debtsSoon,
    debtsAll,
    livingCommitted,
    reserved,
    available: round2(bank - reserved - livingCommitted),
    savings,
    netPosition: round2(bank + savings - obligationsAll - debtsAll),
  }
}

/* ------------------------------------------------------------------ */
/* Repartition d'un encaissement                                        */
/* ------------------------------------------------------------------ */

export interface AllocationSuggestion {
  obligations: number
  vie: number
  dettes: number
  epargne: number
  reasons: string[]
}

/**
 * Cascade ENCAISSEMENT -> RESERVES -> VIE -> DETTES -> EPARGNE.
 * On ne repartit jamais plus que le montant encaisse.
 */
export function suggestAllocation(
  s: AppState,
  amount: number,
  ref: ISODate = todayISO(),
): AllocationSuggestion {
  const reasons: string[] = []
  let left = round2(Math.max(0, amount))

  const obligationsNeed = round2(
    obligationsDueWithin(s, 60, ref).reduce((a, o) => a + o.amount, 0),
  )
  const obligations = round2(Math.min(left, obligationsNeed))
  left = round2(left - obligations)
  if (obligations > 0) {
    reasons.push(
      `${obligationsDueWithin(s, 60, ref).length} obligation(s) a echeance sous 60 jours a couvrir.`,
    )
  }

  const living = livingSnapshot(s, ref)
  const vie = round2(Math.min(left, Math.max(0, living.remaining)))
  left = round2(left - vie)
  if (vie > 0) reasons.push(`Enveloppe de vie du mois a financer jusqu'au bout.`)

  const debtsNeed = round2(
    activeDebts(s).reduce((a, d) => a + Math.min(d.remainingAmount, d.monthlyPayment || d.remainingAmount), 0),
  )
  const dettes = round2(Math.min(left, debtsNeed))
  left = round2(left - dettes)
  if (dettes > 0) reasons.push(`Mensualites de dettes du mois.`)

  const epargne = round2(Math.max(0, left))
  if (epargne > 0) reasons.push(`Le reste est reellement disponible : il part a l'epargne.`)
  else if (amount > 0) reasons.push(`Rien ne reste pour l'epargne ce mois-ci : tout est deja engage.`)

  return { obligations, vie, dettes, epargne, reasons }
}

/* ------------------------------------------------------------------ */
/* "Puis-je me le permettre ?"                                          */
/* ------------------------------------------------------------------ */

export type ImpactLevel = 'confort' | 'notable' | 'tendu' | 'depassement'

export interface ImpactAnalysis {
  amount: number
  livingBefore: number
  livingAfter: number
  availableBefore: number
  availableAfter: number
  shareOfBudget: number
  perDayBefore: number
  perDayAfter: number
  daysLeft: number
  /** Nombre de jours d'enveloppe de vie que la depense consomme. */
  daysOfBudget: number
  upcomingObligations: Obligation[]
  upcomingTotal: number
  level: ImpactLevel
  headline: string
  facts: string[]
}

export function analyseExpense(
  s: AppState,
  amount: number,
  opts: { countsAsLiving?: boolean; ref?: ISODate } = {},
): ImpactAnalysis {
  const ref = opts.ref ?? todayISO()
  const countsAsLiving = opts.countsAsLiving !== false
  const amt = round2(Math.max(0, amount))
  const living = livingSnapshot(s, ref)
  const avail = availability(s, ref)

  const livingAfter = countsAsLiving ? round2(living.remaining - amt) : living.remaining
  const availableAfter = round2(avail.available - amt)
  const daysLeft = living.daysLeft
  const perDayAfter = livingAfter > 0 ? round2(livingAfter / daysLeft) : 0
  const upcoming = obligationsDueWithin(s, 14, ref)
  const upcomingTotal = round2(upcoming.reduce((a, o) => a + o.amount, 0))
  const share = s.settings.livingBudget > 0 ? amt / s.settings.livingBudget : 0
  const dailyBudget = s.settings.livingBudget / Math.max(1, daysInMonth(fromISO(ref).getFullYear(), fromISO(ref).getMonth()))

  let level: ImpactLevel
  if (countsAsLiving && livingAfter < 0) level = 'depassement'
  else if (availableAfter < 0) level = 'tendu'
  else if (share >= 0.2 || (countsAsLiving && livingAfter < dailyBudget * daysLeft * 0.4)) level = 'notable'
  else level = 'confort'

  const headline =
    level === 'depassement'
      ? "Cette depense fait sortir ton enveloppe de vie du cadre."
      : level === 'tendu'
        ? "Ton enveloppe tient, mais ton disponible reel passe en negatif."
        : level === 'notable'
          ? "C'est une depense significative pour ce mois."
          : "Cette depense rentre sans tension dans ton mois."

  const facts: string[] = []
  if (s.settings.livingBudget > 0) {
    facts.push(
      `Elle represente ${Math.round(share * 100)} % de ton budget de vie mensuel.`,
    )
  }
  if (countsAsLiving) {
    facts.push(
      livingAfter >= 0
        ? `Il te resterait ${euro(perDayAfter)} par jour sur ${daysLeft} jour(s).`
        : `Tu depasserais l'enveloppe de ${euro(Math.abs(livingAfter))}.`,
    )
    facts.push(`Elle consomme l'equivalent de ${(amt / Math.max(dailyBudget, 0.01)).toFixed(1).replace('.', ',')} jour(s) de budget.`)
  }
  if (upcoming.length > 0) {
    facts.push(
      `${upcoming.length} obligation(s) pour ${euro(upcomingTotal)} tombent dans les 14 prochains jours.`,
    )
  }

  return {
    amount: amt,
    livingBefore: living.remaining,
    livingAfter,
    availableBefore: avail.available,
    availableAfter,
    shareOfBudget: share,
    perDayBefore: living.perDay,
    perDayAfter,
    daysLeft,
    daysOfBudget: round2(amt / Math.max(dailyBudget, 0.01)),
    upcomingObligations: upcoming,
    upcomingTotal,
    level,
    headline,
    facts,
  }
}

/* ------------------------------------------------------------------ */
/* Paiement fractionne (regle Klarna)                                   */
/* ------------------------------------------------------------------ */

export interface SplitImpact {
  total: number
  installments: number
  monthly: number
  /** Enveloppe de vie du mois prochain une fois l'echeance honoree. */
  nextMonthLivingLeft: number
  shareOfNextMonth: number
  lastDueDate: ISODate
}

export function splitPaymentImpact(
  s: AppState,
  total: number,
  installments: number,
  ref: ISODate = todayISO(),
): SplitImpact {
  const n = Math.max(1, Math.round(installments))
  const monthly = round2(total / n)
  const existingNextMonth = round2(
    activeDebts(s)
      .filter((d) => d.kind === 'klarna')
      .reduce((a, d) => a + Math.min(d.remainingAmount, d.monthlyPayment || 0), 0),
  )
  const nextMonthLivingLeft = round2(s.settings.livingBudget - monthly - existingNextMonth)
  return {
    total: round2(total),
    installments: n,
    monthly,
    nextMonthLivingLeft,
    shareOfNextMonth: s.settings.livingBudget > 0 ? monthly / s.settings.livingBudget : 0,
    lastDueDate: addMonths(ref, n - 1),
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard comportemental                                             */
/* ------------------------------------------------------------------ */

export interface BehaviourStats {
  monthKey: string
  spent: number
  count: number
  average: number
  shopping: number
  restaurant: number
  split: number
  byCategory: { category: string; amount: number }[]
}

export function behaviour(s: AppState, key: string): BehaviourStats {
  const rows = s.transactions.filter((t) => t.kind === 'vie' && monthKey(t.date) === key)
  const spent = round2(rows.reduce((a, t) => a + Math.abs(t.amount), 0))
  const sum = (pred: (t: Transaction) => boolean) =>
    round2(rows.filter(pred).reduce((a, t) => a + Math.abs(t.amount), 0))
  const byCat = new Map<string, number>()
  for (const t of rows) byCat.set(t.category, round2((byCat.get(t.category) || 0) + Math.abs(t.amount)))
  return {
    monthKey: key,
    spent,
    count: rows.length,
    average: rows.length ? round2(spent / rows.length) : 0,
    shopping: sum((t) => t.category === 'shopping'),
    restaurant: sum((t) => t.category === 'restaurant'),
    split: sum((t) => !!t.split),
    byCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  }
}

export function behaviourComparison(s: AppState, ref: ISODate = todayISO()) {
  const current = behaviour(s, monthKey(ref))
  const previous = behaviour(s, previousMonthKey(monthKey(ref)))
  const delta = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 1) : (a - b) / b)
  return {
    current,
    previous,
    deltaSpent: delta(current.spent, previous.spent),
    deltaCount: delta(current.count, previous.count),
    deltaAverage: delta(current.average, previous.average),
  }
}

/* ------------------------------------------------------------------ */
/* Score de sante financiere                                            */
/* ------------------------------------------------------------------ */

export type HealthBand = 'critique' | 'a_stabiliser' | 'en_progression' | 'solide'

export interface HealthFactor {
  key: string
  label: string
  score: number
  max: number
  detail: string
  ok: boolean
}

export interface HealthReport {
  score: number
  band: HealthBand
  label: string
  factors: HealthFactor[]
}

const BAND_LABELS: Record<HealthBand, string> = {
  critique: 'Sous tension',
  a_stabiliser: 'A stabiliser',
  en_progression: 'En progression',
  solide: 'Stable',
}

export function healthReport(s: AppState, ref: ISODate = todayISO()): HealthReport {
  const a = availability(s, ref)
  const living = livingSnapshot(s, ref)
  const overdue = overdueObligations(s, ref)
  const monthlyIncome = expectedMonthlyIncome(s)
  const factors: HealthFactor[] = []

  // 1. Tresorerie
  const cashScore = a.bank >= monthlyIncome * 0.5 ? 20 : a.bank >= 0 ? 12 : 0
  factors.push({
    key: 'cash',
    label: 'Tresorerie',
    score: cashScore,
    max: 20,
    ok: a.bank >= 0,
    detail:
      a.bank < 0
        ? `Ton compte est a decouvert de ${fmtPlain(-a.bank)}.`
        : cashScore === 20
          ? `Ton compte couvre plus d'un demi-mois de revenu.`
          : `Ton compte est positif mais le matelas est mince.`,
  })

  // 2. Disponible reel
  const availScore = a.available >= 0 ? 20 : a.available >= -monthlyIncome * 0.2 ? 8 : 0
  factors.push({
    key: 'available',
    label: 'Argent reellement disponible',
    score: availScore,
    max: 20,
    ok: a.available >= 0,
    detail:
      a.available >= 0
        ? `Une fois tout ce qui est engage retire, il te reste ${fmtPlain(a.available)}.`
        : `Tes engagements des 30 prochains jours depassent ton solde de ${fmtPlain(-a.available)}.`,
  })

  // 3. Obligations a jour
  const overdueTotal = round2(overdue.reduce((x, o) => x + o.amount, 0))
  const oblScore = overdue.length === 0 ? 20 : overdueTotal <= monthlyIncome * 0.1 ? 8 : 0
  factors.push({
    key: 'obligations',
    label: 'Obligations a jour',
    score: oblScore,
    max: 20,
    ok: overdue.length === 0,
    detail:
      overdue.length === 0
        ? `Aucune obligation en retard.`
        : `${overdue.length} obligation(s) en retard pour ${fmtPlain(overdueTotal)}.`,
  })

  // 4. Budget de vie tenu
  const paceOk = living.spent <= living.paceTarget
  const budgetScore = living.remaining < 0 ? 0 : paceOk ? 15 : 8
  factors.push({
    key: 'budget',
    label: 'Budget de vie tenu',
    score: budgetScore,
    max: 15,
    ok: living.remaining >= 0,
    detail:
      living.remaining < 0
        ? `Enveloppe depassee de ${fmtPlain(living.overspent)} ce mois-ci.`
        : paceOk
          ? `Tu es dans le rythme : ${fmtPlain(living.spent)} depenses sur ${fmtPlain(living.paceTarget)} "attendus" a ce stade du mois.`
          : `Tu depenses plus vite que le rythme du mois (${fmtPlain(living.spent)} contre ${fmtPlain(living.paceTarget)}).`,
  })

  // 5. Epargne
  const monthsCovered = s.settings.livingBudget > 0 ? a.savings / s.settings.livingBudget : 0
  const savingsScore = Math.round(clamp(monthsCovered / 3, 0, 1) * 15)
  factors.push({
    key: 'savings',
    label: 'Epargne de securite',
    score: savingsScore,
    max: 15,
    ok: monthsCovered >= 1,
    detail:
      a.savings <= 0
        ? `Pas encore d'epargne de securite.`
        : `Ton epargne couvre ${monthsCovered.toFixed(1).replace('.', ',')} mois de budget de vie (cible : 3).`,
  })

  // 6. Poids des dettes
  const load = monthlyIncome > 0 ? debtPaymentsWithin(s, 30) / monthlyIncome : a.debtsAll > 0 ? 1 : 0
  const debtScore = a.debtsAll === 0 ? 10 : Math.round(clamp(1 - load / 0.4, 0, 1) * 10)
  factors.push({
    key: 'debt',
    label: 'Poids des dettes',
    score: debtScore,
    max: 10,
    ok: load <= 0.33,
    detail:
      a.debtsAll === 0
        ? `Aucune dette en cours.`
        : `Tes mensualites de dettes representent ${Math.round(load * 100)} % de ton revenu mensuel attendu.`,
  })

  const score = factors.reduce((x, f) => x + f.score, 0)
  const band: HealthBand =
    score < 35 ? 'critique' : score < 55 ? 'a_stabiliser' : score < 75 ? 'en_progression' : 'solide'
  return { score, band, label: BAND_LABELS[band], factors }
}

/** Les textes du cockpit sont lus tels quels : ils portent le symbole, pas 'EUR'. */
function fmtPlain(n: number): string {
  return euro(n)
}

/* ------------------------------------------------------------------ */
/* Mode stabilisation                                                   */
/* ------------------------------------------------------------------ */

export interface CrisisState {
  active: boolean
  auto: boolean
  reasons: string[]
}

export function crisisState(s: AppState, ref: ISODate = todayISO()): CrisisState {
  const a = availability(s, ref)
  const overdue = overdueObligations(s, ref)
  const reasons: string[] = []
  if (a.bank < 0) reasons.push(`Solde bancaire total a decouvert (${fmtPlain(a.bank)}).`)
  // Un total positif peut masquer un compte dans le rouge : on le dit.
  for (const t of accountsInTrouble(s, ref)) {
    if (a.bank < 0 && s.accounts.length === 1) break
    reasons.push(
      `${t.account.name} est a ${fmtPlain(t.balance)}${t.breached ? ', au-dela du decouvert autorise' : ''}.`,
    )
  }
  if (overdue.length > 0) reasons.push(`${overdue.length} obligation(s) impayee(s) en retard.`)
  if (a.available < 0) reasons.push(`Engagements des 30 prochains jours superieurs a ton solde.`)
  const auto = reasons.length > 0
  const active = s.settings.crisisMode === 'on' ? true : s.settings.crisisMode === 'off' ? false : auto
  return { active, auto, reasons }
}

/** Actions prioritaires, triees par urgence, pour le mode stabilisation. */
export function priorityActions(s: AppState, ref: ISODate = todayISO()): string[] {
  const out: string[] = []
  const a = availability(s, ref)
  const overdue = overdueObligations(s, ref)
  if (overdue.length > 0) {
    const first = overdue[0]
    out.push(`Regler ou echelonner "${first.name}" (${fmtPlain(first.amount)}), en retard.`)
  }
  if (a.bank < 0) out.push(`Ramener le compte a zero : il manque ${fmtPlain(-a.bank)}.`)
  const nextIncome = upcomingIncomes(s, ref)[0]
  if (nextIncome) {
    out.push(
      `Prochaine rentree : ${fmtPlain(nextIncome.amount)} de ${nextIncome.client || 'client'} le ${longDate(nextIncome.date)}.`,
    )
  } else {
    out.push(`Aucune rentree d'argent planifiee : ajoute tes revenus prevus pour y voir clair.`)
  }
  const living = livingSnapshot(s, ref)
  if (living.remaining > 0) {
    out.push(`Tenir ${fmtPlain(living.perDay)} par jour sur les ${living.daysLeft} jours restants.`)
  } else {
    out.push(`Enveloppe de vie epuisee : chaque euro depense creuse le mois prochain.`)
  }
  const top = activeDebts(s)[0]
  if (top) out.push(`Dette prioritaire : ${top.name}, reste ${fmtPlain(top.remainingAmount)}.`)
  return out
}

export function upcomingIncomes(s: AppState, ref: ISODate = todayISO()): Income[] {
  return s.incomes
    .filter((i) => i.status !== 'encaisse' && i.date >= ref)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Revenu mensuel attendu : parametre explicite, sinon moyenne encaissee 3 mois. */
export function expectedMonthlyIncome(s: AppState, ref: ISODate = todayISO()): number {
  if (s.settings.expectedMonthlyIncome > 0) return s.settings.expectedMonthlyIncome
  const from = addMonths(startOfMonth(ref), -3)
  const cashed = s.incomes.filter((i) => i.status === 'encaisse' && i.date >= from && i.date <= ref)
  if (cashed.length === 0) return 0
  return round2(cashed.reduce((a, i) => a + i.amount, 0) / 3)
}

/* ------------------------------------------------------------------ */
/* Calendrier et projection                                             */
/* ------------------------------------------------------------------ */

export type EventKind = 'income' | 'obligation' | 'debt' | 'living'

export interface TimelineEvent {
  date: ISODate
  kind: EventKind
  label: string
  /** Positif = entree, negatif = sortie. */
  amount: number
  /** Solde projete apres cet evenement. */
  balanceAfter: number
  certain: boolean
  id?: string
}

/** Occurrences d'une obligation recurrente entre from et to (inclus). */
export function obligationOccurrences(o: Obligation, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  const step =
    o.recurrence === 'monthly' ? 1 : o.recurrence === 'quarterly' ? 3 : o.recurrence === 'yearly' ? 12 : 0
  // L'echeance de base compte tant qu'elle n'est pas reglee, meme si elle est
  // deja en retard : un impaye ne disparait pas parce que la date est passee.
  if (o.status === 'a_payer' && o.dueDate <= to) out.push(o.dueDate)
  if (step === 0) return out.filter((d) => d <= to)
  let cursor = o.dueDate
  // avance jusqu'a la fenetre puis enumere (garde-fou a 400 iterations)
  for (let i = 0; i < 400; i++) {
    cursor = addMonths(cursor, step)
    if (cursor > to) break
    if (cursor >= from) out.push(cursor)
  }
  return [...new Set(out)].filter((d) => d <= to).sort()
}

export interface ProjectionPoint {
  date: ISODate
  cash: number
  debt: number
  savings: number
}

export interface ProjectionResult {
  points: ProjectionPoint[]
  events: TimelineEvent[]
  /** Premier jour ou la tresorerie passe sous zero. */
  firstNegative?: ISODate
  lowest: { date: ISODate; cash: number }
  endCash: number
  endDebt: number
  endSavings: number
  totalIncome: number
  totalObligations: number
  totalDebtPaid: number
  totalLiving: number
}

/**
 * Projection jour par jour selon la cascade
 * ENCAISSEMENT -> RESERVES -> VIE -> DETTES -> EPARGNE.
 * En fin de mois, l'excedent bascule vers l'epargne, mais seulement au-dela du
 * coussin de securite ET de ce que coute le mois suivant.
 */
export function project(s: AppState, days: number, ref: ISODate = todayISO()): ProjectionResult {
  // On planifie au-dela de l'horizon : le balayage de fin de mois a besoin de
  // savoir ce que coute le mois suivant avant de mettre quoi que ce soit de cote.
  const LOOKAHEAD = 32
  const horizon = days + LOOKAHEAD
  const end = addDays(ref, horizon)

  let cash = bankBalance(s, ref)
  let savings = savingsTotal(s)
  const remaining = new Map<string, number>()
  for (const d of activeDebts(s)) remaining.set(d.id, d.remainingAmount)

  /* ---- 1. Plan des flux, jour par jour ---- */
  interface DayPlan { inflow: TimelineEvent[]; outflow: TimelineEvent[]; living: number }
  const plan: DayPlan[] = Array.from({ length: horizon + 1 }, () => ({ inflow: [], outflow: [], living: 0 }))
  const idx = (d: ISODate) => diffDays(d, ref)

  const push = (date: ISODate, ev: Omit<TimelineEvent, 'balanceAfter'>) => {
    const i = idx(date)
    if (i < 0 || i > horizon) return
    const row = { ...ev, balanceAfter: 0 }
    if (ev.amount >= 0) plan[i].inflow.push(row)
    else plan[i].outflow.push(row)
  }

  // Un encaissement n'est deja dans le solde que si sa date est passee : un
  // revenu marque encaisse mais date en avant reste a venir pour la projection.
  const alreadyBanked = (i: Income, d: ISODate) => i.status === 'encaisse' && d <= ref

  for (const i of s.incomes) {
    if (i.recurring) {
      let cursor = i.date
      for (let k = 0; k < 400 && cursor <= end; k++) {
        if (cursor >= ref && !alreadyBanked(i, cursor)) {
          push(cursor, { date: cursor, kind: 'income', label: i.client || 'Revenu recurrent', amount: i.amount, certain: i.status !== 'prevu', id: i.id })
        }
        cursor = addMonths(cursor, 1)
      }
    } else if (i.date >= ref && i.date <= end && !alreadyBanked(i, i.date)) {
      push(i.date, { date: i.date, kind: 'income', label: i.client || 'Revenu', amount: i.amount, certain: i.status !== 'prevu', id: i.id })
    }
  }

  for (const o of s.obligations) {
    for (const d of obligationOccurrences(o, ref, end)) {
      if (o.status === 'paye' && d === o.dueDate) continue
      // Une echeance deja passee reste due : on l'impute des demain, sinon elle
      // tomberait sur le jour 0 (le solde d'aujourd'hui) et disparaitrait.
      const date = d <= ref ? addDays(ref, 1) : d
      push(date, { date, kind: 'obligation', label: o.name, amount: -o.amount, certain: true, id: o.id })
    }
  }

  const living = livingSnapshot(s, ref)
  const currentMonth = monthKey(ref)
  for (let day = 1; day <= horizon; day++) {
    const date = addDays(ref, day)
    const dm = fromISO(date)
    plan[day].living =
      monthKey(date) === currentMonth
        ? Math.max(0, living.remaining) / Math.max(1, living.daysLeft)
        : s.settings.livingBudget / daysInMonth(dm.getFullYear(), dm.getMonth())
  }

  /* ---- 2. Deroule des jours ---- */
  const events: TimelineEvent[] = []
  const points: ProjectionPoint[] = []
  let totalIncome = 0
  let totalObligations = 0
  let totalDebtPaid = 0
  let totalLiving = 0
  let firstNegative: ISODate | undefined
  let lowest = { date: ref, cash }

  /**
   * Ce qu'il faut garder pour traverser les 31 jours suivants.
   * On suit le creux du cumul, pas le solde net du mois : un revenu qui arrive
   * le 20 ne paie pas une echeance du 5.
   */
  const needAhead = (from: number): number => {
    let run = 0
    let trough = 0
    for (let k = from + 1; k <= Math.min(horizon, from + 31); k++) {
      const out = plan[k].outflow.reduce((a, e) => a - e.amount, 0) + plan[k].living
      const inn = plan[k].inflow.reduce((a, e) => a + e.amount, 0)
      run += inn - out
      if (run < trough) trough = run
    }
    return round2(Math.max(0, -trough))
  }

  for (let day = 0; day <= days; day++) {
    const date = addDays(ref, day)
    const dm = fromISO(date)

    if (day > 0) {
      for (const e of plan[day].inflow) {
        cash = round2(cash + e.amount)
        totalIncome = round2(totalIncome + e.amount)
        events.push({ ...e, balanceAfter: cash })
      }
      for (const e of plan[day].outflow) {
        cash = round2(cash + e.amount)
        totalObligations = round2(totalObligations - e.amount)
        events.push({ ...e, balanceAfter: cash })
      }
      for (const d of activeDebts(s)) {
        const left = remaining.get(d.id) ?? 0
        if (left <= 0 || !d.monthlyPayment) continue
        const dueDay = Math.min(d.dueDay || 5, daysInMonth(dm.getFullYear(), dm.getMonth()))
        if (dm.getDate() !== dueDay) continue
        const pay = round2(Math.min(left, d.monthlyPayment))
        remaining.set(d.id, round2(left - pay))
        cash = round2(cash - pay)
        totalDebtPaid = round2(totalDebtPaid + pay)
        events.push({
          date, kind: 'debt', label: `${d.name} (mensualite)`, amount: -pay,
          balanceAfter: cash, certain: true, id: d.id,
        })
      }
      cash = round2(cash - plan[day].living)
      totalLiving = round2(totalLiving + plan[day].living)
    }

    // Balayage de fin de mois : on ne met de cote que ce dont le mois suivant
    // n'a pas besoin, coussin de securite compris.
    if (day > 0 && date === endOfMonth(date)) {
      const sweep = round2(Math.max(0, cash - s.settings.safetyBuffer - needAhead(day)))
      if (sweep > 0) {
        cash = round2(cash - sweep)
        savings = round2(savings + sweep)
      }
    }

    if (cash < 0 && !firstNegative) firstNegative = date
    if (cash < lowest.cash) lowest = { date, cash }
    points.push({
      date,
      cash,
      debt: round2([...remaining.values()].reduce((a, v) => a + v, 0)),
      savings,
    })
  }

  const last = points[points.length - 1]
  return {
    points,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    firstNegative,
    lowest,
    endCash: last.cash,
    endDebt: last.debt,
    endSavings: last.savings,
    totalIncome,
    totalObligations,
    totalDebtPaid,
    totalLiving,
  }
}

/** Fil d'evenements pour le calendrier (meme moteur que la projection). */
export function timeline(s: AppState, days: number, ref: ISODate = todayISO()): TimelineEvent[] {
  return project(s, days, ref).events
}

export function groupByMonth<T extends { date: ISODate }>(rows: T[]): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = monthKey(r.date)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, rows]) => ({ key, rows }))
}

export { diffDays }

/* ------------------------------------------------------------------ */
/* La cascade du mois                                                   */
/* REVENU -> FRAIS FIXES -> RESTE -> VIE -> DETTES -> RESTE REEL        */
/* ------------------------------------------------------------------ */

export interface CascadeLeaf {
  key: string
  label: string
  amount: number
}

export interface Cascade {
  monthKey: string
  /** Encaisse sur le mois. */
  incomeCashed: number
  /** Facture ou prevu, encore attendu d'ici la fin du mois. */
  incomeExpected: number
  income: number
  fixedTotal: number
  fixedByCategory: CascadeLeaf[]
  afterFixed: number
  living: number
  afterLiving: number
  debts: number
  debtLines: CascadeLeaf[]
  afterDebts: number
  /** Effort mensuel de mise de cote pour les depenses non mensuelles. */
  provisions: number
  provisionLines: CascadeLeaf[]
  /** Ce qui reste vraiment : l'epargne possible de ce mois. */
  real: number
}

/**
 * Photo du mois selon la cascade. On compte toutes les occurrences
 * d'obligations du mois (reglees ou non) : le mois coute ce qu'il coute,
 * qu'on ait deja paye ou pas.
 */
export function monthlyCascade(s: AppState, ref: ISODate = todayISO()): Cascade {
  const key = monthKey(ref)
  const from = startOfMonth(ref)
  const to = endOfMonth(ref)

  const incomeCashed = round2(
    s.incomes
      .filter((i) => i.status === 'encaisse' && monthKey(i.date) === key)
      .reduce((a, i) => a + i.amount, 0),
  )
  const incomeExpected = round2(
    s.incomes
      .filter((i) => i.status !== 'encaisse' && monthKey(i.date) === key && i.date >= ref)
      .reduce((a, i) => a + i.amount, 0),
  )

  const byCat = new Map<string, number>()
  let fixedTotal = 0
  for (const o of s.obligations) {
    const occ = obligationOccurrences(o, from, to).filter((d) => d >= from && d <= to)
    // Une obligation deja reglee ce mois-ci compte aussi dans le cout du mois.
    const paidThisMonth = o.status === 'paye' && o.paidAt && monthKey(o.paidAt) === key
    const times = occ.length + (paidThisMonth ? 1 : 0)
    if (times === 0) continue
    const amount = round2(o.amount * times)
    fixedTotal = round2(fixedTotal + amount)
    byCat.set(o.category, round2((byCat.get(o.category) || 0) + amount))
  }

  const debtLines: CascadeLeaf[] = activeDebts(s)
    .filter((d) => d.monthlyPayment > 0)
    .map((d) => ({
      key: d.id,
      label: d.name,
      amount: round2(Math.min(d.remainingAmount, d.monthlyPayment)),
    }))
  const debts = round2(debtLines.reduce((a, l) => a + l.amount, 0))

  const provisionLines: CascadeLeaf[] = s.provisions
    .map((p) => {
      const st = provisionStatus(p, ref)
      return { key: p.id, label: `${p.emoji} ${p.name}`, amount: st.monthly }
    })
    .filter((l) => l.amount > 0)
  const provisions = round2(provisionLines.reduce((a, l) => a + l.amount, 0))

  const income = round2(incomeCashed + incomeExpected)
  const afterFixed = round2(income - fixedTotal)
  const living = s.settings.livingBudget
  const afterLiving = round2(afterFixed - living)
  const afterDebts = round2(afterLiving - debts)

  return {
    monthKey: key,
    incomeCashed,
    incomeExpected,
    income,
    fixedTotal,
    fixedByCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ key: category, label: category, amount }))
      .sort((a, b) => b.amount - a.amount),
    afterFixed,
    living,
    afterLiving,
    debts,
    debtLines: debtLines.sort((a, b) => b.amount - a.amount),
    afterDebts,
    provisions,
    provisionLines: provisionLines.sort((a, b) => b.amount - a.amount),
    real: round2(afterDebts - provisions),
  }
}

/** Meme cascade, mais appliquee a un encaissement precis. */
export function incomeCascade(s: AppState, amount: number, ref: ISODate = todayISO()) {
  const a = suggestAllocation(s, amount, ref)
  return {
    income: round2(amount),
    fixed: a.obligations,
    afterFixed: round2(amount - a.obligations),
    living: a.vie,
    afterLiving: round2(amount - a.obligations - a.vie),
    debts: a.dettes,
    real: a.epargne,
    reasons: a.reasons,
  }
}

/* ------------------------------------------------------------------ */
/* Navigation dans les mois                                            */
/* ------------------------------------------------------------------ */

/**
 * Date de reference pour observer un mois donne.
 * Le mois en cours s'observe a aujourd'hui ; un mois passe a sa derniere
 * journee (il est clos) ; un mois futur a son premier jour (tout reste a faire).
 */
export function refForMonth(key: string, ref: ISODate = todayISO()): ISODate {
  const current = monthKey(ref)
  if (key === current) return ref
  return key < current ? endOfMonth(`${key}-01`) : `${key}-01`
}

export interface MonthPosition {
  key: string
  isPast: boolean
  isCurrent: boolean
  isFuture: boolean
  ref: ISODate
}

export function monthPosition(key: string, ref: ISODate = todayISO()): MonthPosition {
  const current = monthKey(ref)
  return {
    key,
    isPast: key < current,
    isCurrent: key === current,
    isFuture: key > current,
    ref: refForMonth(key, ref),
  }
}

export function shiftMonth(key: string, delta: number): string {
  return monthKey(addMonths(`${key}-01`, delta))
}

/* ------------------------------------------------------------------ */
/* Provisions : les depenses non mensuelles, lissees                    */
/* ------------------------------------------------------------------ */

export interface ProvisionStatus {
  provision: Provision
  /** Mois restants avant l'echeance, au moins 1. */
  monthsLeft: number
  /** Ce qu'il reste a mettre de cote. */
  missing: number
  /** Effort mensuel pour y arriver a temps. */
  monthly: number
  /** Part deja couverte, bornee a 1. */
  covered: number
  ready: boolean
  late: boolean
}

/** Nombre de mois calendaires entre deux dates, au moins 1. */
export function monthsUntil(due: ISODate, ref: ISODate = todayISO()): number {
  const a = fromISO(ref)
  const b = fromISO(due)
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  // Une echeance plus tard dans le mois courant laisse encore ce mois-ci.
  return Math.max(1, months + (b.getDate() >= a.getDate() ? 0 : 0) + (months <= 0 ? 1 : 0))
}

export function provisionStatus(p: Provision, ref: ISODate = todayISO()): ProvisionStatus {
  const missing = round2(Math.max(0, p.amount - p.saved))
  const monthsLeft = monthsUntil(p.dueDate, ref)
  return {
    provision: p,
    monthsLeft,
    missing,
    monthly: round2(missing / monthsLeft),
    covered: ratio(p.saved, p.amount),
    ready: p.saved >= p.amount,
    late: p.dueDate < ref && p.saved < p.amount,
  }
}

export function provisionsMonthlyTotal(s: AppState, ref: ISODate = todayISO()): number {
  return round2(s.provisions.reduce((a, p) => a + provisionStatus(p, ref).monthly, 0))
}

export function provisionsSaved(s: AppState): number {
  return round2(s.provisions.reduce((a, p) => a + p.saved, 0))
}

/* ------------------------------------------------------------------ */
/* Epargne : rythme, taux, fonds de precaution                          */
/* ------------------------------------------------------------------ */

/** Ce qui a reellement ete mis de cote sur un mois. */
export function savedInMonth(s: AppState, key: string): number {
  return round2(
    s.transactions
      .filter((t) => t.kind === 'epargne' && monthKey(t.date) === key)
      .reduce((a, t) => a + Math.abs(t.amount), 0),
  )
}

export function incomeInMonth(s: AppState, key: string): number {
  return round2(
    s.incomes
      .filter((i) => i.status === 'encaisse' && monthKey(i.date) === key)
      .reduce((a, i) => a + i.amount, 0),
  )
}

/** Part du revenu du mois reellement epargnee. */
export function savingsRate(s: AppState, key: string): number {
  const income = incomeInMonth(s, key)
  if (income <= 0) return 0
  return savedInMonth(s, key) / income
}

/** Moyenne mensuelle epargnee sur les `months` derniers mois revolus. */
export function savingsPace(s: AppState, months = 3, ref: ISODate = todayISO()): number {
  const current = monthKey(ref)
  let total = 0
  for (let i = 1; i <= months; i++) total += savedInMonth(s, shiftMonth(current, -i))
  return round2(total / months)
}

/** Historique mensuel de l'epargne, pour le graphique. */
export function savingsHistory(s: AppState, months = 12, ref: ISODate = todayISO()) {
  const current = monthKey(ref)
  const out: { key: string; amount: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(current, -i)
    out.push({ key, amount: savedInMonth(s, key) })
  }
  return out
}

export interface EmergencyFund {
  saved: number
  /** Charges mensuelles a couvrir : obligations + vie + dettes + provisions. */
  monthlyNeed: number
  monthsCovered: number
  targetMonths: number
  targetAmount: number
  covered: number
  missing: number
  pace: number
  /** Mois restants au rythme actuel, ou null si le rythme est nul. */
  monthsToComplete: number | null
}

/**
 * Le fonds de precaution se mesure en mois de charges tenables sans revenu,
 * pas en euros : c'est ce chiffre-la qui dit si un mois creux est survivable.
 */
export function emergencyFund(s: AppState, ref: ISODate = todayISO()): EmergencyFund {
  const key = monthKey(ref)
  const fixed = round2(
    s.obligations
      .filter((o) => o.recurrence === 'monthly')
      .reduce((a, o) => a + o.amount, 0),
  )
  const debts = round2(
    activeDebts(s).reduce((a, d) => a + Math.min(d.remainingAmount, d.monthlyPayment), 0),
  )
  const monthlyNeed = round2(fixed + s.settings.livingBudget + debts + provisionsMonthlyTotal(s, ref))
  const saved = savingsTotal(s)
  const targetMonths = Math.max(1, s.settings.emergencyMonths)
  const targetAmount = round2(monthlyNeed * targetMonths)
  const missing = round2(Math.max(0, targetAmount - saved))
  const pace = savingsPace(s, 3, ref) || savedInMonth(s, key)
  return {
    saved,
    monthlyNeed,
    monthsCovered: monthlyNeed > 0 ? saved / monthlyNeed : 0,
    targetMonths,
    targetAmount,
    covered: ratio(saved, targetAmount),
    missing,
    pace,
    monthsToComplete: pace > 0 && missing > 0 ? Math.ceil(missing / pace) : missing <= 0 ? 0 : null,
  }
}

/* ------------------------------------------------------------------ */
/* Repartition de l'enveloppe de vie par categorie                      */
/* ------------------------------------------------------------------ */

export interface CategoryRow {
  category: TxCategory
  planned: number
  actual: number
  /** planned - actual : positif = il reste, negatif = depassement. */
  delta: number
  share: number
  count: number
}

export interface CategoryBreakdown {
  rows: CategoryRow[]
  plannedTotal: number
  actualTotal: number
  budget: number
  /** Ecart entre la somme des enveloppes et le budget de vie. */
  unallocated: number
}

export function categoryBreakdown(s: AppState, key: string): CategoryBreakdown {
  const budgets = s.settings.categoryBudgets || {}
  const rows: CategoryRow[] = []
  const month = s.transactions.filter((t) => t.kind === 'vie' && monthKey(t.date) === key)
  const actualTotal = round2(month.reduce((a, t) => a + Math.abs(t.amount), 0))

  const categories = new Set<TxCategory>([
    ...(Object.keys(budgets) as TxCategory[]),
    ...month.map((t) => t.category),
  ])

  for (const category of categories) {
    const rowsForCat = month.filter((t) => t.category === category)
    const actual = round2(rowsForCat.reduce((a, t) => a + Math.abs(t.amount), 0))
    const planned = round2(budgets[category] || 0)
    rows.push({
      category,
      planned,
      actual,
      delta: round2(planned - actual),
      share: actualTotal > 0 ? actual / actualTotal : 0,
      count: rowsForCat.length,
    })
  }

  rows.sort((a, b) => b.actual - a.actual || b.planned - a.planned)
  const plannedTotal = round2(rows.reduce((a, r) => a + r.planned, 0))
  return {
    rows,
    plannedTotal,
    actualTotal,
    budget: s.settings.livingBudget,
    unallocated: round2(s.settings.livingBudget - plannedTotal),
  }
}

/* ------------------------------------------------------------------ */
/* Meteo du mois et faits marquants                                     */
/* ------------------------------------------------------------------ */

export type WeatherLevel = 'large' | 'serre' | 'tendu' | 'depasse'

export interface Weather {
  level: WeatherLevel
  title: string
  detail: string
  /** Enveloppe restante projetee en fin de mois, au rythme actuel. */
  projectedEnd: number
  pace: number
}

/**
 * La meteo repond a la seule question du matin : est-ce que ca passe ?
 * Elle compare le rythme reel au rythme tenable jusqu'a la fin du mois.
 */
export function weather(
  s: AppState,
  ref: ISODate = todayISO(),
  now: ISODate = todayISO(),
): Weather {
  const l = livingSnapshot(s, ref)
  const d = fromISO(ref)
  const total = daysInMonth(d.getFullYear(), d.getMonth())
  const elapsed = Math.max(1, dayOfMonth(ref))
  const perDaySoFar = l.spent / elapsed
  const projectedSpend = round2(perDaySoFar * total)
  const projectedEnd = round2(l.budget - projectedSpend)
  const position = monthKey(ref) < monthKey(now) ? 'past' : monthKey(ref) > monthKey(now) ? 'future' : 'current'

  // Un mois clos ne se projette pas : il se raconte.
  if (position === 'past') {
    const over = l.remaining < 0
    return {
      level: over ? 'depasse' : l.remaining < l.budget * 0.1 ? 'serre' : 'large',
      title: over ? 'Mois termine en depassement' : 'Mois termine',
      detail: over
        ? `Tu avais depasse l'enveloppe de ${euro(l.overspent)}.`
        : `Tu avais depense ${euro(l.spent)} sur ${euro(l.budget)}, soit ${euro(l.remaining)} non utilises.`,
      projectedEnd: l.remaining,
      pace: round2(l.spent / total),
    }
  }

  // Un mois a venir n'a pas encore de rythme.
  if (position === 'future') {
    return {
      level: 'large',
      title: 'Mois a venir',
      detail: `L'enveloppe de ${euro(l.budget)} est encore entiere.`,
      projectedEnd: l.budget,
      pace: 0,
    }
  }

  if (l.remaining < 0) {
    return {
      level: 'depasse',
      title: 'Enveloppe depassee',
      detail: `Tu as depense ${euro(l.overspent)} de plus que ton budget de vie.`,
      projectedEnd,
      pace: round2(perDaySoFar),
    }
  }
  if (projectedEnd < 0) {
    return {
      level: 'tendu',
      title: 'Mois tendu',
      detail: `A ce rythme, tu finirais le mois ${euro(-projectedEnd)} au-dela de l'enveloppe.`,
      projectedEnd,
      pace: round2(perDaySoFar),
    }
  }
  if (projectedEnd < l.budget * 0.1) {
    return {
      level: 'serre',
      title: 'Ca se joue serre',
      detail: `Il resterait environ ${euro(projectedEnd)} de marge en fin de mois. Garde le cap.`,
      projectedEnd,
      pace: round2(perDaySoFar),
    }
  }
  return {
    level: 'large',
    title: 'Tu as de la marge',
    detail: `A ce rythme, il te resterait ${euro(projectedEnd)} en fin de mois.`,
    projectedEnd,
    pace: round2(perDaySoFar),
  }
}

export interface Insight {
  id: string
  tone: 'good' | 'info' | 'warn' | 'critical'
  icon: string
  title: string
  detail: string
}

/**
 * Trois faits au maximum, tries par ce qui merite une decision.
 * L'objectif est de comprendre le mois en quelques secondes, pas de tout lire.
 */
export function insights(
  s: AppState,
  ref: ISODate = todayISO(),
  now: ISODate = todayISO(),
): Insight[] {
  const out: Insight[] = []
  const key = monthKey(ref)
  const closed = key < monthKey(now)
  const future = key > monthKey(now)
  const l = livingSnapshot(s, ref)
  const w = weather(s, ref, now)
  const breakdown = categoryBreakdown(s, key)
  const overdue = overdueObligations(s, ref)
  const upcoming = obligationsDueWithin(s, 7, ref)
  const lateProvisions = s.provisions.map((p) => provisionStatus(p, ref)).filter((p) => p.late)

  if (overdue.length > 0) {
    out.push({
      id: 'overdue',
      tone: 'critical',
      icon: '⚠️',
      title: `${overdue.length} obligation(s) en retard`,
      detail: `${euro(overdue.reduce((a, o) => a + o.amount, 0))} a regler. C'est le premier poste a traiter.`,
    })
  }

  const worst = breakdown.rows.filter((r) => r.planned > 0 && r.delta < 0).sort((a, b) => a.delta - b.delta)[0]
  if (worst) {
    out.push({
      id: `over-${worst.category}`,
      tone: 'warn',
      icon: '\u{1F53A}',
      title: `${TX_CATEGORY_LABELS[worst.category]} depasse de ${euro(-worst.delta)}`,
      detail: `${euro(worst.actual)} depenses contre ${euro(worst.planned)} prevus. A rattraper sur une autre enveloppe, ou a ajuster.`,
    })
  }

  if (!closed && !future && l.remaining >= 0 && l.paceDelta > 0) {
    out.push({
      id: 'under',
      tone: 'good',
      icon: '\u{1F340}',
      title: `Tu es ${euro(l.paceDelta)} sous ton rythme`,
      detail: `${euro(l.spent)} depenses la ou ${euro(l.paceTarget)} etaient "attendus" a ce stade du mois.`,
    })
  }

  if (closed) {
    out.push({
      id: 'closed',
      tone: l.remaining >= 0 ? 'good' : 'warn',
      icon: '\u{1F3C1}',
      title: l.remaining >= 0
        ? `Mois termine avec ${euro(l.remaining)} non depenses`
        : `Mois termine ${euro(l.overspent)} au-dela de l'enveloppe`,
      detail: `${euro(l.spent)} depenses en ${l.count} achat(s) sur une enveloppe de ${euro(l.budget)}.`,
    })
  } else if (future) {
    out.push({
      id: 'future',
      tone: 'info',
      icon: '\u{1F5D3}\uFE0F',
      title: 'Mois a venir',
      detail: `L'enveloppe de ${euro(l.budget)} est encore entiere. Les echeances connues apparaissent dans le calendrier.`,
    })
  } else {
    out.push({
      id: 'end',
      tone: w.level === 'large' ? 'good' : w.level === 'serre' ? 'info' : 'warn',
      title: `Fin de mois estimee a ${euro(w.projectedEnd)}`,
      icon: '\u{1F3AF}',
      detail:
        l.remaining > 0
          ? `Soit ${euro(l.perDay)} par jour sur les ${l.daysLeft} jours restants.`
          : `L'enveloppe est epuisee : chaque euro depense entame le mois prochain.`,
    })
  }

  if (!closed && upcoming.length > 0 && overdue.length === 0) {
    out.push({
      id: 'soon',
      tone: 'info',
      icon: '\u{1F4C5}',
      title: `${euro(upcoming.reduce((a, o) => a + o.amount, 0))} d'echeances sous 7 jours`,
      detail: upcoming.map((o) => o.name).slice(0, 3).join(', ') + '.',
    })
  }

  const lateActions = overdueDeadlines(s, ref)
  const soonActions = deadlinesDueWithin(s, 14, ref)
  const action = lateActions[0] ?? soonActions[0]
  if (action && !closed && !future) {
    const stake = action.impact ? ` ${action.impact > 0 ? 'Gain' : 'Cout'} estime : ${euro(Math.abs(action.impact))} ${action.impactPeriod === 'mois' ? 'par mois' : action.impactPeriod === 'an' ? 'par an' : ''}.` : ''
    out.push({
      id: `deadline-${action.id}`,
      tone: lateActions.length > 0 ? 'critical' : 'warn',
      icon: '\u{1F4CC}',
      title: `${action.title} \u2014 ${relativeDue(action.dueDate, ref)}`,
      detail: `${action.detail ? action.detail + '.' : 'Echeance administrative a traiter.'}${stake}`,
    })
  }

  if (lateProvisions.length > 0) {
    out.push({
      id: 'provision',
      tone: 'warn',
      icon: '\u{1F3DB}️',
      title: `${lateProvisions.length} provision(s) incomplete(s)`,
      detail: `Il manque ${euro(lateProvisions.reduce((a, p) => a + p.missing, 0))} pour couvrir une facture deja echue.`,
    })
  }

  return out.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/* Echeances administratives et fiscales                                */
/* ------------------------------------------------------------------ */

const DEADLINE_RANK: Record<DeadlinePriority, number> = {
  urgente: 0,
  importante: 1,
  a_prevoir: 2,
}

/**
 * Les echeances encore ouvertes, la plus pressante en tete.
 * On trie par date avant la priorite : une action importante qui tombe demain
 * passe devant une action urgente prevue dans six mois.
 */
export function openDeadlines(s: AppState): Deadline[] {
  return s.deadlines
    .filter((d) => !d.done)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || DEADLINE_RANK[a.priority] - DEADLINE_RANK[b.priority])
}

export function overdueDeadlines(s: AppState, ref: ISODate = todayISO()): Deadline[] {
  return openDeadlines(s).filter((d) => d.dueDate < ref)
}

export function deadlinesDueWithin(s: AppState, days: number, ref: ISODate = todayISO()): Deadline[] {
  const limit = addDays(ref, days)
  return openDeadlines(s).filter((d) => d.dueDate >= ref && d.dueDate <= limit)
}

/** Ramene un impact a une valeur annuelle, pour pouvoir les comparer. */
export function yearlyImpact(d: Deadline): number {
  if (!d.impact) return 0
  if (d.impactPeriod === 'mois') return round2(d.impact * 12)
  return round2(d.impact)
}

/** Ce qui se joue sur les echeances encore ouvertes : gains et couts. */
export function deadlineStakes(s: AppState) {
  const open = openDeadlines(s)
  const gains = round2(open.filter((d) => (d.impact ?? 0) > 0).reduce((a, d) => a + yearlyImpact(d), 0))
  const costs = round2(open.filter((d) => (d.impact ?? 0) < 0).reduce((a, d) => a + yearlyImpact(d), 0))
  return { open: open.length, gains, costs, net: round2(gains + costs) }
}
