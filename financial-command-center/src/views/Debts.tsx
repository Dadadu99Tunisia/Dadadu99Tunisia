import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { DEBT_KIND_LABELS } from '../types'
import type { Debt } from '../types'
import { euro, ratio } from '../lib/money'
import { activeDebts, debtTotal, debtInitialTotal } from '../lib/engine'
import { Bar, Badge, Callout, Card, Empty, Stat } from '../components/ui'
import { DebtModal, DebtPaymentModal } from '../modals/Entities'

const PRIORITY_TONE: Record<string, string> = { haute: 'critical', moyenne: 'warn', basse: '' }

export function Debts() {
  const { state } = useStore()
  const [editing, setEditing] = useState<Debt | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)
  const [creating, setCreating] = useState(false)

  const active = useMemo(() => activeDebts(state), [state])
  const cleared = useMemo(() => state.debts.filter((d) => d.status === 'paid'), [state.debts])
  const total = debtTotal(state)
  const initial = debtInitialTotal(state)
  const repaid = Math.max(0, Math.round((initial - total) * 100) / 100)
  const monthly = active.reduce((a, d) => a + Math.min(d.remainingAmount, d.monthlyPayment), 0)

  return (
    <div className="stack">
      <section className={`hero ${total > 0 ? 'over' : ''}`}>
        <div className="eyebrow">Total dettes</div>
        <div className="big num" style={{ color: total > 0 ? 'var(--dettes)' : 'var(--vie)' }}>{euro(total)}</div>
        <div className="outof">{total === 0 ? 'Objectif atteint' : `rembourse : ${euro(repaid)} sur ${euro(initial)}`}</div>
        <div style={{ margin: '18px auto 0', maxWidth: 470 }}>
          <Bar value={repaid} max={initial || 1} tone="epargne" tall />
          <div className="row" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Progression vers 0 EUR</span>
            <span className="spacer" />
            <span className="num">{Math.round(ratio(repaid, initial || 1) * 100)} %</span>
          </div>
        </div>
      </section>

      {total === 0 && state.debts.length > 0 && (
        <div className="callout good celebrate">
          <span className="ico" aria-hidden>&#127881;</span>
          <div>
            <strong>Dette = 0 EUR</strong>
            <p>Tout est rembourse. Ce que tu payais chaque mois est maintenant a toi.</p>
          </div>
        </div>
      )}

      <div className="grid k2">
        <Stat label="Mensualites" value={euro(monthly)} accent="dettes" hint="chaque mois" />
        <Stat label="Lignes actives" value={String(active.length)} accent="obligations" />
      </div>

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouvelle dette</button>

      {active.length === 0 ? (
        <Card flush><Empty icon="&#127881;">Aucune dette en cours.</Empty></Card>
      ) : (
        <div className="stack">
          {active.map((d) => {
            const paid = Math.max(0, d.initialAmount - d.remainingAmount)
            return (
              <Card key={d.id}>
                <div className="row" style={{ marginBottom: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ fontSize: 16 }}>{d.name}</h3>
                    <div className="fine">
                      {DEBT_KIND_LABELS[d.kind]}
                      {d.monthlyPayment > 0 && ` · ${euro(d.monthlyPayment)}/mois le ${d.dueDay ?? 5}`}
                      {d.installmentsTotal && ` · ${d.installmentsPaid ?? 0}/${d.installmentsTotal} echeances`}
                    </div>
                  </div>
                  <Badge tone={PRIORITY_TONE[d.priority]}>{d.priority}</Badge>
                </div>

                <div className="row" style={{ alignItems: 'baseline', marginBottom: 8 }}>
                  <span className="num" style={{ fontSize: 24, fontWeight: 740, color: 'var(--dettes)' }}>
                    {euro(d.remainingAmount)}
                  </span>
                  <span className="spacer" />
                  <span className="fine">sur {euro(d.initialAmount)}</span>
                </div>

                <Bar value={paid} max={d.initialAmount || 1} tone="epargne" tall />

                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                  <button className="btn sm primary" onClick={() => setPaying(d)}>Rembourser</button>
                  <button className="btn sm ghost" onClick={() => setEditing(d)}>Modifier</button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {cleared.length > 0 && (
        <Card title={`Dettes soldees (${cleared.length})`} flush>
          <div className="list">
            {cleared.map((d) => (
              <div className="item clickable" key={d.id} onClick={() => setEditing(d)}>
                <span className="avatar" aria-hidden>&#127881;</span>
                <div className="main-col">
                  <div className="title">{d.name}</div>
                  <div className="sub">{euro(d.initialAmount)} rembourses</div>
                </div>
                <Badge tone="good">Soldee</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Callout tone="info" icon="&#128161;">
        Un paiement fractionne saisi depuis une depense arrive ici automatiquement : c&rsquo;est une
        dette, meme quand le marchand parle de &laquo; facilite de paiement &raquo;.
      </Callout>

      {creating && <DebtModal onClose={() => setCreating(false)} />}
      {editing && <DebtModal initial={editing} onClose={() => setEditing(null)} />}
      {paying && <DebtPaymentModal debt={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}
