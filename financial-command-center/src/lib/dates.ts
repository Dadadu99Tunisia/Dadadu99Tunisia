import type { ISODate } from '../types'

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse une ISODate en Date locale a minuit (evite les decalages UTC). */
export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function today(): ISODate {
  return toISO(new Date())
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7)
}

export function currentMonthKey(ref: ISODate = today()): string {
  return monthKey(ref)
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/** Nombre de jours restants dans le mois, aujourd'hui inclus (min 1). */
export function daysLeftInMonth(ref: ISODate = today()): number {
  const d = fromISO(ref)
  const total = daysInMonth(d.getFullYear(), d.getMonth())
  return Math.max(1, total - d.getDate() + 1)
}

export function dayOfMonth(ref: ISODate = today()): number {
  return fromISO(ref).getDate()
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Ajoute n mois en bornant le jour au dernier jour du mois cible. */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return toISO(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  const ms = fromISO(a).getTime() - fromISO(b).getTime()
  return Math.round(ms / 86400000)
}

export function isBefore(a: ISODate, b: ISODate): boolean {
  return a < b
}

export function startOfMonth(ref: ISODate = today()): ISODate {
  return `${monthKey(ref)}-01`
}

export function endOfMonth(ref: ISODate = today()): ISODate {
  const d = fromISO(ref)
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function previousMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })
const fullFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

export function shortDate(s: ISODate): string {
  return dayFmt.format(fromISO(s))
}

export function longDate(s: ISODate): string {
  return fullFmt.format(fromISO(s))
}

/** "dans 3 jours", "aujourd'hui", "en retard de 5 jours". */
export function relativeDue(due: ISODate, ref: ISODate = today()): string {
  const n = diffDays(due, ref)
  if (n === 0) return "aujourd’hui"
  if (n === 1) return 'demain'
  if (n === -1) return 'hier'
  if (n > 1) {
    if (n < 60) return `dans ${n} jours`
    const months = Math.round(n / 30.44)
    return months >= 12 && months % 12 === 0
      ? `dans ${months / 12} an${months > 12 ? 's' : ''}`
      : `dans ${months} mois`
  }
  const late = Math.abs(n)
  return late < 60 ? `en retard de ${late} jours` : `en retard de ${Math.round(late / 30.44)} mois`
}

/** Prochaine occurrence d'un jour de prelevement, a partir de ref. */
export function nextDueForDay(day: number, ref: ISODate = today()): ISODate {
  const d = fromISO(ref)
  const target = Math.min(Math.max(day, 1), 28)
  if (d.getDate() <= target) {
    return toISO(new Date(d.getFullYear(), d.getMonth(), target))
  }
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, target))
}
