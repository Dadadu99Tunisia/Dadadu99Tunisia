import { describe, it, expect } from 'vitest'
import type { AppState, Deadline, Debt, Income, Obligation, Provision, Transaction } from '../types'
import { emptyState, uid } from './storage'
import {
  availability, analyseExpense, bankBalance, behaviourComparison, crisisState,
  debtTotal, expectedMonthlyIncome, healthReport, incomeCascade, livingSnapshot, monthlyCascade, obligationOccurrences,
  overdueObligations, project, splitPaymentImpact, suggestAllocation,
  categoryBreakdown, emergencyFund, insights, monthPosition, provisionStatus,
  provisionsMonthlyTotal, provisionsSaved, refForMonth, savedInMonth,
  savingsHistory, savingsPace, savingsRate, shiftMonth, weather,
  deadlineStakes, deadlinesDueWithin, openDeadlines, overdueDeadlines, yearlyImpact,
  accountBalance, accountBalances, accountsInTrouble,
} from './engine'
import { addDays, addMonths, relativeDue, startOfMonth } from './dates'
import { parseAmount, round2 } from './money'

/* Le 15 : un mois a mi-parcours, sans piege de fin de mois. */
const REF = '2026-09-15'
const SOM = startOfMonth(REF)

function base(): AppState {
  const s = emptyState()
  s.settings.livingBudget = 1000
  s.settings.expectedMonthlyIncome = 4000
  setOpening(s, 0, SOM)
  return s
}

/** Le solde d'ouverture vit sur le compte, plus dans les reglages. */
function setOpening(s: AppState, balance: number, date = SOM): void {
  s.accounts[0].openingBalance = balance
  s.accounts[0].openingBalanceDate = date
}

function income(p: Partial<Income>): Income {
  return { id: uid(), date: REF, client: 'Client', amount: 1000, type: 'mission', status: 'encaisse', ...p }
}
function tx(p: Partial<Transaction>): Transaction {
  return { id: uid(), date: REF, description: 'Achat', category: 'shopping', amount: 100, kind: 'vie', ...p }
}
function obligation(p: Partial<Obligation>): Obligation {
  return { id: uid(), name: 'URSSAF', amount: 625, dueDate: REF, category: 'urssaf', status: 'a_payer', recurrence: 'none', ...p }
}
function debt(p: Partial<Debt>): Debt {
  return {
    id: uid(), name: 'Dette', initialAmount: 1000, remainingAmount: 1000, monthlyPayment: 100,
    dueDay: 5, priority: 'moyenne', kind: 'credit', status: 'active', ...p,
  }
}

describe('parseAmount', () => {
  it('accepte les formats francais et les saisies sales', () => {
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount('1 234,56 €')).toBe(1234.56)
    expect(parseAmount('180')).toBe(180)
    expect(parseAmount('-40.2')).toBe(-40.2)
  })
  it('renvoie NaN sur une saisie vide ou illisible', () => {
    expect(Number.isNaN(parseAmount(''))).toBe(true)
    expect(Number.isNaN(parseAmount('abc'))).toBe(true)
    expect(Number.isNaN(parseAmount('-'))).toBe(true)
  })
  it('ne laisse pas filer les flottants', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('solde bancaire', () => {
  it('part du solde d’ouverture et suit le ledger', () => {
    const s = base()
    setOpening(s, 500)
    s.incomes = [income({ amount: 4000, date: addDays(SOM, 2) })]
    s.transactions = [tx({ amount: 200, date: addDays(SOM, 3) })]
    expect(bankBalance(s, REF)).toBe(4300)
  })

  it('ignore les revenus non encaisses', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, status: 'facture' }), income({ amount: 5000, status: 'prevu' })]
    expect(bankBalance(s, REF)).toBe(0)
  })

  it('ignore les mouvements anterieurs au solde d’ouverture', () => {
    const s = base()
    setOpening(s, 100)
    s.transactions = [tx({ amount: 50, date: addDays(SOM, -5) })]
    expect(bankBalance(s, REF)).toBe(100)
  })

  it('accepte un ajustement signe pour recaler le solde reel', () => {
    const s = base()
    setOpening(s, 100)
    s.transactions = [tx({ amount: -75, kind: 'ajustement', category: 'autre' })]
    expect(bankBalance(s, REF)).toBe(25)
  })

  it('gere un compte negatif', () => {
    const s = base()
    setOpening(s, 100)
    s.transactions = [tx({ amount: 450 })]
    expect(bankBalance(s, REF)).toBe(-350)
    expect(crisisState(s, REF).auto).toBe(true)
  })
})

describe('enveloppe de vie', () => {
  it('mois sans aucune depense', () => {
    const l = livingSnapshot(base(), REF)
    expect(l.spent).toBe(0)
    expect(l.remaining).toBe(1000)
    expect(l.daysLeft).toBe(16) // du 15 au 30 septembre inclus
    expect(l.perDay).toBe(62.5)
    expect(l.perWeek).toBe(437.5)
  })

  it('ne compte que les depenses de vie du mois courant', () => {
    const s = base()
    s.transactions = [
      tx({ amount: 258 }),
      tx({ amount: 700, kind: 'obligation', category: 'logement' }),
      tx({ amount: 145, kind: 'dette', category: 'dette' }),
      tx({ amount: 300, kind: 'epargne', category: 'epargne' }),
      tx({ amount: 80, date: addMonths(REF, -1) }),
    ]
    const l = livingSnapshot(s, REF)
    expect(l.spent).toBe(258)
    expect(l.remaining).toBe(742)
    expect(l.count).toBe(1)
  })

  it('gere un depassement de budget sans produire de valeurs absurdes', () => {
    const s = base()
    s.transactions = [tx({ amount: 1200 })]
    const l = livingSnapshot(s, REF)
    expect(l.remaining).toBe(-200)
    expect(l.overspent).toBe(200)
    expect(l.perDay).toBe(0)
    expect(l.perWeek).toBe(0)
    expect(l.progress).toBe(1) // la barre sature, elle ne deborde pas
  })

  it('repart a zero le mois suivant', () => {
    const s = base()
    s.transactions = [tx({ amount: 900, date: REF })]
    expect(livingSnapshot(s, REF).spent).toBe(900)
    expect(livingSnapshot(s, addMonths(REF, 1)).spent).toBe(0)
    expect(livingSnapshot(s, addMonths(REF, 1)).remaining).toBe(1000)
  })

  it('suit un changement de budget', () => {
    const s = base()
    s.transactions = [tx({ amount: 600 })]
    expect(livingSnapshot(s, REF).remaining).toBe(400)
    s.settings.livingBudget = 1500
    expect(livingSnapshot(s, REF).remaining).toBe(900)
    s.settings.livingBudget = 500
    expect(livingSnapshot(s, REF).remaining).toBe(-100)
  })

  it('calcule le rythme attendu a ce stade du mois', () => {
    const s = base()
    const l = livingSnapshot(s, REF)
    expect(l.paceTarget).toBe(500) // 15 jours sur 30
    expect(l.paceDelta).toBe(500)
  })
})

