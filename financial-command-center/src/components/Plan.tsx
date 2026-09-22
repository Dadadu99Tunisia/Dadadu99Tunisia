import { useState } from 'react'
import type { ProgressReport, Solution } from '../lib/engine'
import type { View } from '../Nav'
import { Bar, Card, Empty } from './ui'

/** Une mesure qui progresse se lit mieux en vert ; une alerte, en orange. */
const BAR_TONE: Record<string, '' | 'obligations' | 'epargne'> = {
  good: '',
  warn: 'obligations',
  info: 'epargne',
}

const EFFORT_LABEL: Record<Solution['effort'], string> = {
  maintenant: 'aujourd’hui',
  ce_mois: 'ce mois-ci',
  duree: 'dans la duree',
}

/**
 * Le suivi : dans quel sens ca va, pas seulement ou j'en suis.
 * Sans cette carte, un tableau de bord qui ne montre que l'instant present
 * donne l'impression que rien ne bouge, meme quand tout bouge.
 */
export function ProgressCard({ report, onDetail }: { report: ProgressReport; onDetail?: () => void }) {
  if (report.metrics.length === 0) return null
  return (
    <Card
      title="Ou j&rsquo;en suis"
      flush
      action={onDetail && <button className="btn sm ghost" onClick={onDetail}>Detail</button>}
    >
      <div className="list">
        {report.metrics.map((m) => (
          <div className="track" key={m.key}>
            <span className="avatar" aria-hidden>{m.icon}</span>
            <div className="body">
              <div className="head">
                <span className="n raw">{m.label}</span>
                <span className="spacer" />
                <span className="v num">{m.value}</span>
              </div>
              {m.pct !== null && (
                <div className="line-bar">
                  <Bar value={m.pct * 100} max={100} tone={BAR_TONE[m.tone]} />
                  <span className="p num">{Math.round(m.pct * 100)} %</span>
                </div>
              )}
              <div className="d">{m.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * Les leviers, tries par ce qui change le plus.
 * Chacun dit pourquoi il est vrai, ce qu'il rapporte et ou agir : une
 * solution sans chiffre ni bouton n'est qu'un conseil de plus.
 */
export function SolutionsCard({
  list, go, hidden, limit = 3,
}: {
  list: Solution[]
  go: (v: View) => void
  /** Vues masquees (mode stabilisation) : pas de bouton qui ne mene nulle part. */
  hidden?: View[]
  limit?: number
}) {
  const [all, setAll] = useState(false)
  const shown = all ? list : list.slice(0, limit)
  const rest = list.length - shown.length

  return (
    <Card title="Ce qui debloque le plus">
      {list.length === 0 ? (
        <Empty icon="&#129504;">
          Rien a proposer pour l&rsquo;instant : ajoute tes revenus, tes obligations et tes
          dettes pour que le cockpit puisse chiffrer des leviers.
        </Empty>
      ) : (
        <>
          <div className="levers">
            {shown.map((s) => {
              const target = s.target as View | undefined
              const canGo = target && !hidden?.includes(target)
              return (
                <article className={`lever ${s.tone}`} key={s.id}>
                  <span className="ico" aria-hidden>{s.icon}</span>
                  <div className="body">
                    <div className="t">{s.title}</div>
                    <p className="why">{s.why}</p>
                    <div className="foot">
                      <span className="gain num">{s.gain}</span>
                      <span className="effort">{EFFORT_LABEL[s.effort]}</span>
                      <span className="spacer" />
                      {canGo && (
                        <button className="btn sm ghost" onClick={() => go(target)}>
                          {s.cta || 'Ouvrir'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {(rest > 0 || all) && (
            <button className="btn sm ghost block" style={{ marginTop: 12 }} onClick={() => setAll(!all)}>
              {all ? 'Afficher moins' : `Voir ${rest} levier(s) de plus`}
            </button>
          )}
        </>
      )}
    </Card>
  )
}
