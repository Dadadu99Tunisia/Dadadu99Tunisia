import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { behaviourComparison } from '../lib/engine'
import { TX_CATEGORY_LABELS } from '../types'
import type { TxCategory } from '../types'
import { euro, ratio } from '../lib/money'
import { monthKey, monthLabel, previousMonthKey, today } from '../lib/dates'
import { Bar, Card, Empty, Stat } from '../components/ui'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { refForMonth } from '../lib/engine'

export function Habits() {
  const { state } = useStore()
  const now = today()
  const current = monthKey(now)
  const [month, setMonth] = useState(current)
  const ref = refForMonth(month, now)
  const c = useMemo(() => behaviourComparison(state, ref), [state, ref])
  const key = month
  const max = c.current.byCategory[0]?.amount ?? 1

  return (
    <div className="stack">
      <MonthSwitcher value={month} onChange={setMonth} current={current} />

      <Card title={monthLabel(key)}>
        <div className="grid k3">
          <Stat label="Depenses" value={euro(c.current.spent)} accent="vie" hint={<Delta v={c.deltaSpent} invert />} />
          <Stat label="Nombre d'achats" value={String(c.current.count)} hint={<Delta v={c.deltaCount} invert />} />
          <Stat label="Panier moyen" value={euro(c.current.average)} hint={<Delta v={c.deltaAverage} invert />} />
        </div>
        <div className="grid k3" style={{ marginTop: 12 }}>
          <Stat label="Shopping" value={euro(c.current.shopping)} accent="obligations" />
          <Stat label="Restaurants" value={euro(c.current.restaurant)} accent="obligations" />
          <Stat label="Paiements fractionnes" value={euro(c.current.split)} accent="dettes" />
        </div>
        <p className="fine" style={{ marginTop: 12 }}>
          Compare a {monthLabel(previousMonthKey(key))} : {euro(c.previous.spent)} depenses en{' '}
          {c.previous.count} achat(s).
        </p>
      </Card>

      <Card title="Ou part ton enveloppe de vie" flush>
        {c.current.byCategory.length === 0 ? (
          <Empty icon="&#128202;">Aucune depense ce mois-ci.</Empty>
        ) : (
          <div className="list">
            {c.current.byCategory.map((row) => (
              <div className="item" key={row.category} style={{ alignItems: 'flex-start' }}>
                <div className="main-col">
                  <div className="row">
                    <span className="title">{TX_CATEGORY_LABELS[row.category as TxCategory] ?? row.category}</span>
                    <span className="spacer" />
                    <span className="amount">{euro(row.amount)}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Bar value={row.amount} max={max} />
                  </div>
                  <div className="sub" style={{ marginTop: 5 }}>
                    {Math.round(ratio(row.amount, c.current.spent || 1) * 100)} % de tes depenses du mois
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="fine">
        Ces chiffres ne sont pas la pour te juger. Ils servent a reperer le poste qui,
        chaque mois, fait la difference entre une enveloppe tenue et une enveloppe depassee.
      </p>
    </div>
  )
}

/** Une variation : en depense, une baisse est une bonne nouvelle. */
function Delta({ v, invert }: { v: number; invert?: boolean }) {
  if (!Number.isFinite(v) || v === 0) return <>stable</>
  const up = v > 0
  const good = invert ? !up : up
  return (
    <span style={{ color: good ? 'var(--vie)' : 'var(--dettes)' }}>
      {up ? '↑' : '↓'} {Math.abs(Math.round(v * 100))} % vs mois dernier
    </span>
  )
}