describe('argent reellement disponible', () => {
  it('ne confond jamais solde bancaire et disponible', () => {
    const s = base()
    setOpening(s, 5000)
    s.obligations = [obligation({ amount: 625, dueDate: addDays(REF, 3) })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145 })]
    const a = availability(s, REF)
    expect(a.bank).toBe(5000)
    expect(a.obligationsSoon).toBe(625)
    expect(a.debtsSoon).toBe(145)
    expect(a.livingCommitted).toBe(1000)
    expect(a.available).toBe(5000 - 625 - 145 - 1000)
  })

  it('distingue les obligations proches de l’encours total', () => {
    const s = base()
    setOpening(s, 2000)
    s.obligations = [
      obligation({ amount: 200, dueDate: addDays(REF, 5) }),
      obligation({ amount: 800, dueDate: addDays(REF, 90) }),
    ]
    const a = availability(s, REF)
    expect(a.obligationsSoon).toBe(200)
    expect(a.obligationsAll).toBe(1000)
  })

  it('expose la position nette, epargne comprise', () => {
    const s = base()
    setOpening(s, 1000)
    s.savingsGoals[0].current = 500
    s.debts = [debt({ remainingAmount: 4000, monthlyPayment: 0 })]
    expect(availability(s, REF).netPosition).toBe(1000 + 500 - 4000)
  })

  it('reste coherent quand le disponible est negatif', () => {
    const s = base()
    setOpening(s, 100)
    s.obligations = [obligation({ amount: 625 })]
    const a = availability(s, REF)
    expect(a.available).toBe(100 - 625 - 1000)
    expect(crisisState(s, REF).auto).toBe(true)
  })
})

describe('repartition d’un encaissement', () => {
  it('suit la cascade reserves -> vie -> dettes -> epargne', () => {
    const s = base()
    s.obligations = [obligation({ amount: 625, dueDate: addDays(REF, 10) })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145 })]
    const a = suggestAllocation(s, 5000, REF)
    expect(a.obligations).toBe(625)
    expect(a.vie).toBe(1000)
    expect(a.dettes).toBe(145)
    expect(a.epargne).toBe(5000 - 625 - 1000 - 145)
    expect(a.obligations + a.vie + a.dettes + a.epargne).toBe(5000)
  })

  it('ne distribue jamais plus que le montant encaisse (revenu faible)', () => {
    const s = base()
    s.obligations = [obligation({ amount: 625, dueDate: addDays(REF, 10) })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145 })]
    const a = suggestAllocation(s, 300, REF)
    expect(a.obligations).toBe(300)
    expect(a.vie).toBe(0)
    expect(a.dettes).toBe(0)
    expect(a.epargne).toBe(0)
  })

  it('envoie tout a l’epargne quand plus rien n’est engage', () => {
    const a = suggestAllocation(base(), 20000, REF)
    expect(a.obligations).toBe(0)
    expect(a.dettes).toBe(0)
    expect(a.vie).toBe(1000)
    expect(a.epargne).toBe(19000)
  })

  it('tient un montant nul ou negatif', () => {
    const a = suggestAllocation(base(), 0, REF)
    expect(a.obligations + a.vie + a.dettes + a.epargne).toBe(0)
    const b = suggestAllocation(base(), -50, REF)
    expect(b.epargne).toBe(0)
  })
})

describe('puis-je me le permettre', () => {
  it('chiffre l’impact avant / apres', () => {
    const s = base()
    setOpening(s, 3000)
    s.transactions = [tx({ amount: 258 })]
    const i = analyseExpense(s, 180, { ref: REF })
    expect(i.livingBefore).toBe(742)
    expect(i.livingAfter).toBe(562)
    expect(Math.round(i.shareOfBudget * 100)).toBe(18)
    expect(i.availableAfter).toBe(round2(i.availableBefore - 180))
  })

  it('signale un depassement d’enveloppe', () => {
    const s = base()
    s.transactions = [tx({ amount: 900 })]
    expect(analyseExpense(s, 300, { ref: REF }).level).toBe('depassement')
  })

  it('signale un disponible negatif meme si l’enveloppe tient', () => {
    const s = base()
    setOpening(s, 1000)
    s.obligations = [obligation({ amount: 900, dueDate: addDays(REF, 3) })]
    const i = analyseExpense(s, 50, { ref: REF })
    expect(i.livingAfter).toBeGreaterThan(0)
    expect(i.availableAfter).toBeLessThan(0)
  })

  it('n’impute pas l’enveloppe de vie pour une depense pro', () => {
    const s = base()
    const i = analyseExpense(s, 400, { ref: REF, countsAsLiving: false })
    expect(i.livingAfter).toBe(1000)
  })
})

describe('paiement fractionne', () => {
  it('traduit un achat en obligation future', () => {
    const r = splitPaymentImpact(base(), 180, 3, REF)
    expect(r.monthly).toBe(60)
    expect(r.installments).toBe(3)
    expect(r.nextMonthLivingLeft).toBe(940)
    expect(r.lastDueDate).toBe('2026-11-15')
  })

  it('cumule les fractionnes deja en cours', () => {
    const s = base()
    s.debts = [debt({ kind: 'klarna', remainingAmount: 200, monthlyPayment: 100 })]
    const r = splitPaymentImpact(s, 300, 3, REF)
    expect(r.monthly).toBe(100)
    expect(r.nextMonthLivingLeft).toBe(800) // 1000 - 100 - 100
  })

  it('tient une echeance unique', () => {
    expect(splitPaymentImpact(base(), 50, 1, REF).monthly).toBe(50)
    expect(splitPaymentImpact(base(), 50, 0, REF).installments).toBe(1)
  })
})

describe('dettes', () => {
  it('additionne l’encours des dettes actives seulement', () => {
    const s = base()
    s.debts = [
      debt({ remainingAmount: 6000 }),
      debt({ remainingAmount: 0, status: 'paid' }),
      debt({ remainingAmount: 1500 }),
    ]
    expect(debtTotal(s)).toBe(7500)
  })

  it('gere une dette partiellement remboursee', () => {
    const s = base()
    s.debts = [debt({ initialAmount: 900, remainingAmount: 300, monthlyPayment: 300 })]
    expect(debtTotal(s)).toBe(300)
    const a = availability(s, REF)
    expect(a.debtsSoon).toBe(300)
  })

  it('ne prelevera jamais plus que le restant du', () => {
    const s = base()
    s.debts = [debt({ remainingAmount: 50, monthlyPayment: 145 })]
    expect(availability(s, REF).debtsSoon).toBe(50)
  })
})

