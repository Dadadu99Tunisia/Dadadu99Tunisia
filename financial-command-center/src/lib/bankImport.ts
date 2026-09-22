/**
 * Import de releves bancaires.
 *
 * Les banques francaises exportent tout et n'importe quoi : CSV en
 * point-virgule encode en Windows-1252, colonnes Debit/Credit separees,
 * lignes de preambule avant l'en-tete, dates en JJ/MM/AAAA. Ce module
 * encaisse ces variantes et rend une liste de mouvements exploitables.
 *
 * Tout est pur : aucune dependance au DOM, donc entierement testable.
 */

import type { ISODate, TxCategory, TxKind } from '../types'
import { round2 } from './money'

/* ------------------------------------------------------------------ */
/* Decodage                                                             */
/* ------------------------------------------------------------------ */

/** Decode en UTF-8, et retombe sur Windows-1252 si le resultat est casse. */
export function decodeBuffer(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf)
  // U+FFFD = octet non decodable : signature d'un fichier latin-1.
  const broken = (utf8.match(/�/g) || []).length
  if (broken === 0) return utf8
  try {
    return new TextDecoder('windows-1252').decode(buf)
  } catch {
    return utf8
  }
}

/* ------------------------------------------------------------------ */
/* CSV                                                                  */
/* ------------------------------------------------------------------ */

const DELIMITERS = [';', '\t', ',', '|']

/** Le separateur le plus regulier d'une ligne a l'autre gagne. */
export function sniffDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 20)
  if (lines.length === 0) return ';'
  let best = ';'
  let bestScore = -1
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => splitLine(l, d).length)
    const max = Math.max(...counts)
    if (max < 2) continue
    // On recompense les lignes nombreuses ET un decoupage stable.
    const modal = counts.filter((c) => c === max).length
    const score = max * 10 + modal
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

/** Decoupe une ligne en respectant les guillemets (RFC 4180). */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += c
    } else if (c === '"') {
      quoted = true
    } else if (c === delimiter) {
      out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  out.push(cur.trim())
  return out
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => splitLine(l, delimiter))
}

/* ------------------------------------------------------------------ */
/* Dates et montants                                                    */
/* ------------------------------------------------------------------ */

/** JJ/MM/AAAA, JJ-MM-AA, AAAA-MM-JJ, JJ.MM.AAAA. */
export function parseBankDate(raw: string): ISODate | null {
  const s = (raw || '').trim()
  if (!s) return null

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    let year = Number(m[3])
    // Un releve sur deux chiffres reste dans notre siecle.
    if (year < 100) year += year > 70 ? 1900 : 2000
    return iso(year, Number(m[2]), Number(m[1]))
  }
  // Format OFX compact : AAAAMMJJ, eventuellement suivi de l'heure.
  m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}

function iso(y: number, mo: number, d: number): ISODate | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  if (y < 1990 || y > 2100) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * "1 234,56", "-12,50", "1,234.56", "(45,00)" (negatif comptable), "12,50 EUR".
 * Renvoie null si ce n'est pas un montant.
 */
export function parseBankAmount(raw: string): number | null {
  let s = (raw || '').trim()
  if (!s) return null

  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }

  s = s.replace(/[\s  ]/g, '').replace(/(EUR|€|eur)/gi, '')
  if (!/[\d]/.test(s)) return null
  if (!/^[-+]?[\d.,]+$/.test(s)) return null

  if (s.startsWith('-')) { negative = true; s = s.slice(1) }
  else if (s.startsWith('+')) s = s.slice(1)

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Le dernier separateur rencontre est le separateur decimal.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // Une virgule suivie de 3 chiffres pile est un separateur de milliers.
    s = s.length - lastComma - 1 === 3 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0 && s.length - lastDot - 1 === 3) {
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return round2(negative ? -n : n)
}

/* ------------------------------------------------------------------ */
/* Detection de la structure                                            */
/* ------------------------------------------------------------------ */

export interface TableShape {
  headerIndex: number
  dateCol: number
  labelCol: number
  /** Colonne montant unique (signe), ou -1 si Debit/Credit separes. */
  amountCol: number
  debitCol: number
  creditCol: number
}

const DATE_WORDS = /date|jour|operation/i
const LABEL_WORDS = /libell|description|motif|nature|intitul|detail|reference/i
const DEBIT_WORDS = /d[ée]bit|retrait|sortie/i
const CREDIT_WORDS = /cr[ée]dit|d[ée]p[oô]t|entr[ée]e/i
const AMOUNT_WORDS = /montant|somme|valeur/i

