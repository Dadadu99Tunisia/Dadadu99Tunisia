import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { OBLIGATION_CATEGORY_LABELS } from '../types'
import type { Obligation } from '../types'
import { euro } from '../lib/money'
import { longDate, relativeDue, today } from '../lib/dates'
import { obligationsDueWithin, obligationsTotal, overdueObligations, unpaidObligations } from '../lib/engine'
import { Badge, Callout, Card, Empty, Segmented, Stat } from '../components/ui'
import { useToast } from '../components/Toast'
import { ObligationModal } from '../modals/Entities'

export function Obligations() {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  const [editing, setEditing] = useState<Obligation | null>(null)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'a_payer' | 'paye'>('a_payer')
  const ref = today()

  const unpaid = useMemo(() => unpaidObligations(state), [state])
  const paid = useMemo(
    () => state.obligations.filter((o) => o.status === 'paye').sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')),
    [state.obligations],
  )
  const overdue = useMemo(() => overdueObligations(state, ref), [state, ref])
  const soon = useMemo(() => obligationsDueWithin(state, 30, ref), [state, ref])
  const rows = tab === 'a_payer' ? unpaid : paid

  return (
    <div className="stack">
      <div className="grid k2">
        <Stat label="A reserver" value={euro(obligationsTotal(state))} accent="obligations" hint={`${unpaid.length} obligation(s)`} />
        <Stat
          label="Sous 30 jours"
          value={euro(soon.reduce((a, o) => a + o.amount, 0))}
          accent={overdue.length ? 'critical' : 'obligations'}
          hint={overdue.length ? `${overdue.length} en retard` : 'a echeance proche'}
        />
      </div>

      {overdue.length > 0 && (
        <Callout tone="critical" icon="&#9888;&#65039;" title={`${overdue.length} obligation(s) en retard`}>
          {euro(overdue.reduce((a, o) => a + o.amount, 0))}. Une obligation en retard coute souvent
          plus cher que la somme elle-meme.
        </Callout>
      )}

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouvelle obligation</button>

      <Segmented
        value={tab}
        onChange={setTab}
        ariaLabel="Filtre des obligations"
        options={[
          { value: 'a_payer', label: `A payer (${unpaid.length})` },
          { value: 'paye', label: `Reglees (${paid.length})` },
        ]}
      />

      <Card title="Prochaines echeances" flush>
        {rows.length === 0 ? (
          <Empty icon="&#128197;">
            {tab === 'a_payer' ? 'Rien a regler. Profite.' : 'Aucune obligation reglee pour l’instant.'}
          </Empty>
        ) : (
          <div className="list">
            {rows.map((o) => {
              const late = o.status === 'a_payer' && o.dueDate < ref
              return (
                <div className="item" key={o.id}>
                  <span className="avatar" aria-hidden>{late ? '⚠️' : o.status === 'paye' ? '✅' : '\u{1F4C5}'}</span>
                  <div className="main-col">
                    <div className="title">{o.name}</div>
                    <div className="sub">
                      {o.status === 'paye'
                        ? `Regle le ${longDate(o.paidAt || o.dueDate)}`
                        : `${longDate(o.dueDate)} · ${relativeDue(o.dueDate, ref)}`}
                      {o.recurrence !== 'none' && ' · recurrente'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                    <span className={`amount ${late ? 'neg' : ''}`}>{euro(o.amount)}</span>
                    <Badge tone={late ? 'critical' : o.status === 'paye' ? 'good' : ''}>
                      {OBLIGATION_CATEGORY_LABELS[o.category]}
                    </Badge>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {o.status === 'a_payer' ? (
                      <button
                        className="btn sm primary"
                        onClick={() => {
                          dispatch({ type: 'obligation/pay', id: o.id, date: today() })
                          notify(`${o.name} reglee.`, {
                            tone: 'good',
                            undo: () => dispatch({ type: 'obligation/unpay', id: o.id }),
                          })
                        }}
                      >
                        Payer
                      </button>
                    ) : (
                      <button className="btn sm ghost" onClick={() => dispatch({ type: 'obligation/unpay', id: o.id })}>
                        Annuler
                      </button>
                    )}
                    <button className="btn sm ghost" onClick={() => setEditing(o)}>Modifier</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <p className="fine">
        Marquer une obligation comme payee enregistre le mouvement sur ton compte. Si elle est
        recurrente, la prochaine echeance est creee automatiquement.
      </p>

      {creating && <ObligationModal onClose={() => setCreating(false)} />}
      {editing && <ObligationModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