describe('obligations recurrentes', () => {
  it('enumere les occurrences mensuelles sur la fenetre', () => {
    const o = obligation({ dueDate: '2026-09-05', recurrence: 'monthly' })
    const occ = obligationOccurrences(o, '2026-09-01', '2026-12-31')
    expect(occ).toEqual(['2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05'])
  })

  it('garde une echeance en retard tant qu’elle n’est pas reglee', () => {
    const s = base()
    s.obligations = [obligation({ dueDate: addDays(REF, -10) })]
    expect(overdueObligations(s, REF)).toHaveLength(1)
    expect(crisisState(s, REF).auto).toBe(true)
  })

  it('n’enumere pas l’occurrence de base une fois payee', () => {
    const o = obligation({ dueDate: '2026-09-05', recurrence: 'monthly', status: 'paye' })
    const occ = obligationOccurrences(o, '2026-09-01', '2026-11-30')
    expect(occ).toEqual(['2026-10-05', '2026-11-05'])
  })

  it('gere le trimestriel et l’annuel', () => {
    expect(obligationOccurrences(obligation({ dueDate: '2026-01-10', recurrence: 'quarterly', status: 'paye' }), '2026-01-01', '2026-12-31'))
      .toEqual(['2026-04-10', '2026-07-10', '2026-10-10'])
    expect(obligationOccurrences(obligation({ dueDate: '2026-02-01', recurrence: 'yearly', status: 'paye' }), '2026-01-01', '2028-12-31'))
      .toEqual(['2027-02-01', '2028-02-01'])
  })

  it('borne le jour au dernier jour du mois cible', () => {
    const occ = obligationOccurrences(obligation({ dueDate: '2026-01-31', recurrence: 'monthly', status: 'paye' }), '2026-01-01', '2026-03-31')
    expect(occ).toEqual(['2026-02-28', '2026-03-28'])
  })
})

describe('revenus', () => {
  it('additionne plusieurs encaissements sur un mois', () => {
    const s = base()
    s.incomes = [
      income({ amount: 4375, date: addDays(SOM, 2) }),
      income({ amount: 10500, date: addDays(SOM, 12) }),
    ]
    expect(bankBalance(s, REF)).toBe(14875)
  })

  it('un mois sans revenu ne casse rien', () => {
    const s = base()
    s.settings.expectedMonthlyIncome = 0
    expect(expectedMonthlyIncome(s, REF)).toBe(0)
    expect(() => healthReport(s, REF)).not.toThrow()
    expect(bankBalance(s, REF)).toBe(0)
  })

  it('retombe sur la moyenne des 3 derniers mois sans parametre', () => {
    const s = base()
    s.settings.expectedMonthlyIncome = 0
    s.incomes = [
      income({ amount: 3000, date: addMonths(REF, -1) }),
      income({ amount: 3000, date: addMonths(REF, -2) }),
    ]
    expect(expectedMonthlyIncome(s, REF)).toBe(2000)
  })

  it('encaisse un revenu tres eleve sans deborder', () => {
    const s = base()
    s.incomes = [income({ amount: 120000 })]
    const a = availability(s, REF)
    expect(a.bank).toBe(120000)
    expect(a.available).toBe(119000)
    expect(healthReport(s, REF).band).toBe('solide')
  })
})

describe('score de sante', () => {
  it('reste borne entre 0 et 100', () => {
    const bad = base()
    setOpening(bad, -800)
    bad.obligations = [obligation({ dueDate: addDays(REF, -20) })]
    bad.debts = [debt({ remainingAmount: 20000, monthlyPayment: 1500 })]
    bad.transactions = [tx({ amount: 1400 })]
    const r = healthReport(bad, REF)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.band).toBe('critique')
    expect(r.factors).toHaveLength(6)
    expect(r.factors.every((f) => f.detail.length > 0)).toBe(true)
  })

  it('recompense une situation saine', () => {
    const s = base()
    setOpening(s, 6000)
    s.savingsGoals[0].current = 3000
    const r = healthReport(s, REF)
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.band).toBe('solide')
  })

  it('la somme des facteurs fait bien le score', () => {
    const r = healthReport(base(), REF)
    expect(r.factors.reduce((a, f) => a + f.score, 0)).toBe(r.score)
  })
})

describe('mode stabilisation', () => {
  it('s’active tout seul et se laisse forcer', () => {
    const s = base()
    setOpening(s, -50)
    expect(crisisState(s, REF).active).toBe(true)
    s.settings.crisisMode = 'off'
    expect(crisisState(s, REF).active).toBe(false)
    s.settings.crisisMode = 'on'
    expect(crisisState(s, REF).active).toBe(true)
  })

  it('reste inactif quand tout va bien', () => {
    const s = base()
    setOpening(s, 5000)
    expect(crisisState(s, REF).auto).toBe(false)
  })
})

describe('comportement', () => {
  it('compare le mois en cours au precedent', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [
      tx({ amount: 100, date: REF, category: 'shopping' }),
      tx({ amount: 50, date: addDays(REF, -1), category: 'restaurant' }),
      tx({ amount: 60, date: '2026-08-10', category: 'shopping' }),
    ]
    const c = behaviourComparison(s, REF)
    expect(c.current.spent).toBe(150)
    expect(c.current.count).toBe(2)
    expect(c.current.average).toBe(75)
    expect(c.current.shopping).toBe(100)
    expect(c.current.restaurant).toBe(50)
    expect(c.previous.spent).toBe(60)
    expect(c.deltaSpent).toBeCloseTo(1.5)
  })

  it('isole les paiements fractionnes', () => {
    const s = base()
    s.transactions = [tx({ amount: 120, split: true }), tx({ amount: 30 })]
    expect(behaviourComparison(s, REF).current.split).toBe(120)
  })

  it('ne divise pas par zero sur un mois vide', () => {
    const c = behaviourComparison(base(), REF)
    expect(c.current.average).toBe(0)
    expect(c.deltaSpent).toBe(0)
  })
})