/** Trouve la ligne d'en-tete et le role de chaque colonne. */
export function detectShape(rows: string[][]): TableShape | null {
  if (rows.length === 0) return null

  const scoreAsData = (r: string[]) => {
    const dates = r.filter((c) => parseBankDate(c)).length
    const amounts = r.filter((c) => parseBankAmount(c) !== null).length
    return dates >= 1 && amounts >= 1
  }

  // L'en-tete est la derniere ligne non exploitable avant un bloc de donnees.
  let headerIndex = -1
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const following = rows.slice(i + 1, i + 4)
    if (following.length === 0) break
    if (!scoreAsData(rows[i]) && following.some(scoreAsData)) headerIndex = i
    if (scoreAsData(rows[i])) break
  }

  const dataStart = headerIndex + 1
  const data = rows.slice(dataStart).filter((r) => r.length > 1)
  if (data.length === 0) return null

  const width = Math.max(...data.map((r) => r.length))
  const headers = headerIndex >= 0 ? rows[headerIndex] : []
  const head = (i: number) => (headers[i] || '').trim()

  const colScore = (i: number, test: (c: string) => boolean) =>
    data.filter((r) => test(r[i] ?? '')).length / data.length

  // --- Date : le nom de colonne prime, sinon le taux de parsing.
  let dateCol = -1
  let bestDate = 0
  for (let i = 0; i < width; i++) {
    const s = colScore(i, (c) => parseBankDate(c) !== null) + (DATE_WORDS.test(head(i)) ? 0.5 : 0)
    if (s > bestDate && colScore(i, (c) => parseBankDate(c) !== null) > 0.5) {
      bestDate = s
      dateCol = i
    }
  }
  if (dateCol < 0) return null

  // --- Debit / Credit separes
  let debitCol = -1
  let creditCol = -1
  for (let i = 0; i < width; i++) {
    if (i === dateCol) continue
    if (debitCol < 0 && DEBIT_WORDS.test(head(i))) debitCol = i
    else if (creditCol < 0 && CREDIT_WORDS.test(head(i))) creditCol = i
  }

  // --- Montant unique
  let amountCol = -1
  if (debitCol < 0 || creditCol < 0) {
    let best = 0
    for (let i = 0; i < width; i++) {
      if (i === dateCol) continue
      const numeric = colScore(i, (c) => parseBankAmount(c) !== null)
      if (numeric < 0.6) continue
      const s = numeric + (AMOUNT_WORDS.test(head(i)) ? 0.6 : 0)
      if (s > best) { best = s; amountCol = i }
    }
    if (amountCol >= 0) { debitCol = -1; creditCol = -1 }
  }
  if (amountCol < 0 && (debitCol < 0 || creditCol < 0)) return null

  // --- Libelle : la colonne la plus textuelle parmi celles qui restent.
  let labelCol = -1
  let bestLabel = -1
  for (let i = 0; i < width; i++) {
    if (i === dateCol || i === amountCol || i === debitCol || i === creditCol) continue
    const avgLen = data.reduce((a, r) => a + (r[i] || '').length, 0) / data.length
    const textScore = avgLen + (LABEL_WORDS.test(head(i)) ? 30 : 0)
    if (textScore > bestLabel && avgLen > 1) { bestLabel = textScore; labelCol = i }
  }

  return { headerIndex, dateCol, labelCol, amountCol, debitCol, creditCol }
}

/* ------------------------------------------------------------------ */
/* Categorisation                                                       */
/* ------------------------------------------------------------------ */

interface Rule { test: RegExp; category: TxCategory; kind: TxKind }

/**
 * Regles de reconnaissance par libelle. L'ordre compte : la premiere
 * qui matche gagne, donc on va du plus specifique au plus general.
 */
