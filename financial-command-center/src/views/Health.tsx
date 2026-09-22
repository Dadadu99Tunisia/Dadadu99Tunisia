import { useMemo } from 'react'
import { useStore } from '../store'
import { crisisState, healthReport } from '../lib/engine'
import { Bar, Badge, Callout, Card } from '../components/ui'
import { today } from '../lib/dates'
import { bandTone } from './Dashboard'

export function Health() {
  const { state } = useStore()
  const ref = today()
  const health = useMemo(() => healthReport(state, ref), [state, ref])
  const crisis = useMemo(() => crisisState(state, ref), [state, ref])

  return (
    <div className="stack">
      <section className="hero">
        <div className="eyebrow">Situation financiere</div>
        <div className="big num" style={{ fontSize: 'clamp(40px, 12vw, 64px)' }}>{health.score}</div>
        <div className="outof">sur 100</div>
        <div style={{ margin: '14px auto 0', maxWidth: 420 }}>
          <Bar
            value={health.score}
            max={100}
            tone={health.band === 'critique' ? 'over' : health.band === 'a_stabiliser' ? 'obligations' : ''}
            tall
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Badge tone={bandTone(health.band)}>{health.label}</Badge>
        </div>
        <div className="coach">
          Ce score ne juge pas tes choix. Il mesure six faits objectifs, et chacun se corrige
          par une action precise.
        </div>
      </section>

      {crisis.active && (
        <Callout tone="warn" icon="&#128680;" title="Mode stabilisation actif">
          {crisis.auto
            ? 'Il s’active seul tant qu’un signal est au rouge.'
            : 'Tu l’as active manuellement dans les reglages.'}
        </Callout>
      )}

      <Card title="Le detail, facteur par facteur" flush>
        <div className="list">
          {health.factors.map((f) => (
            <div className="item" key={f.key} style={{ alignItems: 'flex-start' }}>
              <span className="avatar" aria-hidden>{f.ok ? '✅' : '⚠️'}</span>
              <div className="main-col">
                <div className="title">{f.label}</div>
                <div className="sub" style={{ whiteSpace: 'normal', marginTop: 2 }}>{f.detail}</div>
                <div style={{ marginTop: 8, maxWidth: 220 }}>
                  <Bar value={f.score} max={f.max} tone={f.ok ? '' : 'obligations'} />
                </div>
              </div>
              <span className="amount num">{f.score}/{f.max}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Comment lire ce score">
        <p className="fine">
          <b>Moins de 35</b> &mdash; sous tension : un signal vital est au rouge (decouvert,
          impayes, engagements superieurs au solde).
        </p>
        <p className="fine" style={{ marginTop: 8 }}>
          <b>35 a 54</b> &mdash; a stabiliser : la situation tient mais sans marge.
        </p>
        <p className="fine" style={{ marginTop: 8 }}>
          <b>55 a 74</b> &mdash; en progression : les bases sont la, l&rsquo;epargne ou les
          dettes restent a travailler.
        </p>
        <p className="fine" style={{ marginTop: 8 }}>
          <b>75 et plus</b> &mdash; stable : tresorerie saine, obligations a jour, coussin
          constitue.
        </p>
      </Card>
    </div>
  )
}