describe('projection', () => {
  it('etale l’enveloppe de vie et honore les echeances', () => {
    const s = base()
    setOpening(s, 3000)
    s.settings.safetyBuffer = 0
    s.obligations = [obligation({ amount: 600, dueDate: addDays(REF, 5), recurrence: 'none' })]
    const r = project(s, 30, REF)
    expect(r.points).toHaveLength(31)
    expect(r.points[0].cash).toBe(3000)
    expect(r.totalObligations).toBe(600)
    expect(r.totalLiving).toBeGreaterThan(0)
    expect(r.endCash).toBeLessThan(3000)
  })

  it('detecte le premier jour de tresorerie negative', () => {
    const s = base()
    setOpening(s, 200)
    s.obligations = [obligation({ amount: 500, dueDate: addDays(REF, 3) })]
    const r = project(s, 30, REF)
    expect(r.firstNegative).toBeDefined()
    expect(r.lowest.cash).toBeLessThan(0)
  })

  it('amortit les dettes jusqu’a zero sans passer en negatif', () => {
    const s = base()
    setOpening(s, 50000)
    s.debts = [debt({ remainingAmount: 300, monthlyPayment: 100, dueDay: 5 })]
    const r = project(s, 180, REF)
    expect(r.endDebt).toBe(0)
    expect(r.totalDebtPaid).toBe(300)
    expect(r.points.every((p) => p.debt >= 0)).toBe(true)
  })

  it('projette les revenus recurrents', () => {
    const s = base()
    setOpening(s, 1000)
    s.incomes = [income({ amount: 4000, date: addDays(SOM, 4), recurring: true })]
    const r = project(s, 90, REF)
    expect(r.totalIncome).toBe(12000) // octobre, novembre, decembre
  })

  it('projette un encaissement date en avant, absent du solde', () => {
    const s = base()
    setOpening(s, 1000)
    // Encaisse mais date dans 5 jours : ni dans le solde, ni oublie.
    s.incomes = [income({ amount: 3000, status: 'encaisse', date: addDays(REF, 5) })]
    expect(bankBalance(s, REF)).toBe(1000)
    expect(project(s, 30, REF).totalIncome).toBe(3000)
  })

  it('ne compte pas deux fois un encaissement deja dans le solde', () => {
    const s = base()
    s.incomes = [income({ amount: 3000, status: 'encaisse', date: REF })]
    expect(bankBalance(s, REF)).toBe(3000)
    expect(project(s, 30, REF).totalIncome).toBe(0)
  })

  it('ignore un revenu prevu deja passe', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, status: 'prevu', date: addDays(REF, -5) })]
    expect(project(s, 30, REF).totalIncome).toBe(0)
  })

  it('bascule l’excedent vers l’epargne en fin de mois', () => {
    const s = base()
    setOpening(s, 10000)
    s.settings.safetyBuffer = 1000
    const r = project(s, 40, REF)
    expect(r.endSavings).toBeGreaterThan(0)
    // Le balayage garde le coussin plus le cout du mois suivant : la tresorerie
    // ne doit jamais devenir le carburant de l'epargne.
    expect(r.points.every((p) => p.cash >= 0)).toBe(true)
    expect(r.firstNegative).toBeUndefined()
  })

  it('n\u2019epargne pas ce dont le mois suivant a besoin', () => {
    const s = base()
    setOpening(s, 8000)
    s.settings.safetyBuffer = 500
    // Le revenu tombe le 20 : le debut de mois doit etre finance d'avance.
    s.incomes = [income({ amount: 4000, date: addDays(SOM, 19), recurring: true })]
    s.obligations = [obligation({ amount: 2000, dueDate: addDays(SOM, 4), recurrence: 'monthly' })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 300, dueDay: 2 })]
    const r = project(s, 120, REF)
    // Sans anticipation, le balayage de fin de mois creuserait un trou le 2 et le 5.
    expect(r.firstNegative).toBeUndefined()
    expect(r.lowest.cash).toBeGreaterThanOrEqual(0)
  })

  it('signale quand meme un vrai trou de tresorerie', () => {
    const s = base()
    setOpening(s, 200)
    s.settings.safetyBuffer = 0
    s.obligations = [obligation({ amount: 3000, dueDate: addDays(REF, 10), recurrence: 'none' })]
    const r = project(s, 60, REF)
    expect(r.firstNegative).toBeDefined()
  })

  it('impute une echeance en retard au lieu de la perdre', () => {
    const s = base()
    setOpening(s, 5000)
    s.obligations = [obligation({ amount: 800, dueDate: addDays(REF, -12), recurrence: 'none' })]
    const r = project(s, 30, REF)
    expect(r.totalObligations).toBe(800)
    expect(r.events.some((e) => e.kind === 'obligation' && e.label === 'URSSAF')).toBe(true)
  })

  it('tient un horizon de 6 mois sans exploser', () => {
    const s = base()
    setOpening(s, 2000)
    s.obligations = [obligation({ amount: 625, dueDate: addDays(REF, 2), recurrence: 'monthly' })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145, dueDay: 2 })]
    const r = project(s, 180, REF)
    expect(r.points).toHaveLength(181)
    expect(r.points.every((p) => Number.isFinite(p.cash))).toBe(true)
    expect(r.endDebt).toBe(6000 - 145 * 6)
  })
})

describe('integration : un mois complet', () => {
  it('encaissement, obligations, dettes, depenses, mois suivant', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, date: addDays(SOM, 1) })]
    s.obligations = [obligation({ amount: 625, dueDate: addDays(SOM, 4), recurrence: 'monthly' })]
    s.debts = [debt({ name: 'FLOA', remainingAmount: 6000, monthlyPayment: 145, dueDay: 2 })]
    s.transactions = [
      tx({ amount: 625, kind: 'obligation', category: 'autre', date: addDays(SOM, 4) }),
      tx({ amount: 145, kind: 'dette', category: 'dette', date: addDays(SOM, 2) }),
      tx({ amount: 258, date: addDays(SOM, 8) }),
    ]
    s.obligations[0].status = 'paye'
    s.obligations[0].paidAt = addDays(SOM, 4)

    expect(bankBalance(s, REF)).toBe(5000 - 625 - 145 - 258)
    const l = livingSnapshot(s, REF)
    expect(l.spent).toBe(258)
    expect(l.remaining).toBe(742)

    const a = availability(s, REF)
    expect(a.obligationsSoon).toBe(0) // reglee
    expect(a.debtsSoon).toBe(145)
    expect(a.available).toBe(round2(a.bank - 145 - 742))

    // mois suivant : enveloppe remise a neuf, dette toujours la
    const next = addMonths(REF, 1)
    expect(livingSnapshot(s, next).spent).toBe(0)
    expect(debtTotal(s)).toBe(6000)
  })
})