export const RULES: Rule[] = [
  { test: /urssaf|rsi\b|cotisation.?social/i, category: 'professionnel', kind: 'obligation' },
  { test: /impot|dgfip|tresor public|taxe fonciere|prelevement a la source/i, category: 'professionnel', kind: 'obligation' },
  { test: /klarna|alma|scalapay|oney|paiement.?\d ?x|3x|4x/i, category: 'dette', kind: 'dette' },
  { test: /floa|younited|cofidis|cetelem|sofinco|franfinance|credit conso|pret |passeport credit/i, category: 'dette', kind: 'dette' },
  { test: /loyer|syndic|copropriete|foncia|nexity/i, category: 'logement', kind: 'obligation' },
  { test: /edf|engie|total ?energies|eau|veolia|suez|gaz/i, category: 'logement', kind: 'obligation' },
  { test: /free|orange|sfr|bouygues|sosh|red by sfr|box/i, category: 'abonnements', kind: 'obligation' },
  { test: /assurance|maif|macif|matmut|axa|allianz|luko|maaf|mutuelle|harmonie|neat/i, category: 'sante', kind: 'obligation' },
  { test: /netflix|spotify|deezer|disney|canal|amazon prime|apple\.com|icloud|itunes|openai|chatgpt|anthropic|claude|adobe|figma|notion|github/i, category: 'abonnements', kind: 'obligation' },
  { test: /cotisation|frais bancaire|frais de tenue|commission d.intervention|agios/i, category: 'autre', kind: 'obligation' },
  { test: /virement.*epargne|livret|ldds|pel\b|pea\b/i, category: 'epargne', kind: 'epargne' },

  { test: /carrefour|leclerc|intermarche|lidl|aldi|monoprix|franprix|auchan|casino|super ?u|picard|biocoop|naturalia|grand frais/i, category: 'alimentation', kind: 'vie' },
  { test: /uber ?eats|deliveroo|just ?eat|restaurant|brasserie|boulangerie|mcdonald|burger|pizza|sushi|starbucks|cafe\b/i, category: 'restaurant', kind: 'vie' },
  { test: /sncf|ratp|navigo|uber\b|bolt|blablacar|total ?access|essence|station|parking|velib|trainline/i, category: 'transport', kind: 'vie' },
  { test: /zalando|h&m|zara|asos|shein|vinted|sephora|nocibe|decathlon|adidas|nike|uniqlo|mango|galeries lafayette|amazon(?!.*prime)/i, category: 'shopping', kind: 'vie' },
  { test: /pharmacie|docteur|medecin|dentiste|laboratoire|opticien|psycholog|psychiatre|cpam|kine/i, category: 'sante', kind: 'vie' },
  { test: /cinema|ugc|pathe|fnac|spectacle|concert|theatre|musee|salle de sport|basic fit|fitness|piscine/i, category: 'loisirs', kind: 'vie' },
]

export function categorise(label: string): { category: TxCategory; kind: TxKind } {
  for (const r of RULES) if (r.test.test(label)) return { category: r.category, kind: r.kind }
  return { category: 'autre', kind: 'vie' }
}

/* ------------------------------------------------------------------ */
/* Lignes importees                                                     */
/* ------------------------------------------------------------------ */

export interface ImportedRow {
  /** Empreinte stable : sert a ne jamais importer deux fois la meme ligne. */
  key: string
  date: ISODate
  label: string
  /** Negatif = sortie, positif = entree. */
  amount: number
  category: TxCategory
  kind: TxKind
  include: boolean
  duplicate: boolean
}

