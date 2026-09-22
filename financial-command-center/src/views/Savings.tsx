import { useState } from 'react'
import { useStore } from '../store'
import type { SavingsGoal } from '../types'
import { euro, ratio } from '../lib/money'
import { savingsTotal } from '../lib/engine'
import { Bar, Card, Empty, Stat } from '../components/ui'
import { GoalModal, GoalDepositModal } from '../modals/Entities'

export function Savings() {
  const { state } = useStore()
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [depositing, setDepositing] = useState<SavingsGoal | null>(null)
  const [creating, setCreating] = useState(false)

  const total = savingsTotal(state)
  const months = state.settings.livingBudget > 0 ? total / state.settings.livingBudget : 0

  return (
    <div className="stack">
      <section className="hero">
        <div className="eyebrow">&#128176; Epargne</div>
        <div className="big num" style={{ color: 'var(--epargne)' }}>{euro(total)}</div>
        <div className="outof">
          soit {months.toFixed(1).replace('.', ',')} mois de budget de vie
        </div>
        <div className="coach">
          Une epargne de securite de trois mois de budget de vie, soit{' '}
          <b>{euro(state.settings.livingBudget * 3)}</b>, te met a l&rsquo;abri d&rsquo;un mois sans
          rentree d&rsquo;argent.
        </div>
      </section>

      <div className="grid k2">
        <Stat label="Objectifs" value={String(state.savingsGoals.length)} accent="epargne" />
        <Stat
          label="Cible totale"
          value={euro(state.savingsGoals.reduce((a, g) => a + g.target, 0))}
          accent="epargne"
        />
      </div>

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouvel objectif</button>

      {state.savingsGoals.length === 0 ? (
        <Card flush><Empty icon="&#128176;">Aucun objectif d&rsquo;epargne.</Empty></Card>
      ) : (
        <div className="stack">
          {state.savingsGoals.map((g) => {
            const done = g.target > 0 && g.current >= g.target
            return (
              <Card key={g.id}>
                {g.image && (
                  <div className="goal-cover">
                    <img src={g.image} alt="" />
                    <div className="veil" />
                    <div className="on-img">
                      <div style={{ minWidth: 0 }}>
                        <div className="n">{g.emoji} {g.name}</div>
                        <div className="t">
                          {g.target > 0 ? `objectif ${euro(g.target)}` : 'sans objectif chiffre'}
                        </div>
                      </div>
                      <span className="spacer" />
                      {g.target > 0 && <span className="pct">{Math.round(ratio(g.current, g.target) * 100)} %</span>}
                    </div>
                  </div>
                )}
                {/* Avec une photo, le nom et l'objectif sont deja sur la couverture. */}
                {!g.image && (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <span className="avatar" aria-hidden style={{ fontSize: 19 }}>{g.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 16 }}>{g.name}</h3>
                      <div className="fine">
                        {g.target > 0 ? `Objectif ${euro(g.target)}` : 'Sans objectif chiffre'}
                      </div>
                    </div>
                    {done && <span className="badge good celebrate">&#127881; Atteint</span>}
                  </div>
                )}

                <div className="row" style={{ alignItems: 'baseline', marginBottom: 8 }}>
                  <span className="num" style={{ fontSize: 24, fontWeight: 740, color: 'var(--epargne)' }}>
                    {euro(g.current)}
                  </span>
                  <span className="spacer" />
                  {g.image && done && <span className="badge good celebrate">&#127881; Atteint</span>}
                  {g.target > 0 && !g.image && (
                    <span className="fine num">{Math.round(ratio(g.current, g.target) * 100)} %</span>
                  )}
                </div>

                {g.target > 0 && <Bar value={g.current} max={g.target} tone="epargne" tall />}

                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                  <button className="btn sm primary" onClick={() => setDepositing(g)}>Alimenter</button>
                  <button className="btn sm ghost" onClick={() => setEditing(g)}>Modifier</button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p className="fine">
        L&rsquo;epargne est tenue a part de ton compte courant. Alimenter un objectif enregistre
        une sortie de ton solde bancaire : c&rsquo;est un vrai virement, pas une intention.
      </p>

      {creating && <GoalModal onClose={() => setCreating(false)} />}
      {editing && <GoalModal initial={editing} onClose={() => setEditing(null)} />}
      {depositing && <GoalDepositModal goal={depositing} onClose={() => setDepositing(null)} />}
    </div>
  )
}
