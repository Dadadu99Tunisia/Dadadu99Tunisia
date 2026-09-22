import { useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  availability, crisisState, healthReport, livingSnapshot, monthlyCascade,
  obligationsDueWithin, overdueObligations, priorityActions, activeDebts, upcomingIncomes,
  insights, monthPosition, refForMonth, weather, accountBalances,
  progressReport, solutions,
} from '../lib/engine'
import { euro, ratio } from '../lib/money'
import { longDate, monthLabel, relativeDue, today } from '../lib/dates'
import { Bar, Badge, Callout, Card, Empty, Stat } from '../components/ui'
import { CascadeView } from '../components/Cascade'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { ProgressCard, SolutionsCard } from '../components/Plan'
import { CRISIS_HIDDEN } from '../Nav'
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
  const now = today()
  const current = now.slice(0, 7)
  const [month, setMonth] = useState(current)
  const pos = monthPosition(month, now)
  // Un mois clos se lit a sa derniere journee ; le mois en cours, a aujourd'hui.
  const ref = refForMonth(month, now)

  const living = useMemo(() => livingSnapshot(state, ref), [state, ref])
  const avail = useMemo(() => availability(state, ref), [state, ref])
  const crisis = useMemo(() => crisisState(state, ref), [state, ref])
  const health = useMemo(() => healthReport(state, ref), [state, ref])
  const cascade = useMemo(() => monthlyCascade(state, ref), [state, ref])
  const upcoming = useMemo(() => obligationsDueWithin(state, 30, ref), [state, ref])
  const overdue = useMemo(() => overdueObligations(state, ref), [state, ref])
  const nextIncomes = useMemo(() => upcomingIncomes(state, now).slice(0, 3), [state, now])
  const debts = useMemo(() => activeDebts(state), [state])
  const balances = useMemo(() => accountBalances(state, now), [state, now])
  const trouble = balances.filter((b) => b.negative)
  const meteo = useMemo(() => weather(state, ref, now), [state, ref, now])
  const facts = useMemo(() => insights(state, ref, now), [state, ref, now])
  // Suivi et leviers se lisent a aujourd'hui : ils parlent de la suite, pas
  // du mois qu'on consulte.
  const progress = useMemo(() => progressReport(state, now), [state, now])
  const levers = useMemo(() => solutions(state, now), [state, now])

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

        <SolutionsCard list={levers} go={go} hidden={CRISIS_HIDDEN} limit={2} />

        <ProgressCard report={progress} onDetail={() => go('dettes')} />

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
  const WEATHER_ICON: Record<string, string> = {
    large: '\u2600\uFE0F', serre: '\u26C5', tendu: '\u{1F326}\uFE0F', depasse: '\u26C8\uFE0F',
  }

  return (
    <div className="stack">
      <MonthSwitcher value={month} onChange={setMonth} current={current} />

      {/* La meteo repond en trois secondes : est-ce que ce mois passe ? */}
      <section className={`weather ${meteo.level}`}>
        <span className="ico" aria-hidden>{WEATHER_ICON[meteo.level]}</span>
        <div className="txt">
          <div className="t">{meteo.title}</div>
          <div className="d">{meteo.detail}</div>
        </div>
        <div className="legs">
          <div className="leg">
            <div className="n num">{euro(meteo.projectedEnd)}</div>
            <div className="l">{pos.isPast ? 'reste final' : 'fin de mois'}</div>
          </div>
          <div className="leg">
            <div className="n num">{euro(meteo.pace)}</div>
            <div className="l">mon rythme / j</div>
          </div>
        </div>
      </section>

      {facts.length > 0 && (
        <Card title={`${pos.isPast ? 'Ce mois-la' : 'Ce mois'} en resume`}>
          <div className="insights">
            {facts.map((f) => (
              <div className={`insight ${f.tone}`} key={f.id}>
                <span className="ico" aria-hidden>{f.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{f.title}</div>
                  <div className="d">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ProgressCard report={progress} onDetail={() => go('dettes')} />

      <SolutionsCard list={levers} go={go} />

      <div>
        {/* Ces tuiles decrivent l'instant present, pas le mois consulte. */}
        <div className="section-title" style={{ marginBottom: 10 }}>
          Mon argent{!pos.isCurrent && <span style={{ textTransform: 'none', letterSpacing: 0 }}> &middot; aujourd&rsquo;hui</span>}
        </div>
        <div className="grid k3">
          <Stat
            label={state.accounts.length > 1 ? 'Solde bancaire total' : 'Solde bancaire'}
            value={euro(avail.bank)}
            hint={
              state.accounts.length > 1
                ? <button className="linkish" onClick={() => go('comptes')}>{state.accounts.length} comptes</button>
                : <button className="linkish" onClick={onBalance}>Mettre a jour</button>
            }
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

      {state.accounts.length > 1 && (
        <Card
          title="Repartition par compte"
          flush
          action={<button className="btn sm ghost" onClick={() => go('comptes')}>Gerer</button>}
        >
          <div className="list">
            {balances.map(({ account, balance, negative, breached }) => (
              <div className="item" key={account.id}>
                <span className="avatar" aria-hidden>{account.emoji}</span>
                <div className="main-col">
                  <div className="title">{account.name}</div>
                  <div className="sub">
                    {account.shared
                      ? 'Compte joint \u2014 hors solde personnel'
                      : breached
                        ? 'Au-dela du decouvert autorise'
                        : account.primary ? 'Compte principal' : 'Compte personnel'}
                  </div>
                </div>
                <span className={`amount ${negative ? 'neg' : ''}`}>{euro(balance)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {trouble.length > 0 && avail.bank >= 0 && (
        <Callout tone="critical" icon="&#9888;&#65039;" title="Un compte est dans le rouge">
          Ton total est positif, mais{' '}
          {trouble.map((t) => `${t.account.name} est a ${euro(t.balance)}`).join(' et ')}.
          Les agios se prelevent sur le compte, pas sur le total.
        </Callout>
      )}

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
            pace={pos.isCurrent ? ratio(living.paceTarget, living.budget) : undefined}
            tall
          />
        </div>

        {pos.isCurrent && (
          <div className="hero-legs" style={{ maxWidth: 460, margin: '16px auto 0' }}>
            <div>
              <div className="n num">{euro(living.perDay)}</div>
              <div className="l">encore dispo / j</div>
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
        )}

        <div className="coach">
          {pos.isPast ? (
            over
              ? <>Ce mois-la, tu as depasse l&rsquo;enveloppe de <b>{euro(living.overspent)}</b>.</>
              : <>Ce mois-la, tu as termine avec <b>{euro(living.remaining)}</b> non depenses.</>
          ) : pos.isFuture ? (
            <>Mois a venir : l&rsquo;enveloppe de <b>{euro(living.budget)}</b> est encore entiere.</>
          ) : over ? (
            <>Tu as depasse l&rsquo;enveloppe de <b>{euro(living.overspent)}</b>. Chaque euro depense
              maintenant est pris sur le mois prochain.</>
          ) : (
            <>Tu peux depenser environ <b>{euro(living.perDay)} par jour</b> jusqu&rsquo;a la fin du mois.
              {living.paceDelta >= 0
                ? ` Tu es en avance de ${euro(living.paceDelta)} sur le rythme.`
                : ` Tu depenses plus vite que le rythme du mois : la marge se resserre.`}</>
          )}
        </div>
      </section>

      <div className="quick-actions">
        <button className="btn" onClick={onExpense}>+ Nouvelle depense</button>
        <button className="btn primary" onClick={onIncome}>+ Revenu</button>
      </div>
      {state.accounts.length > 1 && (
        <button className="btn ghost block" onClick={() => go('comptes')}>
          Faire un virement entre mes comptes
        </button>
      )}

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

      <Card title={`D’ou vient le disponible${pos.isCurrent ? '' : ' — aujourd’hui'}`}>
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

  // Chaque etape se coche toute seule des que la donnee existe : on voit
  // ou on en est sans avoir a s'en souvenir.
  const steps = [
    {
      key: 'balance',
      icon: '\u{1F3E6}',
      title: 'Ton solde bancaire',
      why: 'Le point de depart de tout le calcul.',
      done: state.settings.openingBalance !== 0 || state.transactions.length > 0,
      action: onBalance,
      label: 'Saisir',
    },
    {
      key: 'obligations',
      icon: '\u{1F4C5}',
      title: 'Tes obligations',
      why: 'URSSAF, loyer, assurances, abonnements pro.',
      done: state.obligations.length > 0,
      action: () => go('obligations'),
      label: 'Ajouter',
    },
    {
      key: 'debts',
      icon: '\u{1F4C9}',
      title: 'Tes dettes',
      why: 'Credits, paiements fractionnes, decouvert.',
      done: state.debts.length > 0,
      action: () => go('dettes'),
      label: 'Ajouter',
    },
    {
      key: 'income',
      icon: '\u{1F4B0}',
      title: 'Tes revenus',
      why: 'Encaisses et a venir, meme irreguliers.',
      done: state.incomes.length > 0,
      action: onIncome,
      label: 'Ajouter',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)

  return (
    <div className="stack">
      <section className="hero">
        <div className="eyebrow">Bienvenue</div>
        <div className="big num" style={{ fontSize: 'clamp(30px, 8vw, 46px)' }}>
          Ton cockpit financier
        </div>
        <div className="outof" style={{ maxWidth: 420, margin: '8px auto 0' }}>
          Quelques minutes de mise en route, et tu sauras chaque matin ce que tu peux
          reellement depenser.
        </div>
        <div style={{ margin: '18px auto 0', maxWidth: 420 }}>
          <Bar value={doneCount} max={steps.length} tall />
          <div className="row" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{doneCount} sur {steps.length}</span>
            <span className="spacer" />
            {next && <span>prochaine etape : {next.title.toLowerCase()}</span>}
          </div>
        </div>
      </section>

      <Card title="Mise en route" flush>
        <div className="list">
          {steps.map((s, i) => (
            <div className={`setup-step ${s.done ? 'done' : ''}`} key={s.key}>
              <span className="num-badge" aria-hidden>{s.done ? '\u2713' : i + 1}</span>
              <div className="main-col">
                <div className="title">{s.icon} {s.title}</div>
                <div className="sub">{s.why}</div>
              </div>
              <button
                className={`btn sm ${s.done ? 'ghost' : 'primary'}`}
                onClick={s.action}
              >
                {s.done ? 'Completer' : s.label}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tu preferes regarder d\u2019abord ?">
        <p className="fine">
          Charge un jeu de donnees fictif pour voir le cockpit en action. Tu pourras tout
          effacer ensuite depuis les reglages.
        </p>
        <div className="quick-actions" style={{ marginTop: 12 }}>
          <button
            className="btn ghost"
            onClick={async () => {
              const { demoState } = await import('../lib/demo')
              dispatch({ type: 'replace', state: demoState() })
            }}
          >
            Voir la demonstration
          </button>
          <button className="btn ghost" onClick={() => go('reglages')}>
            Importer un releve
          </button>
        </div>
        <p className="fine" style={{ marginTop: 12 }}>
          Tes donnees restent dans ce navigateur. Budget de vie actuel :{' '}
          {euro(state.settings.livingBudget)} &mdash; modifiable dans les reglages.
        </p>
      </Card>
    </div>
  )
}
