import { describe, it, expect } from 'vitest'
import {
  categorise, decodeBuffer, detectShape, markDuplicates, normaliseLabel,
  parseBankAmount, parseBankDate, parseDelimited, parseStatement, rowKey, sniffDelimiter,
} from './bankImport'

/* Extraits representatifs des exports reellement proposes par les banques. */

const CREDIT_MUTUEL = `Date d'operation;Date de valeur;Libelle;Debit;Credit
22/09/2026;22/09/2026;PAIEMENT CB MONOPRIX 2109;-42,30;
20/09/2026;20/09/2026;VIR RECU QWARRY SAS;;5000,00
05/09/2026;05/09/2026;PRLV URSSAF IDF;-625,00;
02/09/2026;02/09/2026;PRLV FLOA BANK;-145,00;`

const CREDIT_AGRICOLE = `Liste des operations du compte
Compte de cheques 1234567890

Date;Libelle;Montant
21/09/2026;CARTE 20/09 DELIVEROO PARIS;-24,90
15/09/2026;PRLV COFIDIS;-21,73
13/09/2026;COTISATION OFFRE ESSENTIEL;-6,00`

const BOURSO_COMMA = `"dateOp","label","amount"
"2026-09-18","NETFLIX.COM","-14.99"
"2026-09-11","AMAZON PRIME","-6.99"
"2026-09-04","VIREMENT LIVRET A","-300.00"`

const OFX_SAMPLE = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260922120000<TRNAMT>-42.30<NAME>MONOPRIX PARIS</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260920<TRNAMT>5000.00<NAME>VIR QWARRY SAS</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const QIF_SAMPLE = `!Type:Bank
D22/09/2026
T-42,30
PMONOPRIX
^
D20/09/2026
T5000,00
PVIREMENT QWARRY
^`

describe('decodage', () => {
  it('lit de l’UTF-8', () => {
    const buf = new TextEncoder().encode('Libellé;Montant').buffer
    expect(decodeBuffer(buf)).toBe('Libellé;Montant')
  })

  it('retombe sur Windows-1252 quand l’UTF-8 casse', () => {
    // 0xE9 seul = "é" en latin-1, invalide en UTF-8.
    const bytes = new Uint8Array([76, 105, 98, 101, 108, 108, 0xe9, 59, 77])
    expect(decodeBuffer(bytes.buffer)).toBe('Libellé;M')
  })
})

describe('separateur', () => {
  it('repere le point-virgule francais', () => {
    expect(sniffDelimiter(CREDIT_MUTUEL)).toBe(';')
  })
  it('repere la virgule', () => {
    expect(sniffDelimiter(BOURSO_COMMA)).toBe(',')
  })
  it('repere la tabulation', () => {
    expect(sniffDelimiter('Date\tLibelle\tMontant\n01/01/2026\tTest\t-10,00')).toBe('\t')
  })
})

describe('guillemets', () => {
  it('ne coupe pas a l’interieur des guillemets', () => {
    const rows = parseDelimited('"MONOPRIX, PARIS";-42,30', ';')
    expect(rows[0]).toEqual(['MONOPRIX, PARIS', '-42,30'])
  })
  it('gere un guillemet echappe', () => {
    expect(parseDelimited('"L""ECLERC";-10', ';')[0]).toEqual(['L"ECLERC', '-10'])
  })
})

describe('dates', () => {
  it('lit les formats courants', () => {
    expect(parseBankDate('22/09/2026')).toBe('2026-09-22')
    expect(parseBankDate('2026-09-22')).toBe('2026-09-22')
    expect(parseBankDate('22.09.2026')).toBe('2026-09-22')
    expect(parseBankDate('22/09/26')).toBe('2026-09-22')
    expect(parseBankDate('20260922120000')).toBe('2026-09-22')
  })
  it('rejette ce qui n’est pas une date', () => {
    expect(parseBankDate('MONOPRIX')).toBeNull()
    expect(parseBankDate('')).toBeNull()
    expect(parseBankDate('45/13/2026')).toBeNull()
    expect(parseBankDate('-42,30')).toBeNull()
  })
})

