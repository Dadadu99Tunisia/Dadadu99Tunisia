import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Provision, SavingsGoal } from '../types'
import { euro, percent, ratio } from '../lib/money'
import { monthLabel, relativeDue, today } from '../lib/dates'
import {
  emergencyFund, provisionStatus, provisionsMonthlyTotal, provisionsSaved,
  savedInMonth, savingsHistory, savingsPace, savingsRate, savingsTotal,
} from '../lib/engine'
import { Bar, Badge, Callout, Card, Empty, Ring, Stat } from '../components/ui'
import { SavingsBars } from '../components/BarChart'
import { GoalModal, GoalDepositModal } from '../modals/Entities'
import { ProvisionModal, ProvisionFundModal } from '../modals/ProvisionModal'

export function Savings() {
  const { state } = useStore()
  const ref = today()
  const key = ref.slice(0, 7)

  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [depositing, setDepositing] = useState<SavingsGoal | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingProv, setEditingProv] = useState<Provision | null>(null)
  const [fundingProv, setFundingProv] = useState<Provision | null>(null)
  const [creatingProv, setCreatingProv] = useState(false)

  const fund = useMemo(() => emergencyFund(state, ref), [state, ref])
  const history = useMemo(() => savingsHistory(state, 12, ref), [state, ref])
  const pace = useMemo(() => savingsPace(state, 3, ref), [state, ref])
  const thisMonth = savedInMonth(state, key)
  const rate = savingsRate(state, key)
  const total = savingsTotal(state)
  const provMonthly = provisionsMonthlyTotal(state, ref)
  const provSaved = provisionsSaved(state)

  const provisions = useMemo(
    () => state.provisions.map((p) => provisionStatus(p, ref)).sort((a, b) => a.provision.dueDate.localeCompare(b.provision.dueDate)),
    [state.provisions, ref],
  )

  return (
    <div className="stack">
      {/* ---------------------------- Fonds de precaution --------------------------- */}
      <section className="hero">
        <div className="eyebrow">&#128159; Mon epargne de precaution</div>
        <div className="row" style={{ justifyContent: 'center', gap: 16, alignItems: 'baseline', marginTop: 6 }}>
          <span className="big num" style={{ margin: 0, color: 'var(--epargne)' }}>
            {fund.monthsCovered.toFixed(1).replace('.', ',')}
          </span>
          <span style={{ fontSize: 18, color: 'var(--text-soft)', fontWeight: 620 }}>mois</span>
        </div>
        <div className="outof">que tu tiens sans aucune rentree d&rsquo;argent</div>

        <div style={{ margin: '18px auto 0', maxWidth: 470 }}>
          <Bar value={fund.saved} max={fund.targetAmount || 1} tone="epargne" tall />
          <div className="row" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>deja couvert</span>
            <span className="spacer" />
            <span className="num">{Math.round(fund.covered * 100)} %</span>
          </div>
        </div>

        <div className="hero-legs" style={{ maxWidth: 470, margin: '16px auto 0' }}>
          <div>
            <div className="n num">{euro(fund.saved)}</div>
            <div className="l">deja de cote</div>
          </div>
          <div>
            <div className="n num">{euro(pace)}</div>
            <div className="l">mon rythme</div>
          </div>
          <div>
            <div className="n num">
              {fund.monthsToComplete === 0 ? '✓' : fund.monthsToComplete ?? '—'}
            </div>
            <div className="l">{fund.monthsToComplete === 0 ? 'objectif atteint' : 'mois restants'}</div>
          </div>
        </div>

        <div className="coach">
          {state.settings.emergencyMonths} mois de charges recommandes, soit{' '}
          <b>{euro(fund.targetAmount)}</b>. Tes charges mensuelles reelles :{' '}
          <b>{euro(fund.monthlyNeed)}</b> (obligations, budget de vie, dettes et provisions).
          {fund.missing > 0 && <> Il manque <b>{euro(fund.missing)}</b>.</>}
          {fund.missing > 0 && pace <= 0 && (
            <> Mets une premiere somme de cote pour que le cockpit puisse estimer un delai.</>
          )}
        </div>
      </section>

      {/* ------------------------------ Le mois en cours ----------------------------- */}
      <div className="grid k3">
        <Stat
          label={`Epargne ce mois — ${monthLabel(key)}`}
          value={euro(thisMonth)}
          accent="epargne"
          hint={pace > 0 ? `rythme : ${euro(pace)} / mois` : 'pas encore de rythme mesure'}
        />
        <Stat
          label="Mon taux d’epargne"
          value={percent(rate)}
          accent={rate >= 0.2 ? 'vie' : 'obligations'}
          hint={rate >= 0.2 ? 'repere de 20 % atteint' : 'repere courant : 20 % du revenu'}
        />
        <Stat
          label="Total epargne"
          value={euro(total)}
          accent="epargne"
          hint={`+ ${euro(provSaved)} en provisions`}
        />
      </div>

      {/* -------------------------------- Historique --------------------------------- */}
      <Card title="Ou va mon epargne, mois par mois">
        {history.every((h) => h.amount === 0) ? (
          <Empty icon="&#128202;">
            Aucun virement d&rsquo;epargne enregistre. Alimente un objectif ou une provision
            pour voir la courbe demarrer.
          </Empty>
        ) : (
          <>
            <SavingsBars data={history} average={pace} />
            <details style={{ marginTop: 12 }}>
              <summary className="fine" style={{ cursor: 'pointer' }}>Voir les chiffres</summary>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="data">
                  <thead><tr><th>Mois</th><th>Mis de cote</th></tr></thead>
                  <tbody>
                    {[...history].reverse().map((h) => (
                      <tr key={h.key}>
                        <td style={{ textTransform: 'capitalize' }}>{monthLabel(h.key)}</td>
                        <td>{euro(h.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </Card>

      {/* -------------------------------- Provisions --------------------------------- */}
      <Card
        title="Mes provisions"
        flush
        action={<button className="btn sm ghost" onClick={() => setCreatingProv(true)}>+ Ajouter</button>}
      >
        <div style={{ padding: '0 18px 14px' }}>
          <p className="fine" style={{ margin: 0 }}>
            Les depenses qui ne tombent pas tous les mois, lissees pour ne plus les subir.
            {provMonthly > 0 && <> Effort total : <b>{euro(provMonthly)} par mois</b>.</>}
          </p>
        </div>
        {provisions.length === 0 ? (
          <Empty icon="&#127963;&#65039;">
            Taxe fonciere, assurance annuelle, revision de voiture&hellip; Une provision
            transforme une grosse facture en petit effort mensuel.
          </Empty>
        ) : (
          <div className="list">
            {provisions.map((st) => (
              <div className="prov" key={st.provision.id}>
                <Ring
                  value={st.provision.saved}
                  max={st.provision.amount || 1}
                  size={54}
                  stroke={6}
                  color={st.ready ? 'var(--vie)' : st.late ? 'var(--critical)' : 'var(--epargne)'}
                />
                <div className="main-col">
                  <div className="title">{st.provision.emoji} {st.provision.name}</div>
                  <div className="sub">
                    {euro(st.provision.saved)} sur {euro(st.provision.amount)} &middot;{' '}
                    {st.late ? 'echeance depassee' : relativeDue(st.provision.dueDate)}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <button className="btn sm primary" onClick={() => setFundingProv(st.provision)}>
                      Mettre de cote
                    </button>
                    <button className="btn sm ghost" onClick={() => setEditingProv(st.provision)}>Modifier</button>
                  </div>
                </div>
                <div className="figures">
                  {st.ready ? (
                    <Badge tone="good">&#127881; Prete</Badge>
                  ) : (
                    <>
                      <div className="per-month">{euro(st.monthly)}</div>
                      <div className="of">par mois &middot; {st.monthsLeft} mois</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ------------------------------ Objectifs projets ---------------------------- */}
      <Card
        title="Mes objectifs"
        flush
        action={<button className="btn sm ghost" onClick={() => setCreating(true)}>+ Ajouter</button>}
      >
        {state.savingsGoals.length === 0 ? (
          <Empty icon="&#128176;">Aucun objectif d&rsquo;epargne.</Empty>
        ) : (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {state.savingsGoals.map((g) => {
              const done = g.target > 0 && g.current >= g.target
              return (
                <div className="card" key={g.id} style={{ padding: 16 }}>
                  {g.image && (
                    <div className="goal-cover" style={{ margin: '-16px -16px 14px' }}>
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
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Callout tone="info" icon="&#128161;">
        L&rsquo;epargne est tenue a part de ton compte courant. Alimenter un objectif ou une
        provision enregistre une sortie de ton solde : c&rsquo;est un vrai virement, pas une
        intention.
      </Callout>

      {creating && <GoalModal onClose={() => setCreating(false)} />}
      {editing && <GoalModal initial={editing} onClose={() => setEditing(null)} />}
      {depositing && <GoalDepositModal goal={depositing} onClose={() => setDepositing(null)} />}
      {creatingProv && <ProvisionModal onClose={() => setCreatingProv(false)} />}
      {editingProv && <ProvisionModal initial={editingProv} onClose={() => setEditingProv(null)} />}
      {fundingProv && <ProvisionFundModal provision={fundingProv} onClose={() => setFundingProv(null)} />}
    </div>
  )
}
