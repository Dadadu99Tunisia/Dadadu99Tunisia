import type { AppState, SavingsGoal } from '../types'
import { today } from './dates'

export const SCHEMA_VERSION = 1
const KEY = 'cockpit-financier/v1'

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export function defaultGoals(): SavingsGoal[] {
  return [
    { id: uid(), name: 'Fonds de securite', emoji: '\u{1F6DF}', target: 3000, current: 0 },
    { id: uid(), name: 'Projet', emoji: '\u{1F3E0}', target: 2000, current: 0 },
    { id: uid(), name: 'Voyage', emoji: '✈️', target: 1000, current: 0 },
    { id: uid(), name: 'Epargne libre', emoji: '\u{1F4B0}', target: 0, current: 0, system: true },
  ]
}

export function emptyState(): AppState {
  return {
    version: SCHEMA_VERSION,
    settings: {
      livingBudget: 1000,
      openingBalance: 0,
      openingBalanceDate: today(),
      klarnaAlertEnabled: true,
      crisisMode: 'auto',
      expectedMonthlyIncome: 0,
      safetyBuffer: 1000,
      ownerName: '',
      emergencyMonths: 3,
      categoryBudgets: {},
    },
    incomes: [],
    obligations: [],
    debts: [],
    transactions: [],
    savingsGoals: defaultGoals(),
    provisions: [],
    deadlines: [],
  }
}

/** Complete un etat partiel (import ancien, cle manquante) sans rien perdre. */
export function normalise(raw: unknown): AppState {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<AppState>
  const state: AppState = {
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(r.settings || {}) },
    incomes: Array.isArray(r.incomes) ? r.incomes : [],
    obligations: Array.isArray(r.obligations) ? r.obligations : [],
    debts: Array.isArray(r.debts) ? r.debts : [],
    transactions: Array.isArray(r.transactions) ? r.transactions : [],
    savingsGoals:
      Array.isArray(r.savingsGoals) && r.savingsGoals.length > 0 ? r.savingsGoals : base.savingsGoals,
    provisions: Array.isArray(r.provisions) ? r.provisions : [],
    deadlines: Array.isArray(r.deadlines) ? r.deadlines : [],
  }
  // Garde-fous : des nombres restent des nombres apres un aller-retour JSON.
  for (const d of state.debts) {
    d.remainingAmount = Number(d.remainingAmount) || 0
    d.initialAmount = Number(d.initialAmount) || d.remainingAmount
    d.monthlyPayment = Number(d.monthlyPayment) || 0
    if (d.remainingAmount <= 0 && d.status !== 'paid') d.status = 'paid'
  }
  for (const o of state.obligations) o.amount = Number(o.amount) || 0
  for (const t of state.transactions) t.amount = Number(t.amount) || 0
  for (const i of state.incomes) i.amount = Number(i.amount) || 0
  for (const g of state.savingsGoals) {
    g.current = Number(g.current) || 0
    g.target = Number(g.target) || 0
  }
  for (const p of state.provisions) {
    p.amount = Number(p.amount) || 0
    p.saved = Number(p.saved) || 0
  }
  for (const d of state.deadlines) {
    d.done = !!d.done
    if (d.impact !== undefined) d.impact = Number(d.impact) || 0
  }
  if (!state.settings.categoryBudgets || typeof state.settings.categoryBudgets !== 'object') {
    state.settings.categoryBudgets = {}
  }
  if (!(state.settings.emergencyMonths > 0)) state.settings.emergencyMonths = 3
  return state
}

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return normalise(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'blocked' }

/**
 * Ecrit l'etat. En cas d'echec on ne jette pas : l'appli continue de
 * fonctionner en memoire, mais l'appelant doit prevenir l'utilisatrice,
 * sinon elle croirait ses saisies enregistrees.
 */
export function save(state: AppState): SaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return { ok: true }
  } catch (e) {
    const quota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return { ok: false, reason: quota ? 'quota' : 'blocked' }
  }
}

export function exportJSON(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

export type ExportOutcome = 'saved' | 'declined' | 'impossible'

/** Namespace minimal expose par la plateforme d'artefacts. */
interface DownloadsCapability {
  save(req: { filename: string; data: string }): Promise<{ status: string }>
}
interface ClaudeHost {
  use(name: string): Promise<DownloadsCapability | null>
}

/**
 * Propose le fichier d'export.
 *
 * Dans un navigateur ordinaire, un lien suffit. Publiee comme artefact, la
 * page n'a pas le droit de declencher un telechargement elle-meme : c'est la
 * plateforme qui le mediatise. Sans ce detour, le bouton ne ferait rien, et
 * la sauvegarde -- le seul filet de securite de donnees locales -- serait
 * silencieusement perdue.
 */
export async function downloadExport(state: AppState): Promise<ExportOutcome> {
  const filename = `cockpit-financier-${today()}.json`
  const content = exportJSON(state)

  const host = (globalThis as { claude?: ClaudeHost }).claude
  if (host && typeof host.use === 'function') {
    try {
      const downloads = await host.use('downloads')
      if (!downloads) return 'impossible'
      await downloads.save({ filename, data: content })
      return 'saved'
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      return code === 'declined' ? 'declined' : 'impossible'
    }
  }

  try {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return 'saved'
  } catch {
    return 'impossible'
  }
}

export function importJSON(text: string): AppState {
  const parsed = JSON.parse(text)
  return normalise(parsed)
}