describe('cascade du mois', () => {
  it('enchaine revenu -> frais fixes -> reste -> vie -> dettes -> reste reel', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, date: addDays(SOM, 1) })]
    s.obligations = [
      obligation({ name: 'Loyer', amount: 1200, category: 'logement', dueDate: SOM, recurrence: 'monthly' }),
      obligation({ name: 'Charges', amount: 300, category: 'logement', dueDate: SOM, recurrence: 'monthly' }),
      obligation({ name: 'Assurances', amount: 150, category: 'assurance', dueDate: SOM, recurrence: 'monthly' }),
      obligation({ name: 'Abonnements', amount: 100, category: 'abonnement', dueDate: SOM, recurrence: 'monthly' }),
      obligation({ name: 'URSSAF', amount: 625, category: 'urssaf', dueDate: addDays(SOM, 4), recurrence: 'monthly' }),
    ]
    const c = monthlyCascade(s, REF)
    expect(c.income).toBe(5000)
    expect(c.fixedTotal).toBe(2375)
    expect(c.afterFixed).toBe(2625)
    expect(c.living).toBe(1000)
    expect(c.afterLiving).toBe(1625)
    expect(c.real).toBe(1625)
    // le logement est regroupe : 1200 + 300
    expect(c.fixedByCategory[0]).toEqual({ key: 'logement', label: 'logement', amount: 1500 })
  })

  it('retranche les mensualites de dettes du reste reel', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, date: addDays(SOM, 1) })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145 }), debt({ remainingAmount: 50, monthlyPayment: 200 })]
    const c = monthlyCascade(s, REF)
    expect(c.debts).toBe(195) // la seconde est plafonnee a son restant du
    expect(c.real).toBe(5000 - 1000 - 195)
  })

  it('compte une obligation deja reglee ce mois-ci', () => {
    const s = base()
    s.obligations = [obligation({ amount: 625, dueDate: SOM, status: 'paye', paidAt: SOM, recurrence: 'monthly' })]
    // reglee le 1er, la suivante tombe en octobre : le mois a bien coute 625
    expect(monthlyCascade(s, REF).fixedTotal).toBe(625)
  })

  it('distingue encaisse et encore attendu', () => {
    const s = base()
    s.incomes = [
      income({ amount: 2000, date: addDays(SOM, 1) }),
      income({ amount: 3000, date: addDays(REF, 5), status: 'facture' }),
    ]
    const c = monthlyCascade(s, REF)
    expect(c.incomeCashed).toBe(2000)
    expect(c.incomeExpected).toBe(3000)
    expect(c.income).toBe(5000)
  })

  it('reste lisible sur un mois sans revenu', () => {
    const c = monthlyCascade(base(), REF)
    expect(c.income).toBe(0)
    expect(c.real).toBe(-1000)
  })

  it('applique la meme cascade a un encaissement precis', () => {
    const s = base()
    s.obligations = [obligation({ amount: 625, dueDate: addDays(REF, 5) })]
    const c = incomeCascade(s, 5000, REF)
    expect(c.fixed).toBe(625)
    expect(c.afterFixed).toBe(4375)
    expect(c.living).toBe(1000)
    expect(c.afterLiving).toBe(3375)
    expect(c.real).toBe(3375)
  })
})

/* ------------------------------------------------------------------ */
/* Provisions, epargne, budget par categorie, meteo                     */
/* ------------------------------------------------------------------ */

function provision(p: Partial<Provision>): Provision {
  return {
    id: uid(), name: 'Taxe fonciere', emoji: '\u{1F3DB}️', amount: 1200,
    dueDate: addMonths(REF, 6), recurrence: 'yearly', saved: 0, ...p,
  }
}

describe('navigation dans les mois', () => {
  it('observe chaque mois depuis le bon point', () => {
    expect(refForMonth('2026-09', REF)).toBe(REF)            // mois en cours
    expect(refForMonth('2026-08', REF)).toBe('2026-08-31')   // mois clos
    expect(refForMonth('2026-11', REF)).toBe('2026-11-01')   // mois a venir
  })

  it('situe un mois par rapport a aujourd’hui', () => {
    expect(monthPosition('2026-08', REF).isPast).toBe(true)
    expect(monthPosition('2026-09', REF).isCurrent).toBe(true)
    expect(monthPosition('2026-10', REF).isFuture).toBe(true)
  })

  it('se deplace de mois en mois, y compris en changeant d’annee', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('un mois clos affiche ce qui a ete depense, pas un budget restant a vivre', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [tx({ amount: 820, date: '2026-08-12' })]
    const l = livingSnapshot(s, refForMonth('2026-08', REF))
    expect(l.spent).toBe(820)
    expect(l.remaining).toBe(180)
    expect(l.paceTarget).toBe(1000) // le mois est fini : tout etait "attendu"
  })
})

describe('provisions', () => {
  it('lisse une facture annuelle sur les mois restants', () => {
    const p = provision({ amount: 1200, dueDate: addMonths(REF, 6), saved: 0 })
    const st = provisionStatus(p, REF)
    expect(st.monthsLeft).toBe(6)
    expect(st.monthly).toBe(200)
    expect(st.missing).toBe(1200)
    expect(st.ready).toBe(false)
  })

  it('tient compte de ce qui est deja mis de cote', () => {
    const st = provisionStatus(provision({ amount: 1200, saved: 600 }), REF)
    expect(st.missing).toBe(600)
    expect(st.monthly).toBe(100)
    expect(st.covered).toBeCloseTo(0.5)
  })

  it('ne demande plus rien une fois la provision complete', () => {
    const st = provisionStatus(provision({ amount: 1200, saved: 1200 }), REF)
    expect(st.monthly).toBe(0)
    expect(st.ready).toBe(true)
    expect(st.covered).toBe(1)
  })

  it('ne divise jamais par zero mois', () => {
    const st = provisionStatus(provision({ dueDate: REF }), REF)
    expect(st.monthsLeft).toBe(1)
    expect(st.monthly).toBe(1200)
    expect(Number.isFinite(st.monthly)).toBe(true)
  })

  it('signale une echeance passee non couverte', () => {
    const st = provisionStatus(provision({ dueDate: addDays(REF, -5), saved: 100 }), REF)
    expect(st.late).toBe(true)
  })

  it('additionne l’effort mensuel de toutes les provisions', () => {
    const s = base()
    s.provisions = [
      provision({ amount: 1200, dueDate: addMonths(REF, 6) }),  // 200
      provision({ amount: 300, dueDate: addMonths(REF, 3) }),   // 100
    ]
    expect(provisionsMonthlyTotal(s, REF)).toBe(300)
    expect(provisionsSaved(s)).toBe(0)
  })

  it('entre dans la cascade, juste avant le reste reel', () => {
    const s = base()
    s.incomes = [income({ amount: 5000, date: addDays(SOM, 1) })]
    s.provisions = [provision({ amount: 1200, dueDate: addMonths(REF, 6) })]
    const c = monthlyCascade(s, REF)
    expect(c.afterDebts).toBe(4000)
    expect(c.provisions).toBe(200)
    expect(c.real).toBe(3800)
  })
})

