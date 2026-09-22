import { useState } from 'react'
import type { GoalEffort, GoalForecast, ProgressReport, Solution } from '../lib/engine'
import type { View } from '../Nav'
import { Bar, Card, Empty, Segmented } from './ui'
import { euro } from '../lib/money'
import { longDate } from '../lib/dates'

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

/**
 * La date de l'objectif, et ce qui la deplace.
 * Une date sans hypothese n'aide pas : on montre la capacite du mois, celle
 * dans un an quand des credits sont soldes, et l'effet d'un revenu en plus.
 */
export function GoalTimingCard({
  forecast, extra, onExtra, wanted, onWanted, effort, go,
}: {
  forecast: GoalForecast
  extra: number
  onExtra: (v: number) => void
  /** Mois vise, au format 'YYYY-MM' ; vide tant qu'aucune date n'est visee. */
  wanted: string
  onWanted: (v: string) => void
  effort?: GoalEffort
  go: (v: View) => void
}) {
  const { goal, date, months, capacityNow, capacitySoon, missing, income } = forecast
  return (
    <Card
      title={`Quand ${goal.name} ?`}
      action={<button className="btn sm ghost" onClick={() => go('epargne')}>Objectifs</button>}
    >
      <div className={`goal-when ${date ? '' : 'none'}`}>
        <div className="when">
          <div className="big num">{date ? longDate(date) : 'Pas de date'}</div>
          <div className="sub">
            {date
              ? capacityNow > 0
                ? `dans ${months} mois, au rythme que tes finances permettent`
                : `dans ${months} mois : rien ce mois-ci, puis de plus en plus a mesure que les credits se soldent`
              : 'rien ne reste a mettre de cote chaque mois'}
          </div>
        </div>
        <div className="legs">
          <div className="leg">
            <div className="n num">{euro(capacityNow)}</div>
            <div className="l">ce mois-ci</div>
          </div>
          <div className="leg">
            <div className="n num">{euro(capacitySoon)}</div>
            <div className="l">dans un an</div>
          </div>
          <div className="leg">
            <div className="n num">{euro(missing)}</div>
            <div className="l">a trouver</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Bar value={goal.current} max={goal.target} tone="epargne" tall />
        <div className="row" style={{ marginTop: 7 }}>
          <span className="fine">{euro(goal.current)} mis de cote</span>
          <span className="spacer" />
          <span className="fine">objectif {euro(goal.target)}</span>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>Et si je gagnais plus ?</div>
        <Segmented
          value={String(extra)}
          ariaLabel="Revenu mensuel supplementaire simule"
          options={EXTRA_OPTIONS}
          onChange={(v) => onExtra(Number(v))}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>Je la veux pour&hellip;</div>
        <div className="row">
          <input
            className="month-input"
            type="month"
            value={wanted}
            aria-label="Mois vise"
            onChange={(e) => onWanted(e.target.value)}
          />
          {wanted && (
            <button className="btn sm ghost" onClick={() => onWanted('')}>Effacer</button>
          )}
        </div>
        {effort && <EffortLine effort={effort} />}
      </div>

      <p className="fine" style={{ marginTop: 12 }}>
        Calcul mois par mois sur {euro(income)} de revenu mensuel : obligations, enveloppe de
        vie, mensualites de dettes et provisions lissees deduites. Chaque credit solde en cours
        de route augmente ce qui reste. Un revenu supplementaire se compte net de cotisations,
        et une depense au-dela de l&rsquo;enveloppe recule la date.
      </p>
    </Card>
  )
}

const EXTRA_OPTIONS = [
  { value: '0', label: 'Aujourd’hui' },
  { value: '500', label: '+500 €' },
  { value: '1000', label: '+1 000 €' },
  { value: '2000', label: '+2 000 €' },
]

/** Ce que coute une date voulue : un chiffre, pas un encouragement. */
function EffortLine({ effort }: { effort: GoalEffort }) {
  const { extraIncome, savedWithout, shortfall, months } = effort
  if (extraIncome === 0) {
    return (
      <p className="effort-line ok">
        Cette date tient deja : {euro(savedWithout)} seront mis de cote d&rsquo;ici la.
      </p>
    )
  }
  if (extraIncome === null) {
    return (
      <p className="effort-line no">
        Meme avec un revenu hors de portee, cette date ne tient pas : les obligations et les
        mensualites absorbent tout sur ces {months} mois.
      </p>
    )
  }
  return (
    <p className="effort-line">
      Il faudrait <b className="num">{euro(extraIncome)}</b> de revenu en plus chaque mois,
      net de cotisations, pendant {months} mois. Sans rien changer, tu auras{' '}
      <b className="num">{euro(savedWithout)}</b> a cette date : il manquerait{' '}
      <b className="num">{euro(shortfall)}</b>.
    </p>
  )
}
