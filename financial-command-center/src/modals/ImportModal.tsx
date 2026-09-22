import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { TX_CATEGORY_LABELS, LIVING_CATEGORIES } from '../types'
import type { Income, Transaction, TxCategory } from '../types'
import {
  decodeBuffer, markDuplicates, parseStatement, rowKey,
} from '../lib/bankImport'
import type { ImportedRow } from '../lib/bankImport'
import { euro } from '../lib/money'
import { shortDate } from '../lib/dates'
import { uid } from '../lib/storage'
import { Callout, Field, Modal, Segmented } from '../components/ui'

const CATEGORIES = Object.keys(TX_CATEGORY_LABELS) as TxCategory[]

type Step = 'pick' | 'review'

/**
 * Import d'un releve bancaire.
 * Rien n'est enregistre sans passage par l'ecran de relecture : un import
 * silencieux qui se trompe de categorie fausse tout le budget de vie.
 */
export function ImportModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [rows, setRows] = useState<ImportedRow[]>([])
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')
  const [filter, setFilter] = useState<'tout' | 'sorties' | 'entrees'>('tout')
  const [done, setDone] = useState<{ tx: number; inc: number } | null>(null)

  const existingKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const t of state.transactions) {
      if (t.importKey) keys.add(t.importKey)
      else keys.add(rowKey(t.date, t.kind === 'ajustement' ? t.amount : -Math.abs(t.amount), t.description))
    }
    for (const i of state.incomes) {
      if (i.importKey) keys.add(i.importKey)
    }
    return keys
  }, [state.transactions, state.incomes])

  async function onFile(file: File) {
    setError('')
    try {
      const text = decodeBuffer(await file.arrayBuffer())
      const result = parseStatement(text, file.name)
      if (result.error || result.rows.length === 0) {
        setError(result.error || 'Aucun mouvement lisible dans ce fichier.')
        return
      }
      setRows(markDuplicates(result.rows, existingKeys))
      setFilename(file.name)
      setStep('review')
    } catch {
      setError('Fichier illisible. Formats acceptes : CSV, OFX, QIF.')
    }
  }

  const visible = rows.filter((r) =>
    filter === 'tout' ? true : filter === 'sorties' ? r.amount < 0 : r.amount > 0,
  )
  const selected = rows.filter((r) => r.include)
  const selectedOut = selected.filter((r) => r.amount < 0)
  const selectedIn = selected.filter((r) => r.amount > 0)
  const duplicates = rows.filter((r) => r.duplicate).length

  function patch(key: string, changes: Partial<ImportedRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)))
  }

  function setAll(include: boolean) {
    const keys = new Set(visible.map((r) => r.key))
    setRows((prev) => prev.map((r) => (keys.has(r.key) ? { ...r, include } : r)))
  }

  function commit() {
    const transactions: Transaction[] = []
    const incomes: Income[] = []

    for (const r of selected) {
      if (r.amount > 0) {
        incomes.push({
          id: uid(), date: r.date, client: r.label, amount: r.amount,
          type: 'autre', status: 'encaisse', importKey: r.key,
        })
      } else {
        transactions.push({
          id: uid(), date: r.date, description: r.label,
          category: r.category, amount: Math.abs(r.amount),
          kind: r.kind, importKey: r.key,
        })
      }
    }

    dispatch({ type: 'import/apply', transactions, incomes })
    setDone({ tx: transactions.length, inc: incomes.length })
  }

  /* ------------------------------ Choix du fichier ------------------------------ */
  if (step === 'pick') {
    return (
      <Modal
        title="Importer un releve bancaire"
        onClose={onClose}
        footer={<button className="btn ghost block" onClick={onClose}>Fermer</button>}
      >
        <button className="dropzone" onClick={() => fileRef.current?.click()}>
          <span className="ico" aria-hidden>&#128194;</span>
          <strong>Choisir un fichier</strong>
          <span className="fine">CSV, OFX ou QIF exporte depuis ta banque</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.ofx,.qfx,.qif,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />

        {error && <Callout tone="critical" icon="&#9888;&#65039;">{error}</Callout>}

        <Callout tone="info" icon="&#128274;" title="Le fichier ne quitte pas ton navigateur">
          Il est lu en local, jamais envoye. Rien n&rsquo;est enregistre avant que tu aies
          relu les lignes.
        </Callout>

        <div className="fine">
          <p style={{ margin: '0 0 6px' }}><b>Ou trouver ce fichier</b></p>
          <p style={{ margin: 0 }}>
            Credit Mutuel : Comptes &rsaquo; Telecharger les operations &rsaquo; CSV ou OFX.<br />
            Credit Agricole : Mes comptes &rsaquo; Telecharger &rsaquo; CSV, OFX ou QIF.<br />
            La plupart des banques proposent l&rsquo;un de ces trois formats.
          </p>
        </div>
      </Modal>
    )
  }

  /* --------------------------------- Confirmation -------------------------------- */
  if (done) {
    return (
      <Modal
        title="Import termine"
        onClose={onClose}
        footer={<button className="btn primary block" onClick={onClose}>Terminer</button>}
      >
        <Callout tone="good" icon="&#9989;" title="Mouvements ajoutes">
          {done.tx} depense(s) et {done.inc} entree(s) enregistrees.
        </Callout>
        <p className="fine">
          Pense a verifier ton solde bancaire depuis le tableau de bord : l&rsquo;import
          ajoute des mouvements, il ne connait pas ton solde de depart.
        </p>
      </Modal>
    )
  }

  /* ----------------------------------- Relecture --------------------------------- */
  return (
    <Modal
      title={`Relire — ${filename}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => { setStep('pick'); setRows([]) }}>Retour</button>
          <button className="btn primary" disabled={selected.length === 0} onClick={commit}>
            Importer {selected.length}
          </button>
        </>
      }
    >
      <div className="grid k2" style={{ gap: 10 }}>
        <div className="stat accent-dettes">
          <span className="label">Sorties retenues</span>
          <span className="value">{euro(selectedOut.reduce((a, r) => a + Math.abs(r.amount), 0))}</span>
          <span className="hint">{selectedOut.length} ligne(s)</span>
        </div>
        <div className="stat accent-vie">
          <span className="label">Entrees retenues</span>
          <span className="value">{euro(selectedIn.reduce((a, r) => a + r.amount, 0))}</span>
          <span className="hint">{selectedIn.length} ligne(s)</span>
        </div>
      </div>

      {duplicates > 0 && (
        <Callout tone="info" icon="&#128260;">
          {duplicates} ligne(s) deja presente(s) dans le cockpit ont ete decochees.
        </Callout>
      )}

      <Field label="Afficher">
        <Segmented
          value={filter}
          onChange={setFilter}
          ariaLabel="Filtre des lignes"
          options={[
            { value: 'tout', label: `Tout (${rows.length})` },
            { value: 'sorties', label: 'Sorties' },
            { value: 'entrees', label: 'Entrees' },
          ]}
        />
      </Field>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => setAll(true)}>Tout cocher</button>
        <button className="btn sm ghost" onClick={() => setAll(false)}>Tout decocher</button>
      </div>

      <div className="import-list">
        {visible.map((r) => (
          <div className={`import-row ${r.include ? '' : 'off'}`} key={r.key}>
            <input
              type="checkbox"
              checked={r.include}
              onChange={(e) => patch(r.key, { include: e.target.checked })}
              aria-label={`Importer ${r.label}`}
            />
            <div className="meta">
              <div className="lbl" title={r.label}>{r.label}</div>
              <div className="fine">
                {shortDate(r.date)}
                {r.duplicate && ' · deja importee'}
              </div>
            </div>
            <div className="right">
              <span className={`amt ${r.amount > 0 ? 'pos' : ''}`}>
                {r.amount > 0 ? '+' : '−'} {euro(Math.abs(r.amount))}
              </span>
              {r.amount < 0 && (
                <select
                  value={r.category}
                  onChange={(e) => {
                    const category = e.target.value as TxCategory
                    // La categorie decide si la ligne pese sur l'enveloppe de vie.
                    const kind = category === 'epargne'
                      ? 'epargne'
                      : category === 'dette'
                        ? 'dette'
                        : LIVING_CATEGORIES.includes(category)
                          ? 'vie'
                          : 'obligation'
                    patch(r.key, { category, kind })
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{TX_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="fine">
        Seules les categories du quotidien (alimentation, restaurant, shopping, transport,
        loisirs, sante, autre) sont imputees sur ton enveloppe de vie. Les autres sortent de
        ton compte sans la consommer.
      </p>
    </Modal>
  )
}