describe('montants', () => {
  it('lit le format francais', () => {
    expect(parseBankAmount('-42,30')).toBe(-42.3)
    expect(parseBankAmount('1 234,56')).toBe(1234.56)
    expect(parseBankAmount('5000,00')).toBe(5000)
    expect(parseBankAmount('12,50 EUR')).toBe(12.5)
  })
  it('lit le format anglo-saxon', () => {
    expect(parseBankAmount('-14.99')).toBe(-14.99)
    expect(parseBankAmount('1,234.56')).toBe(1234.56)
  })
  it('distingue milliers et decimales', () => {
    expect(parseBankAmount('1,500')).toBe(1500)   // virgule + 3 chiffres = milliers
    expect(parseBankAmount('1,50')).toBe(1.5)     // virgule + 2 chiffres = decimales
    expect(parseBankAmount('1.500')).toBe(1500)
  })
  it('lit le negatif comptable entre parentheses', () => {
    expect(parseBankAmount('(45,00)')).toBe(-45)
  })
  it('rejette le texte', () => {
    expect(parseBankAmount('MONOPRIX')).toBeNull()
    expect(parseBankAmount('')).toBeNull()
    expect(parseBankAmount('12/09/2026')).toBeNull()
  })
})

describe('structure du tableau', () => {
  it('repere Debit / Credit separes', () => {
    const shape = detectShape(parseDelimited(CREDIT_MUTUEL, ';'))!
    expect(shape.headerIndex).toBe(0)
    expect(shape.amountCol).toBe(-1)
    expect(shape.debitCol).toBe(3)
    expect(shape.creditCol).toBe(4)
    expect(shape.labelCol).toBe(2)
  })

  it('saute les lignes de preambule', () => {
    const shape = detectShape(parseDelimited(CREDIT_AGRICOLE, ';'))!
    expect(shape.headerIndex).toBe(2)
    expect(shape.amountCol).toBe(2)
    expect(shape.labelCol).toBe(1)
  })

  it('abandonne proprement sur un fichier hors sujet', () => {
    expect(detectShape(parseDelimited('nom;prenom\nDupont;Marie', ';'))).toBeNull()
  })
})

describe('import CSV', () => {
  it('lit un releve Credit Mutuel', () => {
    const r = parseStatement(CREDIT_MUTUEL, 'releve.csv')
    expect(r.format).toBe('csv')
    expect(r.rows).toHaveLength(4)
    expect(r.rows[0]).toMatchObject({ date: '2026-09-22', amount: -42.3, category: 'alimentation', kind: 'vie' })
    expect(r.rows[1]).toMatchObject({ date: '2026-09-20', amount: 5000 })
    expect(r.rows[2]).toMatchObject({ amount: -625, kind: 'obligation' })
    expect(r.rows[3]).toMatchObject({ amount: -145, kind: 'dette' })
  })

  it('lit un releve Credit Agricole avec preambule', () => {
    const r = parseStatement(CREDIT_AGRICOLE, 'operations.csv')
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0]).toMatchObject({ amount: -24.9, category: 'restaurant' })
    expect(r.rows[1].kind).toBe('dette')
  })

  it('lit un export en virgules et guillemets', () => {
    const r = parseStatement(BOURSO_COMMA, 'export.csv')
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0]).toMatchObject({ date: '2026-09-18', amount: -14.99, category: 'abonnements' })
    expect(r.rows[2].kind).toBe('epargne')
  })

  it('explique son echec au lieu de planter', () => {
    const r = parseStatement('bonjour\nceci n est pas un releve', 'notes.csv')
    expect(r.rows).toHaveLength(0)
    expect(r.error).toBeTruthy()
  })

  it('ignore les lignes a montant nul ou illisible', () => {
    const csv = 'Date;Libelle;Montant\n22/09/2026;OK;-10,00\n23/09/2026;VIDE;\n;SANS DATE;-5,00\n24/09/2026;ZERO;0,00'
    expect(parseStatement(csv, 'a.csv').rows).toHaveLength(1)
  })
})

