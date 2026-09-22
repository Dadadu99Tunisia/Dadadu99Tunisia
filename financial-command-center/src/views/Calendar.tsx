import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { groupByMonth, project } from '../lib/engine'
import { euro } from '../lib/money'
import { monthLabel, shortDate, today } from '../lib/dates'
import { Callout, Card, Empty, Segmented, Stat } from '../components/ui'

const ICONS: Record<string, string> = {
  income: '\u{1F4B0}', obligation: '\u{1F4C5}', debt: '\u{1F4C9}', living: '\u{1F6D2}',
}

export function CalendarView() {
  const { state } = useStore()
  const [days, setDays] = useState(90)
  const ref = today()

  const result = useMemo(() => project(state, days, ref), [state, days, ref])
  const months = useMemo(() => groupByMonth(result.events), [result.events])

  return (
    <div className="stack">
      <Segmented
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
        ariaLabel="Horizon du calendrier"
        options={[
          { value: '30', label: '30 jours' },
          { value: '60', label: '60 jours' },
          { value: '90', label: '90 jours' },
          { value: '180', label: '6 mois' },
        ]}
      />

      <div className="grid k2">
        <Stat label="Entrees prevues" value={euro(result.totalIncome)} accent="vie" />
        <Stat
          label="Sorties prevues"
          value={euro(result.totalObligations + result.totalDebtPaid)}
          accent="obligations"
          hint="obligations + dettes"
        />
      </div>

      {result.firstNegative ? (
        <Callout tone="critical" icon="&#9888;&#65039;" title="Ta tresorerie passe sous zero">
          Le {shortDate(result.firstNegative)}, si rien ne change. Point le plus bas :{' '}
          {euro(result.lowest.cash)} le {shortDate(result.lowest.date)}.
        </Callout>
      ) : (
        <Callout tone="good" icon="&#9989;" title="Aucun trou de tresorerie prevu">
          Ton point le plus bas sur la periode est {euro(result.lowest.cash)} le{' '}
          {shortDate(result.lowest.date)}.
        </Callout>
      )}

      <Card title="Fil des echeances" flush>
        {months.length === 0 ? (
          <Empty icon="&#128197;">Aucun evenement sur cette periode.</Empty>
        ) : (
          <div className="timeline">
            {months.map(({ key, rows }) => (
              <div key={key}>
                <div className="month-head">{monthLabel(key)}</div>
                {rows.map((e, i) => (
                  <div
                    className={`tl-item ${e.kind} ${e.balanceAfter < 0 ? 'danger' : ''}`}
                    key={`${e.date}-${i}`}
                  >
                    <span className="date">{shortDate(e.date)}</span>
                    <span className="rail"><i /></span>
                    <span className="lbl">
                      <span aria-hidden style={{ marginRight: 6 }}>{ICONS[e.kind]}</span>
                      {e.label}
                      {!e.certain && <span className="fine"> &middot; a confirmer</span>}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <span className={`amt ${e.amount > 0 ? 'pos' : ''}`}>
                        {e.amount > 0 ? '+' : '−'} {euro(Math.abs(e.amount))}
                      </span>
                      <div className="bal">solde {euro(e.balanceAfter)}</div>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="fine">
        Le solde affiche integre aussi ton budget de vie, etale jour par jour. C&rsquo;est pour
        cela qu&rsquo;il baisse meme les jours sans echeance.
      </p>
    </div>
  )
}
