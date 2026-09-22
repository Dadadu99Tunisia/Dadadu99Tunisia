import { useState } from 'react'
import { euro, euroShort, ratio } from '../lib/money'
import { monthLabel } from '../lib/dates'

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'avr', 'mai', 'juin', 'juil', 'aou', 'sep', 'oct', 'nov', 'dec']

/**
 * Epargne mise de cote mois par mois.
 * Une seule serie : pas de legende, la valeur se lit au survol et la moyenne
 * est tracee en repere. Un tableau de repli accompagne toujours le graphique.
 */
export function SavingsBars({
  data, average,
}: {
  data: { key: string; amount: number }[]
  average: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(average, ...data.map((d) => d.amount), 1)

  return (
    <div className="bars">
      <div className="bars-plot">
        {average > 0 && (
          <div className="avg" style={{ bottom: `${ratio(average, max) * 100}%` }}>
            <span>moyenne {euroShort(average)}</span>
          </div>
        )}
        {data.map((d) => {
          const month = Number(d.key.slice(5, 7)) - 1
          const active = hover === d.key
          return (
            <div
              className={`bar-col ${active ? 'on' : ''}`}
              key={d.key}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="track">
                <div
                  className={`fill ${d.amount === 0 ? 'zero' : ''}`}
                  style={{ height: `${Math.max(d.amount > 0 ? 3 : 0, ratio(d.amount, max) * 100)}%` }}
                />
              </div>
              <span className="tick">{MONTHS_SHORT[month]}</span>
              {active && (
                <div className="bar-tip">
                  <b>{euro(d.amount)}</b>
                  <span>{monthLabel(d.key)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