describe('epargne', () => {
  it('mesure ce qui a ete mis de cote sur un mois', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [
      tx({ amount: 300, kind: 'epargne', category: 'epargne', date: addDays(SOM, 3) }),
      tx({ amount: 200, kind: 'epargne', category: 'epargne', date: addDays(SOM, 9) }),
      tx({ amount: 80, date: addDays(SOM, 4) }),
    ]
    expect(savedInMonth(s, '2026-09')).toBe(500)
  })

  it('calcule le taux d’epargne du mois', () => {
    const s = base()
    s.incomes = [income({ amount: 4000, date: addDays(SOM, 1) })]
    s.transactions = [tx({ amount: 800, kind: 'epargne', category: 'epargne', date: addDays(SOM, 5) })]
    expect(savingsRate(s, '2026-09')).toBeCloseTo(0.2)
  })

  it('renvoie 0 plutot qu’une division par zero sur un mois sans revenu', () => {
    expect(savingsRate(base(), '2026-09')).toBe(0)
  })

  it('moyenne le rythme sur les mois revolus', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [
      tx({ amount: 300, kind: 'epargne', category: 'epargne', date: '2026-08-10' }),
      tx({ amount: 600, kind: 'epargne', category: 'epargne', date: '2026-07-10' }),
    ]
    expect(savingsPace(s, 3, REF)).toBe(300) // (300 + 600 + 0) / 3
  })

  it('produit un historique continu, mois vides compris', () => {
    const h = savingsHistory(base(), 6, REF)
    expect(h).toHaveLength(6)
    expect(h[h.length - 1].key).toBe('2026-09')
    expect(h[0].key).toBe('2026-04')
    expect(h.every((x) => x.amount === 0)).toBe(true)
  })
})

describe('fonds de precaution', () => {
  it('compte en mois de charges, pas en euros', () => {
    const s = base()
    s.obligations = [obligation({ amount: 500, recurrence: 'monthly' })]
    s.debts = [debt({ remainingAmount: 6000, monthlyPayment: 145 })]
    s.savingsGoals[0].current = 3290
    const e = emergencyFund(s, REF)
    expect(e.monthlyNeed).toBe(1645)   // 500 + 1000 + 145
    expect(e.monthsCovered).toBeCloseTo(2)
    expect(e.targetAmount).toBe(4935)  // 3 mois
    expect(e.missing).toBe(1645)
  })

  it('integre l’effort de provision dans les charges a couvrir', () => {
    const s = base()
    s.provisions = [provision({ amount: 1200, dueDate: addMonths(REF, 6) })]
    expect(emergencyFund(s, REF).monthlyNeed).toBe(1200) // 1000 de vie + 200
  })

  it('estime le delai au rythme actuel', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.savingsGoals[0].current = 1000
    s.transactions = [tx({ amount: 900, kind: 'epargne', category: 'epargne', date: '2026-08-05' })]
    const e = emergencyFund(s, REF)
    expect(e.pace).toBe(300)
    expect(e.monthsToComplete).toBe(Math.ceil(e.missing / 300))
  })

  it('ne promet pas de delai sans rythme', () => {
    expect(emergencyFund(base(), REF).monthsToComplete).toBeNull()
  })

  it('annonce un objectif atteint', () => {
    const s = base()
    s.savingsGoals[0].current = 99999
    const e = emergencyFund(s, REF)
    expect(e.missing).toBe(0)
    expect(e.monthsToComplete).toBe(0)
    expect(e.covered).toBe(1)
  })
})

describe('repartition de l’enveloppe par categorie', () => {
  it('compare le prevu au reel', () => {
    const s = base()
    s.settings.categoryBudgets = { alimentation: 300, restaurant: 100, shopping: 200 }
    s.transactions = [
      tx({ amount: 250, category: 'alimentation' }),
      tx({ amount: 160, category: 'restaurant' }),
    ]
    const b = categoryBreakdown(s, '2026-09')
    const alim = b.rows.find((r) => r.category === 'alimentation')!
    const resto = b.rows.find((r) => r.category === 'restaurant')!
    expect(alim.delta).toBe(50)
    expect(resto.delta).toBe(-60)
    expect(b.actualTotal).toBe(410)
    expect(b.plannedTotal).toBe(600)
    expect(b.unallocated).toBe(400)
  })

  it('fait apparaitre une categorie depensee sans enveloppe prevue', () => {
    const s = base()
    s.settings.categoryBudgets = { alimentation: 300 }
    s.transactions = [tx({ amount: 90, category: 'loisirs' })]
    const row = categoryBreakdown(s, '2026-09').rows.find((r) => r.category === 'loisirs')!
    expect(row.planned).toBe(0)
    expect(row.actual).toBe(90)
    expect(row.delta).toBe(-90)
  })

  it('ne compte que l’enveloppe de vie', () => {
    const s = base()
    s.transactions = [
      tx({ amount: 100, category: 'alimentation' }),
      tx({ amount: 700, kind: 'obligation', category: 'logement' }),
    ]
    expect(categoryBreakdown(s, '2026-09').actualTotal).toBe(100)
  })

  it('tient un mois vide', () => {
    const b = categoryBreakdown(base(), '2026-09')
    expect(b.rows).toHaveLength(0)
    expect(b.actualTotal).toBe(0)
    expect(b.unallocated).toBe(1000)
  })
})

describe('meteo du mois', () => {
  it('voit large quand le rythme est calme', () => {
    const s = base()
    s.transactions = [tx({ amount: 100 })]
    const w = weather(s, REF)
    expect(w.level).toBe('large')
    expect(w.projectedEnd).toBeGreaterThan(0)
  })

  it('serre quand la marge projetee fond', () => {
    const s = base()
    s.transactions = [tx({ amount: 470 })] // 470 au 15 -> ~940 projetes
    expect(weather(s, REF).level).toBe('serre')
  })

  it('tendu quand le rythme fait exploser le mois', () => {
    const s = base()
    s.transactions = [tx({ amount: 700 })] // ~1400 projetes
    const w = weather(s, REF)
    expect(w.level).toBe('tendu')
    expect(w.projectedEnd).toBeLessThan(0)
  })

  it('depasse quand c’est deja fait', () => {
    const s = base()
    s.transactions = [tx({ amount: 1200 })]
    expect(weather(s, REF).level).toBe('depasse')
  })
})

