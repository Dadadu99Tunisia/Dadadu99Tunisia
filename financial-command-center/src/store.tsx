import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Account, AppState, Deadline, Debt, Income, Obligation, Provision, SavingsGoal,
  Settings, Transaction,
} from './types'
import { load, save, uid, emptyState } from './lib/storage'
import { addMonths, today } from './lib/dates'
import { round2 } from './lib/money'

type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'income/upsert'; income: Income }
  | { type: 'income/remove'; id: string }
  | { type: 'obligation/upsert'; obligation: Obligation }
  | { type: 'obligation/remove'; id: string }
  | { type: 'obligation/pay'; id: string; date: string }
  | { type: 'obligation/unpay'; id: string }
  | { type: 'debt/upsert'; debt: Debt }
  | { type: 'debt/remove'; id: string }
  | { type: 'debt/pay'; id: string; amount: number; date: string }
  | { type: 'tx/upsert'; tx: Transaction }
  | { type: 'tx/remove'; id: string }
  | { type: 'goal/upsert'; goal: SavingsGoal }
  | { type: 'goal/remove'; id: string }
  | { type: 'goal/deposit'; id: string; amount: number; date: string }
  | { type: 'import/apply'; transactions: Transaction[]; incomes: Income[] }
  | { type: 'provision/upsert'; provision: Provision }
  | { type: 'provision/remove'; id: string }
  | { type: 'provision/fund'; id: string; amount: number; date: string }
  | { type: 'provision/settle'; id: string; date: string }
  | { type: 'deadline/upsert'; deadline: Deadline }
  | { type: 'deadline/remove'; id: string }
  | { type: 'deadline/toggle'; id: string; date: string }
  | { type: 'account/upsert'; account: Account }
  | { type: 'account/remove'; id: string }
  | { type: 'account/primary'; id: string }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'replace':
      return action.state

    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'income/upsert': {
      const exists = state.incomes.some((i) => i.id === action.income.id)
      return {
        ...state,
        incomes: exists
          ? state.incomes.map((i) => (i.id === action.income.id ? action.income : i))
          : [...state.incomes, action.income],
      }
    }
    case 'income/remove':
      return { ...state, incomes: state.incomes.filter((i) => i.id !== action.id) }

    case 'obligation/upsert': {
      const exists = state.obligations.some((o) => o.id === action.obligation.id)
      return {
        ...state,
        obligations: exists
          ? state.obligations.map((o) => (o.id === action.obligation.id ? action.obligation : o))
          : [...state.obligations, action.obligation],
      }
    }
    case 'obligation/remove':
      return { ...state, obligations: state.obligations.filter((o) => o.id !== action.id) }

    case 'obligation/pay': {
      const target = state.obligations.find((o) => o.id === action.id)
      if (!target || target.status === 'paye') return state
      const paid: Obligation = { ...target, status: 'paye', paidAt: action.date }
      // Une obligation recurrente reglee reapparait a l'echeance suivante :
      // c'est ce qui rend le "a reserver" honnete d'un mois sur l'autre.
      const step =
        target.recurrence === 'monthly' ? 1
          : target.recurrence === 'quarterly' ? 3
            : target.recurrence === 'yearly' ? 12 : 0
      const next: Obligation[] = step
        ? [{ ...target, id: uid(), dueDate: addMonths(target.dueDate, step), status: 'a_payer', paidAt: undefined }]
        : []
      const tx: Transaction = {
        id: uid(), date: action.date, description: target.name, category: 'autre',
        amount: target.amount, kind: 'obligation', obligationId: target.id,
        accountId: target.accountId,
      }
      return {
        ...state,
        obligations: [...state.obligations.map((o) => (o.id === action.id ? paid : o)), ...next],
        transactions: [...state.transactions, tx],
      }
    }

    case 'obligation/unpay':
      return {
        ...state,
        obligations: state.obligations.map((o) =>
          o.id === action.id ? { ...o, status: 'a_payer', paidAt: undefined } : o,
        ),
        transactions: state.transactions.filter((t) => t.obligationId !== action.id),
      }

    case 'debt/upsert': {
      const exists = state.debts.some((d) => d.id === action.debt.id)
      const debt = {
        ...action.debt,
        status: action.debt.remainingAmount <= 0 ? ('paid' as const) : ('active' as const),
      }
      return {
        ...state,
        debts: exists ? state.debts.map((d) => (d.id === debt.id ? debt : d)) : [...state.debts, debt],
      }
    }
    case 'debt/remove':
      return { ...state, debts: state.debts.filter((d) => d.id !== action.id) }

    case 'debt/pay': {
      const target = state.debts.find((d) => d.id === action.id)
      if (!target) return state
      const pay = round2(Math.min(Math.max(0, action.amount), target.remainingAmount))
      if (pay <= 0) return state
      const left = round2(target.remainingAmount - pay)
      const updated: Debt = {
        ...target,
        remainingAmount: left,
        installmentsPaid: (target.installmentsPaid ?? 0) + 1,
        status: left <= 0 ? 'paid' : 'active',
        paidAt: left <= 0 ? action.date : target.paidAt,
      }
      const tx: Transaction = {
        id: uid(), date: action.date, description: `Remboursement ${target.name}`,
        category: 'dette', amount: pay, kind: 'dette', debtId: target.id,
        accountId: target.accountId,
      }
      return {
        ...state,
        debts: state.debts.map((d) => (d.id === action.id ? updated : d)),
        transactions: [...state.transactions, tx],
      }
    }

    case 'tx/upsert': {
      const exists = state.transactions.some((t) => t.id === action.tx.id)
      return {
        ...state,
        transactions: exists
          ? state.transactions.map((t) => (t.id === action.tx.id ? action.tx : t))
          : [...state.transactions, action.tx],
      }
    }
    case 'tx/remove':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.id) }

    case 'goal/upsert': {
      const exists = state.savingsGoals.some((g) => g.id === action.goal.id)
      return {
        ...state,
        savingsGoals: exists
          ? state.savingsGoals.map((g) => (g.id === action.goal.id ? action.goal : g))
          : [...state.savingsGoals, action.goal],
      }
    }
    case 'goal/remove':
      return { ...state, savingsGoals: state.savingsGoals.filter((g) => g.id !== action.id) }

    case 'goal/deposit': {
      const goal = state.savingsGoals.find((g) => g.id === action.id)
      if (!goal || action.amount === 0) return state
      const tx: Transaction = {
        id: uid(), date: action.date,
        description: action.amount > 0 ? `Epargne — ${goal.name}` : `Retrait epargne — ${goal.name}`,
        category: 'epargne', amount: action.amount, kind: action.amount > 0 ? 'epargne' : 'ajustement',
        savingsGoalId: goal.id,
      }
      return {
        ...state,
        savingsGoals: state.savingsGoals.map((g) =>
          g.id === action.id ? { ...g, current: round2(Math.max(0, g.current + action.amount)) } : g,
        ),
        transactions: [...state.transactions, tx],
      }
    }

    case 'provision/upsert': {
      const exists = state.provisions.some((p) => p.id === action.provision.id)
      return {
        ...state,
        provisions: exists
          ? state.provisions.map((p) => (p.id === action.provision.id ? action.provision : p))
          : [...state.provisions, action.provision],
      }
    }
    case 'provision/remove':
      return { ...state, provisions: state.provisions.filter((p) => p.id !== action.id) }

    case 'provision/fund': {
      const p = state.provisions.find((x) => x.id === action.id)
      if (!p || action.amount === 0) return state
      // Mettre de cote est un vrai virement : l'argent quitte le compte courant.
      const tx: Transaction = {
        id: uid(), date: action.date,
        description: action.amount > 0 ? `Provision \u2014 ${p.name}` : `Reprise provision \u2014 ${p.name}`,
        category: 'epargne', amount: action.amount,
        kind: action.amount > 0 ? 'epargne' : 'ajustement',
      }
      return {
        ...state,
        provisions: state.provisions.map((x) =>
          x.id === action.id ? { ...x, saved: round2(Math.max(0, x.saved + action.amount)) } : x,
        ),
        transactions: [...state.transactions, tx],
      }
    }

    case 'provision/settle': {
      const p = state.provisions.find((x) => x.id === action.id)
      if (!p) return state
      const step =
        p.recurrence === 'monthly' ? 1
          : p.recurrence === 'quarterly' ? 3
            : p.recurrence === 'yearly' ? 12 : 0
      // Le montant deja provisionne revient sur le compte pour payer la
      // facture ; seul le reste a decouvert pese vraiment sur le mois.
      const fromSavings = round2(Math.min(p.saved, p.amount))
      const settleTxs: Transaction[] = [
        {
          id: uid(), date: action.date, description: `Reprise provision \u2014 ${p.name}`,
          category: 'epargne' as const, amount: fromSavings, kind: 'ajustement' as const,
        },
        {
          id: uid(), date: action.date, description: p.name,
          category: 'autre' as const, amount: p.amount, kind: 'obligation' as const,
        },
      ]
      const txs = settleTxs.filter((t) => t.amount > 0)

      return {
        ...state,
        provisions: step
          ? state.provisions.map((x) =>
            x.id === action.id
              ? { ...x, saved: round2(Math.max(0, x.saved - fromSavings)), dueDate: addMonths(x.dueDate, step) }
              : x,
          )
          : state.provisions.filter((x) => x.id !== action.id),
        transactions: [...state.transactions, ...txs],
      }
    }

    case 'deadline/upsert': {
      const exists = state.deadlines.some((d) => d.id === action.deadline.id)
      return {
        ...state,
        deadlines: exists
          ? state.deadlines.map((d) => (d.id === action.deadline.id ? action.deadline : d))
          : [...state.deadlines, action.deadline],
      }
    }
    case 'deadline/remove':
      return { ...state, deadlines: state.deadlines.filter((d) => d.id !== action.id) }

    case 'deadline/toggle':
      return {
        ...state,
        deadlines: state.deadlines.map((d) =>
          d.id === action.id
            ? { ...d, done: !d.done, doneAt: !d.done ? action.date : undefined }
            : d,
        ),
      }

    case 'account/upsert': {
      const exists = state.accounts.some((a) => a.id === action.account.id)
      const accounts = exists
        ? state.accounts.map((a) => (a.id === action.account.id ? action.account : a))
        : [...state.accounts, action.account]
      // Le premier compte cree est forcement le principal.
      if (!accounts.some((a) => a.primary)) accounts[0].primary = true
      return { ...state, accounts }
    }

    case 'account/remove': {
      if (state.accounts.length <= 1) return state
      const removed = state.accounts.find((a) => a.id === action.id)
      if (!removed) return state
      const accounts = state.accounts.filter((a) => a.id !== action.id)
      const fallback = accounts.find((a) => a.primary) ?? accounts[0]
      fallback.primary = true
      // Les mouvements du compte supprime rejoignent le compte principal
      // plutot que de disparaitre du solde.
      return {
        ...state,
        accounts,
        transactions: state.transactions.map((t) =>
          t.accountId === action.id ? { ...t, accountId: fallback.id } : t,
        ),
        incomes: state.incomes.map((i) =>
          i.accountId === action.id ? { ...i, accountId: fallback.id } : i,
        ),
        obligations: state.obligations.map((o) =>
          o.accountId === action.id ? { ...o, accountId: undefined } : o,
        ),
        debts: state.debts.map((d) =>
          d.accountId === action.id ? { ...d, accountId: undefined } : d,
        ),
      }
    }

    case 'account/primary':
      return {
        ...state,
        accounts: state.accounts.map((a) => ({ ...a, primary: a.id === action.id })),
      }

    case 'import/apply': {
      // Les empreintes d'import garantissent qu'un releve rejoue deux fois
      // n'ajoute rien : on filtre ici aussi, ceinture et bretelles.
      const known = new Set(
        [
          ...state.transactions.map((t) => t.importKey),
          ...state.incomes.map((i) => i.importKey),
        ].filter(Boolean) as string[],
      )
      const tx = action.transactions.filter((t) => !t.importKey || !known.has(t.importKey))
      const inc = action.incomes.filter((i) => !i.importKey || !known.has(i.importKey))
      if (tx.length === 0 && inc.length === 0) return state
      return {
        ...state,
        transactions: [...state.transactions, ...tx],
        incomes: [...state.incomes, ...inc],
      }
    }

    default:
      return state
  }
}

interface Ctx {
  state: AppState
  dispatch: (a: Action) => void
  reset: () => void
  /** Non nul si la derniere ecriture a echoue (quota plein, mode prive). */
  saveError: 'quota' | 'blocked' | null
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [saveError, setSaveError] = useState<'quota' | 'blocked' | null>(null)

  useEffect(() => {
    const r = save(state)
    setSaveError(r.ok ? null : r.reason)
  }, [state])

  const value = useMemo<Ctx>(
    () => ({
      state,
      dispatch,
      saveError,
      reset: () => dispatch({ type: 'replace', state: { ...emptyState(), settings: { ...emptyState().settings, openingBalanceDate: today() } } }),
    }),
    [state, saveError],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore doit etre utilise dans StoreProvider')
  return ctx
}

export type { Action }
