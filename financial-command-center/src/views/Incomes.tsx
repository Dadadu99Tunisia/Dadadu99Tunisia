import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Income } from '../types'
import { euro } from '../lib/money'
import { longDate, monthKey, monthLabel, today } from '../lib/dates'
import { Badge, Card, Empty, Stat } from '../components/ui'
import { IncomeModal, AllocationModal } from '../modals/IncomeModal'

const STATUS_TONE: Record<string, string> = { prevu: '', facture: 'warn', encaisse: 'good' }
const STATUS_LABEL: Record<string, string> = { prevu: 'Prevu', facture: 'Facture', encaisse: 'Encaisse' }

export function Incomes() {
  const { state } = useStore()
  const [editing, setEditing] = useState<Income | null>(null)
  const [creating, setCreating] = useState(false)
  const [allocating, setAllocating] = useState<Income | null>(null)

  const rows = useMemo(
    () => [...state.incomes].sort((a, b) => b.date.localeCompare(a.date)),
    [state.incomes],
  )
  const key = monthKey(today())
  const cashedThisMonth = rows
    .filter((i) => i.status === 'encaisse' && monthKey(i.date) === key)
    .reduce((a, i) => a + i.amount, 0)
  const pending = rows.filter((i) => i.status !== 'encaisse').reduce((a, i) => a + i.amount, 0)

  return (
    <div className="stack">
      <div className="grid k2">
        <Stat label={`Encaisse — ${monthLabel(key)}`} value={euro(cashedThisMonth)} accent="vie" />
        <Stat label="Prevu ou facture" value={euro(pending)} accent="epargne" hint="pas encore sur ton compte" />
      </div>

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouveau revenu</button>

      <Card title="Tous les revenus" flush>
        {rows.length === 0 ? (
          <Empty icon="&#128176;">Aucun revenu pour l&rsquo;instant.</Empty>
        ) : (
          <div className="list">
            {rows.map((i) => (
              <div className="item clickable" key={i.id} onClick={() => setEditing(i)}>
                <span className="avatar" aria-hidden>{i.status === 'encaisse' ? '✅' : '⏳'}</span>
                <div className="main-col">
                  <div className="title">{i.client || 'Revenu'}</div>
                  <div className="sub">
                    {longDate(i.date)}
                    {i.recurring && ' · recurrent'}
                    {i.allocation && ' · reparti'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="amount pos">{euro(i.amount)}</div>
                  <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {rows.some((i) => i.status === 'encaisse' && !i.allocation) && (
        <Card title="A repartir">
          <p className="fine" style={{ marginBottom: 12 }}>
            Ces encaissements n&rsquo;ont pas encore ete repartis entre tes enveloppes.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {rows.filter((i) => i.status === 'encaisse' && !i.allocation).slice(0, 4).map((i) => (
              <button key={i.id} className="btn block" onClick={() => setAllocating(i)}>
                Repartir {euro(i.amount)} &mdash; {i.client || 'revenu'}
              </button>
            ))}
          </div>
        </Card>
      )}

      {creating && <IncomeModal onClose={() => setCreating(false)} />}
      {editing && <IncomeModal initial={editing} onClose={() => setEditing(null)} />}
      {allocating && <AllocationModal income={allocating} onClose={() => setAllocating(null)} />}
    </div>
  )
}