describe('faits marquants', () => {
  it('ne renvoie jamais plus de trois cartes', () => {
    const s = base()
    setOpening(s, -100)
    s.obligations = [obligation({ dueDate: addDays(REF, -3) }), obligation({ dueDate: addDays(REF, 2) })]
    s.settings.categoryBudgets = { shopping: 50 }
    s.transactions = [tx({ amount: 400, category: 'shopping' })]
    s.provisions = [provision({ dueDate: addDays(REF, -2), saved: 10 })]
    const list = insights(s, REF)
    expect(list.length).toBeLessThanOrEqual(3)
    expect(list.length).toBeGreaterThan(0)
  })

  it('met le retard en premier', () => {
    const s = base()
    s.obligations = [obligation({ dueDate: addDays(REF, -4) })]
    expect(insights(s, REF)[0].tone).toBe('critical')
  })

  it('felicite un rythme tenu', () => {
    const s = base()
    s.transactions = [tx({ amount: 100 })]
    expect(insights(s, REF).some((i) => i.tone === 'good')).toBe(true)
  })

  it('reste lisible sur un cockpit vide', () => {
    const list = insights(base(), REF)
    expect(list.every((i) => i.title.length > 0 && i.detail.length > 0)).toBe(true)
  })
})

describe('formulation des echeances', () => {
  it('compte en jours a court terme', () => {
    expect(relativeDue(addDays(REF, 3), REF)).toBe('dans 3 jours')
    expect(relativeDue(REF, REF)).toBe('aujourd’hui')
    expect(relativeDue(addDays(REF, 1), REF)).toBe('demain')
  })

  it('bascule en mois au-dela de deux mois', () => {
    expect(relativeDue(addDays(REF, 153), REF)).toBe('dans 5 mois')
    expect(relativeDue(addDays(REF, 90), REF)).toBe('dans 3 mois')
  })

  it('exprime les annees rondes', () => {
    expect(relativeDue(addDays(REF, 365), REF)).toBe('dans 1 an')
  })

  it('reste explicite sur un retard', () => {
    expect(relativeDue(addDays(REF, -5), REF)).toBe('en retard de 5 jours')
    expect(relativeDue(addDays(REF, -120), REF)).toBe('en retard de 4 mois')
  })
})

describe('lecture d’un mois clos ou a venir', () => {
  const AOUT = refForMonth('2026-08', REF)

  function withAugust(): AppState {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [tx({ amount: 640, date: '2026-08-12' })]
    return s
  }

  it('raconte un mois termine au lieu de le projeter', () => {
    const w = weather(withAugust(), AOUT, REF)
    expect(w.title).toBe('Mois termine')
    expect(w.projectedEnd).toBe(360) // ce qui restait vraiment
  })

  it('signale un mois termine en depassement', () => {
    const s = base()
    setOpening(s, s.accounts[0].openingBalance, '2026-01-01')
    s.transactions = [tx({ amount: 1300, date: '2026-08-12' })]
    const w = weather(s, AOUT, REF)
    expect(w.level).toBe('depasse')
    expect(w.title).toContain('depassement')
  })

  it('ne parle jamais de jours restants sur un mois clos', () => {
    const list = insights(withAugust(), AOUT, REF)
    expect(list.some((i) => i.id === 'closed')).toBe(true)
    expect(list.some((i) => /jours restants/.test(i.detail))).toBe(false)
    expect(list.some((i) => i.id === 'end')).toBe(false)
  })

  it('n’annonce pas d’echeances a 7 jours sur un mois passe', () => {
    const s = withAugust()
    s.obligations = [obligation({ dueDate: addDays(REF, 3) })]
    expect(insights(s, AOUT, REF).some((i) => i.id === 'soon')).toBe(false)
  })

  it('presente un mois a venir comme entier', () => {
    const w = weather(base(), refForMonth('2026-11', REF), REF)
    expect(w.title).toBe('Mois a venir')
    expect(w.projectedEnd).toBe(1000)
    expect(w.pace).toBe(0)
    expect(insights(base(), refForMonth('2026-11', REF), REF).some((i) => i.id === 'future')).toBe(true)
  })

  it('garde le comportement normal sur le mois en cours', () => {
    const s = base()
    s.transactions = [tx({ amount: 100 })]
    expect(weather(s, REF, REF).title).toBe('Tu as de la marge')
    expect(insights(s, REF, REF).some((i) => i.id === 'end')).toBe(true)
  })
})

describe('echeances administratives', () => {
  function deadline(p: Partial<Deadline>): Deadline {
    return {
      id: uid(), title: 'Activer le VFL', dueDate: addDays(REF, 10),
      priority: 'urgente', done: false, ...p,
    }
  }

  it('classe par date avant priorite', () => {
    const s = base()
    s.deadlines = [
      deadline({ title: 'Lointaine urgente', dueDate: addMonths(REF, 6), priority: 'urgente' }),
      deadline({ title: 'Proche a prevoir', dueDate: addDays(REF, 2), priority: 'a_prevoir' }),
    ]
    expect(openDeadlines(s)[0].title).toBe('Proche a prevoir')
  })

  it('departage deux memes dates par la priorite', () => {
    const s = base()
    const d = addDays(REF, 5)
    s.deadlines = [
      deadline({ title: 'B', dueDate: d, priority: 'a_prevoir' }),
      deadline({ title: 'A', dueDate: d, priority: 'urgente' }),
    ]
    expect(openDeadlines(s).map((x) => x.title)).toEqual(['A', 'B'])
  })

  it('sort les echeances faites de la liste', () => {
    const s = base()
    s.deadlines = [deadline({ done: true }), deadline({ title: 'Reste' })]
    expect(openDeadlines(s)).toHaveLength(1)
    expect(openDeadlines(s)[0].title).toBe('Reste')
  })

  it('repere le retard et l’imminence', () => {
    const s = base()
    s.deadlines = [
      deadline({ title: 'Passee', dueDate: addDays(REF, -3) }),
      deadline({ title: 'Bientot', dueDate: addDays(REF, 6) }),
      deadline({ title: 'Plus tard', dueDate: addMonths(REF, 4) }),
    ]
    expect(overdueDeadlines(s, REF).map((d) => d.title)).toEqual(['Passee'])
    expect(deadlinesDueWithin(s, 14, REF).map((d) => d.title)).toEqual(['Bientot'])
  })

  it('ramene les impacts a l’annee pour les comparer', () => {
    expect(yearlyImpact(deadline({ impact: 4000, impactPeriod: 'an' }))).toBe(4000)
    expect(yearlyImpact(deadline({ impact: -560, impactPeriod: 'mois' }))).toBe(-6720)
    expect(yearlyImpact(deadline({ impact: 1400, impactPeriod: 'unique' }))).toBe(1400)
    expect(yearlyImpact(deadline({}))).toBe(0)
  })

  it('totalise ce qui se joue, gains et couts separes', () => {
    const s = base()
    s.deadlines = [
      deadline({ impact: 4000, impactPeriod: 'an' }),
      deadline({ impact: -560, impactPeriod: 'mois' }),
      deadline({ impact: 1400, impactPeriod: 'unique', done: true }),
    ]
    const st = deadlineStakes(s)
    expect(st.open).toBe(2)
    expect(st.gains).toBe(4000)
    expect(st.costs).toBe(-6720)
    expect(st.net).toBe(-2720)
  })

  it('reste neutre sans aucune echeance', () => {
    expect(deadlineStakes(base())).toEqual({ open: 0, gains: 0, costs: 0, net: 0 })
  })
})

