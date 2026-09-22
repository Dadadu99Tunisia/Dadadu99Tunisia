import type { AppState } from '../types'
import { addDays, addMonths, startOfMonth, today } from './dates'
import { defaultGoals, uid, SCHEMA_VERSION } from './storage'

/**
 * Jeu de donnees de demonstration, volontairement anonyme.
 * Il sert a decouvrir le cockpit sans saisir quoi que ce soit.
 * Aucune donnee personnelle n'est versionnee dans ce depot.
 */
export function demoState(): AppState {
  const t = today()
  const som = startOfMonth(t)
  const goals = defaultGoals()
  goals[0].current = 450
  goals[2].current = 120

  return {
    version: SCHEMA_VERSION,
    settings: {
      livingBudget: 1000,
      openingBalance: 2600,
      openingBalanceDate: som,
      klarnaAlertEnabled: true,
      crisisMode: 'auto',
      expectedMonthlyIncome: 4000,
      safetyBuffer: 1000,
      ownerName: 'Demo',
      emergencyMonths: 3,
      categoryBudgets: {
        alimentation: 320,
        restaurant: 120,
        shopping: 200,
        transport: 110,
        loisirs: 100,
        sante: 50,
        autre: 100,
      },
    },
    incomes: [
      {
        id: uid(), date: addDays(som, 4), client: 'Client principal', amount: 4000,
        type: 'mission', status: 'encaisse', recurring: true, note: 'Mission recurrente',
      },
      {
        id: uid(), date: addMonths(t, 1), client: 'Nouveau client', amount: 2500,
        type: 'mission', status: 'facture',
      },
    ],
    obligations: [
      { id: uid(), name: 'URSSAF', amount: 625, dueDate: addDays(t, 8), category: 'urssaf', status: 'a_payer', recurrence: 'monthly' },
      { id: uid(), name: 'Loyer', amount: 700, dueDate: som, category: 'logement', status: 'paye', recurrence: 'monthly', paidAt: som },
      { id: uid(), name: 'Assurance habitation', amount: 15, dueDate: som, category: 'assurance', status: 'paye', recurrence: 'monthly', paidAt: som },
      { id: uid(), name: 'Abonnements pro', amount: 98, dueDate: addDays(t, 3), category: 'pro', status: 'a_payer', recurrence: 'monthly' },
    ],
    debts: [
      {
        id: uid(), name: 'Paiement fractionne — boutique', initialAmount: 240, remainingAmount: 80,
        monthlyPayment: 80, dueDay: 15, priority: 'haute', kind: 'klarna', status: 'active',
        installmentsTotal: 3, installmentsPaid: 2,
      },
      {
        id: uid(), name: 'Credit conso', initialAmount: 3000, remainingAmount: 1850,
        monthlyPayment: 145, dueDay: 2, priority: 'moyenne', kind: 'credit', status: 'active', rate: 0.1572,
      },
    ],
    transactions: [
      { id: uid(), date: addDays(som, 1), description: 'Courses', category: 'alimentation', amount: 82.4, kind: 'vie' },
      { id: uid(), date: addDays(som, 3), description: 'Restaurant', category: 'restaurant', amount: 34, kind: 'vie' },
      { id: uid(), date: addDays(som, 6), description: 'Sneakers', category: 'shopping', amount: 129, kind: 'vie', split: true },
      { id: uid(), date: addDays(som, 9), description: 'Transport', category: 'transport', amount: 90.8, kind: 'vie' },
      { id: uid(), date: addDays(som, 11), description: 'Cinema', category: 'loisirs', amount: 22, kind: 'vie' },
    ],
    savingsGoals: goals,
    deadlines: [
      {
        id: uid(), title: 'Declarer le chiffre d\u2019affaires', dueDate: addDays(t, 9),
        priority: 'urgente', done: false,
        detail: 'Declaration mensuelle sur le portail de l\u2019URSSAF.',
      },
      {
        id: uid(), title: 'Revoir le contrat d\u2019assurance', dueDate: addMonths(t, 2),
        priority: 'importante', impact: 18, impactPeriod: 'mois', done: false,
        detail: 'Comparer avant la reconduction tacite.',
      },
    ],

    provisions: [
      {
        id: uid(), name: 'Taxe fonciere', emoji: '\u{1F3DB}\uFE0F', amount: 1100,
        dueDate: addMonths(t, 1), recurrence: 'yearly', saved: 340,
      },
      {
        id: uid(), name: 'Assurance annuelle', emoji: '\u{1F6E1}\uFE0F', amount: 480,
        dueDate: addMonths(t, 5), recurrence: 'yearly', saved: 80,
      },
    ],
  }
}