/** Normalise un libelle pour la comparaison : casse, accents, espaces, dates. */
export function normaliseLabel(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\d{2}[/.]\d{2}([/.]\d{2,4})?/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

export function rowKey(date: ISODate, amount: number, label: string): string {
  return `${date}|${amount.toFixed(2)}|${normaliseLabel(label).slice(0, 40)}`
}

/** Construit les mouvements a partir d'un tableau et de sa structure. */
export function buildRows(rows: string[][], shape: TableShape): ImportedRow[] {
  const out: ImportedRow[] = []
  for (const r of rows.slice(shape.headerIndex + 1)) {
    const date = parseBankDate(r[shape.dateCol] ?? '')
    if (!date) continue

    let amount: number | null = null
    if (shape.amountCol >= 0) {
      amount = parseBankAmount(r[shape.amountCol] ?? '')
    } else {
      const debit = parseBankAmount(r[shape.debitCol] ?? '')
      const credit = parseBankAmount(r[shape.creditCol] ?? '')
      if (debit !== null && debit !== 0) amount = -Math.abs(debit)
      else if (credit !== null && credit !== 0) amount = Math.abs(credit)
    }
    if (amount === null || amount === 0) continue

    const label = (shape.labelCol >= 0 ? r[shape.labelCol] : '')?.trim() || 'Mouvement bancaire'
    const { category, kind } = amount < 0 ? categorise(label) : { category: 'autre' as TxCategory, kind: 'vie' as TxKind }

    out.push({
      key: rowKey(date, amount, label),
      date,
      label,
      amount,
      category,
      kind,
      include: true,
      duplicate: false,
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* OFX et QIF                                                           */
/* ------------------------------------------------------------------ */

/** OFX : format bancaire balise, nettement plus fiable qu'un CSV. */
export function parseOFX(text: string): ImportedRow[] {
  const out: ImportedRow[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  for (const b of blocks) {
    const tag = (name: string) => {
      const m = b.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const date = parseBankDate(tag('DTPOSTED'))
    const amount = parseBankAmount(tag('TRNAMT'))
    if (!date || amount === null || amount === 0) continue
    const label = tag('NAME') || tag('MEMO') || 'Mouvement bancaire'
    const { category, kind } = amount < 0 ? categorise(label) : { category: 'autre' as TxCategory, kind: 'vie' as TxKind }
    out.push({ key: rowKey(date, amount, label), date, label, amount, category, kind, include: true, duplicate: false })
  }
  return out
}

/** QIF : une ligne par champ, les mouvements separes par '^'. */
export function parseQIF(text: string): ImportedRow[] {
  const out: ImportedRow[] = []
  let date: ISODate | null = null
  let amount: number | null = null
  let label = ''
  const flush = () => {
    if (date && amount !== null && amount !== 0) {
      const l = label || 'Mouvement bancaire'
      const { category, kind } = amount < 0 ? categorise(l) : { category: 'autre' as TxCategory, kind: 'vie' as TxKind }
      out.push({ key: rowKey(date, amount, l), date, label: l, amount, category, kind, include: true, duplicate: false })
    }
    date = null; amount = null; label = ''
  }
  for (const line of text.split(/\r?\n/)) {
    const code = line[0]
    const value = line.slice(1).trim()
    if (code === '^') flush()
    else if (code === 'D') date = parseBankDate(value.replace(/'/g, '/'))
    else if (code === 'T' || code === 'U') amount = parseBankAmount(value)
    else if (code === 'P' || code === 'M') label = label || value
  }
  flush()
  return out
}

/* ------------------------------------------------------------------ */
/* Point d'entree                                                       */
/* ------------------------------------------------------------------ */

export interface ParseResult {
  rows: ImportedRow[]
  format: 'csv' | 'ofx' | 'qif'
  error?: string
}

export function parseStatement(text: string, filename = ''): ParseResult {
  const lower = filename.toLowerCase()

  if (/<STMTTRN>/i.test(text) || lower.endsWith('.ofx') || lower.endsWith('.qfx')) {
    const rows = parseOFX(text)
    return rows.length
      ? { rows, format: 'ofx' }
      : { rows: [], format: 'ofx', error: 'Fichier OFX reconnu, mais aucun mouvement lisible.' }
  }

  if (lower.endsWith('.qif') || /^!Type:/im.test(text)) {
    const rows = parseQIF(text)
    return rows.length
      ? { rows, format: 'qif' }
      : { rows: [], format: 'qif', error: 'Fichier QIF reconnu, mais aucun mouvement lisible.' }
  }

  const delimiter = sniffDelimiter(text)
  const table = parseDelimited(text, delimiter)
  const shape = detectShape(table)
  if (!shape) {
    return {
      rows: [], format: 'csv',
      error: 'Impossible de reperer les colonnes date et montant. Verifie que le fichier est bien un export de compte.',
    }
  }
  const rows = buildRows(table, shape)
  return rows.length
    ? { rows, format: 'csv' }
    : { rows: [], format: 'csv', error: 'Aucun mouvement lisible dans ce fichier.' }
}

/** Marque les lignes deja presentes dans le cockpit. */
export function markDuplicates(rows: ImportedRow[], existingKeys: Set<string>): ImportedRow[] {
  const seen = new Set<string>()
  return rows.map((r) => {
    // Un meme libelle deux fois le meme jour arrive : on suffixe l'empreinte.
    let key = r.key
    let n = 1
    while (seen.has(key)) key = `${r.key}#${++n}`
    seen.add(key)
    const duplicate = existingKeys.has(key)
    return { ...r, key, duplicate, include: !duplicate }
  })
}
