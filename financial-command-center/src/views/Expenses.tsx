import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { TX_CATEGORY_LABELS } from '../types'
import type { Transaction, TxCategory } from '../types'
import { euro } from '../lib/money'
import { longDate, monthKey, monthLabel, today } from '../lib/dates'
import { livingSnapshot } from '../lib/engine'
import { Bar, Badge, Card, Empty, Segmented, Stat } from '../components/ui'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useToast } from '../components/Toast'
import { monthPosition, refForMonth } from '../lib/engine'
import { ExpenseModal } from '../modals/ExpenseModal'
import { ImportModal } from '../modals/ImportModal'

const KIND_ICON: Record<string, string> = {
  vie: '\u{1F6D2}', obligation: '\u{1F4C5}', dette: '\u{1F4C9}',
  epargne: '\u{1F6DF}', ajustement: '\u{1F501}', virement: '\u{1F501}',
}

export function Expenses() {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<'vie' | 'tout'>('vie')
  const [category, setCategory] = useState<TxCategory | 'toutes'>('toutes')

  const now = today()
  const current = monthKey(now)
  const [month, setMonth] = useState(current)
  const pos = monthPosition(month, now)
  const key = month
  const living = livingSnapshot(state, refForMonth(month, now))

  const rows = useMemo(() => {
    return [...state.transactions]
      .filter((t) => monthKey(t.date) === month)
      .filter((t) => (filter === 'vie' ? t.kind === 'vie' : true))
      .filter((t) => (category === 'toutes' ? true : t.category === category))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [state.transactions, filter, category, month])

  const byMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of rows) {
      const k = monthKey(t.date)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return [...map.entries()]
  }, [rows])

  const usedCategories = useMemo(() => {
    const set = new Set(state.transactions.map((t) => t.category))
    return [...set] as TxCategory[]
  }, [state.transactions])

  // Une suppression s'annule : on avance vite sans risquer de perdre une ligne.
  function remove(t: Transaction) {
    dispatch({ type: 'tx/remove', id: t.id })
    notify(`${t.description} supprime.`, {
      undo: () => dispatch({ type: 'tx/upsert', tx: t }),
    })
  }

  return (
    <div className="stack">
      <MonthSwitcher value={month} onChange={setMonth} current={current} />

      <Card title={`Enveloppe de vie — ${monthLabel(key)}`}>
        <div className="row" style={{ alignItems: 'baseline', marginBottom: 12 }}>
          <span
            className="num"
            style={{ fontSize: 30, fontWeight: 740, color: living.remaining < 0 ? 'var(--critical)' : 'var(--vie)' }}
          >
            {euro(living.remaining)}
          </span>
          <span className="spacer" />
          <span className="fine">sur {euro(living.budget)}</span>
        </div>
        <Bar value={living.spent} max={living.budget} tone={living.remaining < 0 ? 'over' : ''} tall />
        <div className="grid k3" style={{ marginTop: 14 }}>
          <Stat label="Depense" value={euro(living.spent)} />
          <Stat label="Achats" value={String(living.count)} />
          <Stat label="Panier moyen" value={euro(living.count ? living.spent / living.count : 0)} />
        </div>
      </Card>

      <div className="quick-actions">
        <button className="btn" onClick={() => setImporting(true)}>Importer un releve</button>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Nouvelle depense</button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          ariaLabel="Filtre"
          options={[{ value: 'vie', label: 'Enveloppe de vie' }, { value: 'tout', label: 'Tous les mouvements' }]}
        />
        {usedCategories.length > 1 && (
          <select
            className="cat-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as TxCategory | 'toutes')}
          >
            <option value="toutes">Toutes les categories</option>
            {usedCategories.map((c) => (
              <option key={c} value={c}>{TX_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        )}
      </div>

      {byMonth.length === 0 ? (
        <Card flush>
          <Empty icon="&#129534;">
            {pos.isFuture
              ? "Mois a venir : rien d’enregistre pour l’instant."
              : `Aucun mouvement sur ${monthLabel(month)}.`}
          </Empty>
        </Card>
      ) : (
        byMonth.map(([k, list]) => (
          <Card key={k} flush>
            <div className="month-head" style={{ borderTop: 0 }}>
              {list.length} mouvement(s) &middot; {euro(list.reduce((a, t) => a + Math.abs(t.amount), 0))}
            </div>
            <div className="list">
              {list.map((t) => (
                <div className="item" key={t.id}>
                  <span className="avatar" aria-hidden>{KIND_ICON[t.kind]}</span>
                  <div className="main-col">
                    <div className="title">{t.description}</div>
                    <div className="sub">
                      {longDate(t.date)} &middot; {TX_CATEGORY_LABELS[t.category]}
                      {t.split && ' · fractionne'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                    <span className="amount neg">
                      {t.kind === 'ajustement' && t.amount > 0 ? '+' : '−'} {euro(Math.abs(t.amount))}
                    </span>
                    {t.kind !== 'vie' && <Badge>{t.kind}</Badge>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {t.kind === 'vie' && (
                      <button className="btn sm ghost" onClick={() => setEditing(t)}>Modifier</button>
                    )}
                    <button className="btn sm danger" onClick={() => remove(t)}>Suppr.</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {creating && <ExpenseModal onClose={() => setCreating(false)} />}
      {editing && <ExpenseModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
