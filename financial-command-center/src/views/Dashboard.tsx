import { useMemo } from 'react'
import { useStore } from '../store'
import {
  availability, crisisState, healthReport, livingSnapshot, monthlyCascade,
  obligationsDueWithin, overdueObligations, priorityActions, activeDebts, upcomingIncomes,
} from '../lib/engine'
import { euro, ratio } from '../lib/money'
import { longDate, monthLabel, relativeDue, today } from '../lib/dates'
import { Bar, Badge, Callout, Card, Empty, Stat } from '../components/ui'
import { CascadeView } from '../components/Cascade'
import type { View } from '../Nav'

export function Dashboard({
  go, onExpense, onIncome, onBalance,
}: {
  go: (v: View) => void
  onExpense: () => void
  onIncome: () => void
  onBalance: () => void
}) {
  const { state } = useStore()
  const ref = today()

  const living = useMemo(() => livingSnapshot(state, ref), [state, ref])
  const avail = useMemo(() => availability(state, ref), [state, ref])
  const crisis = useMemo(() => crisisState(state, ref), [state, ref])
  const health = useMemo(() => healthReport(state, ref), [state, ref])
  const cascade = useMemo(() => monthlyCascade(state, ref), [state, ref])
  const upcoming = useMemo(() => obligationsDueWithin(state, 30, ref), [state, ref])
  const overdue = useMemo(() => overdueObligations(state, ref), [state, ref])
  const nextIncomes = useMemo(() => upcomingIncomes(state, ref).slice(0, 3), [state, ref])
  const debts = useMemo(() => activeDebts(state), [state])

  const empty =
    state.incomes.length === 0 &&
    state.transactions.length === 0 &&
    state.obligations.length === 0 &&
    state.debts.length === 0

  if (empty) return <FirstRun go={go} onIncome={onIncome} onBalance={onBalance} />

  const over = living.remaining < 0

  /* ------------------------------ Mode stabilisation ------------------------------ */
  if (crisis.active) {
    return (
      <div className="stack">
        <div className="crisis-banner">
          <span className="ico" aria-hidden>&#128680;</span>
          <div style={{ flex: 1 }}>
            <div className="t">Mode stabilisation</div>
            <div className="s">L&rsquo;essentiel seulement, jusqu&rsquo;a ce que la situation se detende.</div>
          </div>
        </div>

        <div className="grid k2">
          <Stat
            label="Argent reellement disponible"
            value={euro(avail.available)}
            accent={avail.available >= 0 ? 'vie' : 'critical'}
            hint={`Solde ${euro(avail.bank)}`}
          />
          <Stat label="Dettes restantes" value={euro(avail.debtsAll)} accent="dettes" hint={`${debts.length} ligne(s)`} />
        </div>

        <Card title="Pourquoi ce mode est actif">
          {crisis.reasons.map((r, i) => (
            <p key={i} className="fine" style={{ marginTop: i ? 6 : 0 }}>&bull; {r}</p>
          ))}
          {!crisis.auto && <p className="fine" style={{ marginTop: 6 }}>&bull; Tu l&rsquo;as active manuellement dans les reglages.</p>}
        </Card>

        <Card title="Actions prioritaires">
          <ol className="actions">
            {priorityActions(state, ref).map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </Card>

        {overdue.length > 0 && (
          <Card title="Obligations urgentes" flush action={<button className="btn sm ghost" onClick={() => go('obligations')}>Tout voir</button>}>
            <div className="list">
              {overdue.slice(0, 5).map((o) => (
                <div className="item" key={o.id}>
                  <span className="avatar" aria-hidden>&#9888;&#65039;</span>
                  <div className="main-col">
                    <div className="title">{o.name}</div>
                    <div className="sub">{relativeDue(o.dueDate, ref)}</div>
                  </div>
                  <span className="amount neg">{euro(o.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title={`Budget de vie — ${monthLabel(living.budget ? ref.slice(0, 7) : ref.slice(0, 7))}`}>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="num" style={{ fontSize: 26, fontWeight: 720, color: over ? 'var(--critical)' : 'var(--vie)' }}>
              {euro(living.remaining)}
            </span>
            <span className="spacer" />
            <span className="fine">sur {euro(living.budget)}</span>
          </div>
          <Bar value={living.spent} max={living.budget} tone={over ? 'over' : ''} tall />
          <p className="fine" style={{ marginTop: 10 }}>
            {over
              ? `Enveloppe depassee de ${euro(living.overspent)}.`
              : `Environ ${euro(living.perDay)} par jour sur les ${living.daysLeft} jours restants.`}
          </p>
        </Card>

        <Card title="Prochaine rentree d&rsquo;argent" flush>
          {nextIncomes.length === 0 ? (
            <Empty icon="&#128184;">Aucun revenu planifie. Ajoute tes revenus prevus pour voir venir.</Empty>
          ) : (
            <div className="list">
              {nextIncomes.map((i) => (
                <div className="item" key={i.id}>
                  <span className="avatar" aria-hidden>&#128176;</span>
                  <div className="main-col">
                    <div className="title">{i.client || 'Revenu'}</div>
                    <div className="sub">{longDate(i.date)} &middot; {i.status}</div>
                  </div>
                  <span className="amount pos">{euro(i.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="quick-actions">
          <button className="btn" onClick={onExpense}>+ Depense</button>
          <button className="btn primary" onClick={onIncome}>+ Revenu</button>
        </div>

        <p className="fine" style={{ textAlign: 'center' }}>
          Les modules secondaires sont masques. Tu peux desactiver ce mode dans les reglages.
        </p>
      </div>
    )
  }

  /* --------------------------------- Cockpit normal -------------------------------- */
  return (
    <div className="stack">
      <div>
        <div className="section-title" style={{ marginBottom: 10 }}>Mon argent</div>
        <div className="grid k3">
          <Stat
            label="Solde bancaire"
            value={euro(avail.bank)}
            hint={<button className="linkish" onClick={onBalance}>Mettre a jour</button>}
            accent={avail.bank < 0 ? 'critical' : undefined}
          />
          <Stat
            label="Reellement disponible"
            value={euro(avail.available)}
            accent={avail.available >= 0 ? 'vie' : 'critical'}
            hint="apres tout ce qui est engage"
          />
          <Stat label="Argent reserve" value={euro(avail.reserved)} accent="obligations" hint="obligations + dettes a 30 j" />
          <Stat label="Dettes restantes" value={euro(avail.debtsAll)} accent="dettes" hint={`${debts.length} ligne(s)`} />
          <Stat label="Epargne" value={euro(avail.savings)} accent="epargne" hint={`${state.savingsGoals.length} objectif(s)`} />
          <Stat
            label="Situation nette"
            value={euro(avail.netPosition)}
            accent={avail.netPosition >= 0 ? 'epargne' : 'dettes'}
            hint="solde + epargne − tout le du"
          />
        </div>
      </div>

      <section className={`hero ${over ? 'over' : ''}`}>
        <div className="eyebrow">{over ? '\u{1F534} Enveloppe depassee' : '\u{1F49A} Argent pour vivre'}</div>
        <div className="big num">{euro(living.remaining)}</div>
        <div className="outof">sur {euro(living.budget)}</div>
        <div className="spent">{euro(living.spent)} depenses &middot; {living.count} achat(s)</div>

        <div style={{ margin: '16px auto 0', maxWidth: 460 }}>
          <Bar
            value={living.spent}
            max={living.budget}
            tone={over ? 'over' : ''}
            pace={ratio(living.paceTarget, living.budget)}
            tall
          />
        </div>

        <div className="hero-legs" style={{ maxWidth: 460, margin: '16px auto 0' }}>
          <div>
            <div className="n num">{euro(living.perDay)}</div>
            <div className="l">par jour</div>
          </div>
          <div>
            <div className="n num">{euro(living.perWeek)}</div>
            <div className="l">cette semaine</div>
          </div>
          <div>
            <div className="n num">{living.daysLeft}</div>
            <div className="l">jours restants</div>
          </div>
        </div>

        <div className="coach">
          {over ? (
            <>Tu as depasse l&rsquo;enveloppe de <b>{euro(living.overspent)}</b>. Chaque euro depense
              maintenant est pris sur le mois prochain.</>
          ) : (
            <>Tu peux depenser environ <b>{euro(living.perDay)} par jour</b> jusqu&rsquo;a la fin du mois.
              {living.paceDelta >= 0
                ? ` Tu es en avance de ${euro(living.paceDelta)} sur le rythme.`
                : ` Tu es en avance de ${euro(-living.paceDelta)} sur tes depenses : le rythme se resserre.`}</>
          )}
        </div>
      </section>

      <div className="quick-actions">
        <button className="btn" onClick={onExpense}>+ Nouvelle depense</button>
        <button className="btn primary" onClick={onIncome}>+ Revenu</button>
      </div>

      {overdue.length > 0 && (
        <Callout tone="critical" icon="&#9888;&#65039;" title={`${overdue.length} obligation(s) en retard`}>
          {euro(overdue.reduce((a, o) => a + o.amount, 0))} a regler. C&rsquo;est le premier poste a traiter.
        </Callout>
      )}

      <Card
        title={`La cascade — ${monthLabel(ref.slice(0, 7))}`}
        action={<button className="btn sm ghost" onClick={() => go('obligations')}>Obligations</button>}
      >
        <CascadeView c={cascade} />
      </Card>

      <Card title="D&rsquo;ou vient le disponible">
        <div className="calc">
          <Line label="Solde bancaire" value={avail.bank} />
          <Line label="Obligations non reglees (30 j)" value={-avail.obligationsSoon} />
          <Line label="Mensualites de dettes (30 j)" value={-avail.debtsSoon} />
          <Line label="Enveloppe de vie restante" value={-avail.livingCommitted} />
          <div className="line total">
            <span className="lbl">Argent reellement disponible</span>
            <span className="spacer" />
            <span className="v num" style={{ color: avail.available >= 0 ? 'var(--vie)' : 'var(--critical)' }}>
              {euro(avail.available)}
            </span>
          </div>
        </div>
        <p className="fine" style={{ marginTop: 12 }}>
          Ton solde bancaire n&rsquo;est pas ton argent disponible. Cette ligne du bas, si.
        </p>
      </Card>

      <div className="grid panels">
        <Card
          title="Prochaines echeances"
          flush
          action={<button className="btn sm ghost" onClick={() => go('calendrier')}>Calendrier</button>}
        >
          {upcoming.length === 0 ? (
            <Empty icon="&#128197;">Rien a regler dans les 30 prochains jours.</Empty>
          ) : (
            <div className="list">
              {upcoming.slice(0, 5).map((o) => (
                <div className="item" key={o.id}>
                  <span className="avatar" aria-hidden>{o.dueDate < ref ? '⚠️' : '\u{1F4C5}'}</span>
                  <div className="main-col">
                    <div className="title">{o.name}</div>
                    <div className="sub">{relativeDue(o.dueDate, ref)}</div>
                  </div>
                  <span className="amount">{euro(o.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Sante financiere"
          action={<Badge tone={bandTone(health.band)}>{health.label}</Badge>}
        >
          <div className="row" style={{ alignItems: 'baseline', marginBottom: 12 }}>
            <span className="num" style={{ fontSize: 34, fontWeight: 740, letterSpacing: '-.04em' }}>{health.score}</span>
            <span className="fine">/ 100</span>
          </div>
          <Bar value={health.score} max={100} tone={health.band === 'critique' ? 'over' : health.band === 'a_stabiliser' ? 'obligations' : ''} />
          <div style={{ marginTop: 12 }}>
            {health.factors.slice(0, 3).map((f) => (
              <p key={f.key} className="fine" style={{ marginTop: 6 }}>
                {f.ok ? '✅' : '⚠️'} {f.detail}
              </p>
            ))}
          </div>
          <button className="btn sm ghost block" style={{ marginTop: 12 }} onClick={() => go('sante')}>
            Voir le detail
          </button>
        </Card>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="line">
      <span className="lbl">{label}</span>
      <span className="spacer" />
      <span className="v num">{value < 0 ? `− ${euro(-value)}` : euro(value)}</span>
    </div>
  )
}

export function bandTone(band: string): string {
  return band === 'critique' ? 'critical' : band === 'a_stabiliser' ? 'serious' : band === 'en_progression' ? 'warn' : 'good'
}

function FirstRun({
  go, onIncome, onBalance,
}: {
  go: (v: View) => void
  onIncome: () => void
  onBalance: () => void
}) {
  const { state, dispatch } = useStore()
  return (
    <div className="stack">
      <section className="hero">
        <div className="eyebrow">Bienvenue</div>
        <div className="big num" style={{ fontSize: 'clamp(34px, 9vw, 52px)' }}>Ton cockpit</div>
        <div className="coach">
          Trois minutes de mise en route, et tu sauras chaque matin ce que tu peux
          reellement depenser.
        </div>
      </section>

      <Card title="Mise en route">
        <ol className="actions">
          <li><b>Ton solde bancaire</b> &mdash; le point de depart du calcul.</li>
          <li><b>Tes obligations</b> &mdash; URSSAF, loyer, assurances, abonnements pro.</li>
          <li><b>Tes dettes</b> &mdash; credits, paiements fractionnes, decouvert.</li>
          <li><b>Tes revenus</b> &mdash; encaisses et a venir.</li>
        </ol>
        <div className="stack" style={{ marginTop: 14, gap: 10 }}>
          <button className="btn primary block" onClick={onBalance}>Saisir mon solde bancaire</button>
          <div className="quick-actions">
            <button className="btn" onClick={() => go('obligations')}>Obligations</button>
            <button className="btn" onClick={() => go('dettes')}>Dettes</button>
          </div>
          <button className="btn block" onClick={onIncome}>Ajouter un revenu</button>
        </div>
      </Card>

      <Card title="Tu preferes regarder d&rsquo;abord ?">
        <p className="fine">
          Charge un jeu de donnees fictif pour voir le cockpit en action. Tu pourras tout
          effacer ensuite depuis les reglages.
        </p>
        <button
          className="btn ghost block"
          style={{ marginTop: 12 }}
          onClick={async () => {
            const { demoState } = await import('../lib/demo')
            dispatch({ type: 'replace', state: demoState() })
          }}
        >
          Charger la demonstration
        </button>
        <p className="fine" style={{ marginTop: 12 }}>
          Tes donnees restent dans ce navigateur. Budget de vie actuel :{' '}
          {euro(state.settings.livingBudget)} &mdash; modifiable dans les reglages.
        </p>
      </Card>
    </div>
  )
}
