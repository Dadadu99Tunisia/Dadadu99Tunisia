import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { TX_CATEGORY_LABELS } from '../types'
import type { Transaction, TxCategory } from '../types'
import { euro } from '../lib/money'
import { longDate, monthKey, monthLabel, today } from '../lib/dates'
import { livingSnapshot } from '../lib/engine'
import { Bar, Badge, Card, ConfirmButton, Empty, Segmented, Stat } from '../components/ui'
import { ExpenseModal } from '../modals/ExpenseModal'

const KIND_ICON: Record<string, string> = {
  vie: '\u{1F6D2}', obligation: '\u{1F4C5}', dette: '\u{1F4C9}',
  epargne: '\u{1F6DF}', ajustement: '\u{1F501}',
}

export function Expenses() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'vie' | 'tout'>('vie')
  const [category, setCategory] = useState<TxCategory | 'toutes'>('toutes')

  const key = monthKey(today())
  const living = livingSnapshot(state, today())

  const rows = useMemo(() => {
    return [...state.transactions]
      .filter((t) => (filter === 'vie' ? t.kind === 'vie' : true))
      .filter((t) => (category === 'toutes' ? true : t.category === category))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [state.transactions, filter, category])

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

  return (
    <div className="stack">
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

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouvelle depense</button>

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
        <Card flush><Empty icon="&#129534;">Aucune depense enregistree.</Empty></Card>
      ) : (
        byMonth.map(([k, list]) => (
          <Card key={k} flush>
            <div className="month-head" style={{ borderTop: 0 }}>
              {monthLabel(k)} &middot; {euro(list.reduce((a, t) => a + Math.abs(t.amount), 0))}
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
                    <ConfirmButton onConfirm={() => dispatch({ type: 'tx/remove', id: t.id })}>
                      Suppr.
                    </ConfirmButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {creating && <ExpenseModal onClose={() => setCreating(false)} />}
      {editing && <ExpenseModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
