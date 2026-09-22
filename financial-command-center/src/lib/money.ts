/** Arrondi comptable au centime (evite 0.1 + 0.2 = 0.30000000000000004). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

const fmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtCompact = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function euro(n: number): string {
  return fmt.format(round2(n || 0))
}

/** Montant sans centimes, pour les grands chiffres du cockpit. */
export function euroShort(n: number): string {
  return fmtCompact.format(Math.round(n || 0))
}

export function percent(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits).replace('.', ',')} %`
}

/** Accepte "12,50", "12.50", "1 234,5 EUR". Renvoie NaN si illisible. */
export function parseAmount(raw: string): number {
  if (raw == null) return NaN
  const cleaned = String(raw)
    .replace(/\s| | /g, '')
    .replace(/[^\d,.\-]/g, '')
    .replace(',', '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN
  const n = Number(cleaned)
  return Number.isFinite(n) ? round2(n) : NaN
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Ratio borne a [0, 1], sur pour un denominateur nul. */
export function ratio(part: number, whole: number): number {
  if (!whole || whole <= 0) return part > 0 ? 1 : 0
  return clamp(part / whole, 0, 1)
}