describe('import OFX et QIF', () => {
  it('lit un OFX', () => {
    const r = parseStatement(OFX_SAMPLE, 'releve.ofx')
    expect(r.format).toBe('ofx')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ date: '2026-09-22', amount: -42.3, label: 'MONOPRIX PARIS' })
    expect(r.rows[1].amount).toBe(5000)
  })

  it('lit un QIF', () => {
    const r = parseStatement(QIF_SAMPLE, 'releve.qif')
    expect(r.format).toBe('qif')
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ date: '2026-09-22', amount: -42.3, label: 'MONOPRIX' })
  })
})

describe('categorisation', () => {
  it('reconnait les postes qui comptent', () => {
    expect(categorise('PRLV URSSAF IDF').kind).toBe('obligation')
    expect(categorise('KLARNA*ZALANDO').kind).toBe('dette')
    expect(categorise('YOUNITED CREDIT').kind).toBe('dette')
    expect(categorise('CARTE MONOPRIX')).toEqual({ category: 'alimentation', kind: 'vie' })
    expect(categorise('UBER EATS').category).toBe('restaurant')
    expect(categorise('NAVIGO RATP').category).toBe('transport')
    expect(categorise('ZALANDO SE').category).toBe('shopping')
    expect(categorise('PHARMACIE DU CENTRE').category).toBe('sante')
    expect(categorise('VIREMENT LIVRET A').kind).toBe('epargne')
  })

  it('ne confond pas Amazon Prime et un achat Amazon', () => {
    expect(categorise('AMAZON PRIME').category).toBe('abonnements')
    expect(categorise('AMAZON MARKETPLACE').category).toBe('shopping')
  })

  it('retombe sur "autre" sans se tromper de sens', () => {
    expect(categorise('PAIEMENT XYZ123')).toEqual({ category: 'autre', kind: 'vie' })
  })
})

describe('doublons', () => {
  it('normalise les libelles avant comparaison', () => {
    expect(normaliseLabel('CARTE 20/09 DÉLIVEROO  PARIS')).toBe('CARTE DELIVEROO PARIS')
  })

  it('marque ce qui est deja dans le cockpit', () => {
    const rows = parseStatement(CREDIT_MUTUEL, 'a.csv').rows
    const existing = new Set([rowKey('2026-09-05', -625, 'PRLV URSSAF IDF')])
    const marked = markDuplicates(rows, existing)
    const urssaf = marked.find((r) => r.label.includes('URSSAF'))!
    expect(urssaf.duplicate).toBe(true)
    expect(urssaf.include).toBe(false)
    expect(marked.filter((r) => r.include)).toHaveLength(3)
  })

  it('garde deux mouvements identiques du meme jour', () => {
    const csv = 'Date;Libelle;Montant\n22/09/2026;CAFE;-3,50\n22/09/2026;CAFE;-3,50'
    const marked = markDuplicates(parseStatement(csv, 'a.csv').rows, new Set())
    expect(marked).toHaveLength(2)
    expect(marked[0].key).not.toBe(marked[1].key)
    expect(marked.every((r) => r.include)).toBe(true)
  })

  it('re-importer le meme fichier n’ajoute rien', () => {
    const first = markDuplicates(parseStatement(CREDIT_MUTUEL, 'a.csv').rows, new Set())
    const keys = new Set(first.map((r) => r.key))
    const second = markDuplicates(parseStatement(CREDIT_MUTUEL, 'a.csv').rows, keys)
    expect(second.every((r) => r.duplicate)).toBe(true)
    expect(second.some((r) => r.include)).toBe(false)
  })
})