describe('echeance remontee au tableau de bord', () => {
  function dl(p: Partial<Deadline>): Deadline {
    return { id: uid(), title: 'Activer le VFL', dueDate: addDays(REF, 5), priority: 'urgente', done: false, ...p }
  }

  it('signale une echeance imminente avec son enjeu', () => {
    const s = base()
    s.deadlines = [dl({ impact: 4000, impactPeriod: 'an' })]
    const card = insights(s, REF, REF).find((i) => i.id.startsWith('deadline-'))
    expect(card).toBeDefined()
    expect(card!.title).toContain('dans 5 jours')
    expect(card!.detail).toContain('Gain')
  })

  it('passe au rouge quand la date est depassee', () => {
    const s = base()
    s.deadlines = [dl({ dueDate: addDays(REF, -2) })]
    expect(insights(s, REF, REF).find((i) => i.id.startsWith('deadline-'))!.tone).toBe('critical')
  })

  it('ignore une echeance lointaine ou deja faite', () => {
    const s = base()
    s.deadlines = [dl({ dueDate: addMonths(REF, 5) }), dl({ done: true })]
    expect(insights(s, REF, REF).some((i) => i.id.startsWith('deadline-'))).toBe(false)
  })

  it('ne pollue pas la lecture d’un mois clos', () => {
    const s = base()
    s.deadlines = [dl({})]
    expect(insights(s, refForMonth('2026-08', REF), REF).some((i) => i.id.startsWith('deadline-'))).toBe(false)
  })
})

describe('plusieurs comptes bancaires', () => {
  function twoAccounts(): AppState {
    const s = base()
    s.accounts = [
      { id: 'cm', name: 'Credit Mutuel', emoji: '\u{1F3E6}', openingBalance: 2000,
        openingBalanceDate: SOM, overdraftLimit: 0, shared: false, primary: true },
      { id: 'ca', name: 'Credit Agricole', emoji: '\u{1F4B3}', openingBalance: -500,
        openingBalanceDate: SOM, overdraftLimit: 300, shared: false },
    ]
    return s
  }

  it('calcule chaque solde separement', () => {
    const s = twoAccounts()
    s.transactions = [
      tx({ amount: 100, accountId: 'cm' }),
      tx({ amount: 40, accountId: 'ca' }),
    ]
    expect(accountBalance(s, 'cm', REF)).toBe(1900)
    expect(accountBalance(s, 'ca', REF)).toBe(-540)
  })

  it('additionne les comptes personnels dans le solde total', () => {
    expect(bankBalance(twoAccounts(), REF)).toBe(1500)
  })

  it('voit le compte dans le rouge meme quand le total est positif', () => {
    const s = twoAccounts()
    expect(bankBalance(s, REF)).toBeGreaterThan(0)
    const trouble = accountsInTrouble(s, REF)
    expect(trouble).toHaveLength(1)
    expect(trouble[0].account.name).toBe('Credit Agricole')
    expect(trouble[0].breached).toBe(true) // -500 sous un decouvert autorise de 300
  })

  it('distingue un decouvert autorise d’un incident', () => {
    const s = twoAccounts()
    s.accounts[1].openingBalance = -200
    const ca = accountBalances(s, REF).find((a) => a.account.id === 'ca')!
    expect(ca.negative).toBe(true)
    expect(ca.breached).toBe(false)
  })

  it('declenche le mode stabilisation sur un compte seul dans le rouge', () => {
    const s = twoAccounts()
    const c = crisisState(s, REF)
    expect(c.auto).toBe(true)
    expect(c.reasons.some((r) => r.includes('Credit Agricole'))).toBe(true)
  })

  it('exclut un compte joint du solde personnel', () => {
    const s = twoAccounts()
    s.accounts.push({
      id: 'commun', name: 'Compte commun', emoji: '\u{1F465}', openingBalance: 900,
      openingBalanceDate: SOM, overdraftLimit: 0, shared: true,
    })
    expect(bankBalance(s, REF)).toBe(1500) // le joint n'entre pas
    expect(accountBalance(s, 'commun', REF)).toBe(900)
  })

  it('rattache au compte principal un mouvement sans compte', () => {
    const s = twoAccounts()
    s.transactions = [tx({ amount: 250 })] // pas d'accountId
    expect(accountBalance(s, 'cm', REF)).toBe(1750)
    expect(accountBalance(s, 'ca', REF)).toBe(-500)
  })

  it('respecte la date d’ouverture propre a chaque compte', () => {
    const s = twoAccounts()
    s.accounts[1].openingBalanceDate = REF
    s.transactions = [tx({ amount: 60, accountId: 'ca', date: addDays(REF, -5) })]
    expect(accountBalance(s, 'ca', REF)).toBe(-500) // anterieur a l'ouverture
  })

  it('cree le revenu sur le bon compte', () => {
    const s = twoAccounts()
    s.incomes = [income({ amount: 4000, accountId: 'ca' })]
    expect(accountBalance(s, 'ca', REF)).toBe(3500)
    expect(bankBalance(s, REF)).toBe(5500)
  })

  it('reste compatible avec un cockpit a un seul compte', () => {
    const s = base()
    setOpening(s, 1200)
    s.transactions = [tx({ amount: 200 })]
    expect(bankBalance(s, REF)).toBe(1000)
    expect(accountsInTrouble(s, REF)).toHaveLength(0)
  })
})
