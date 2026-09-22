import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { project } from '../lib/engine'
import { euro } from '../lib/money'
import { shortDate, today } from '../lib/dates'
import { Callout, Card, Segmented, Stat } from '../components/ui'
import { ProjectionChart, ProjectionTable, SERIES } from '../components/Chart'

export function Projection() {
  const { state } = useStore()
  const [days, setDays] = useState(90)
  const [showTable, setShowTable] = useState(false)
  const ref = today()

  const r = useMemo(() => project(state, days, ref), [state, days, ref])

  return (
    <div className="stack">
      <Segmented
        value={String(days)}
        onChange={(v) => setDays(Number(v))}
        ariaLabel="Horizon de projection"
        options={[
          { value: '30', label: '30 j' },
          { value: '60', label: '60 j' },
          { value: '90', label: '90 j' },
          { value: '180', label: '6 mois' },
        ]}
      />

      <div className="grid k3">
        <Stat label="Tresorerie a terme" value={euro(r.endCash)} accent={r.endCash >= 0 ? 'vie' : 'critical'} />
        <Stat label="Dettes a terme" value={euro(r.endDebt)} accent="dettes" hint={`− ${euro(r.totalDebtPaid)}`} />
        <Stat label="Epargne a terme" value={euro(r.endSavings)} accent="epargne" />
      </div>

      <Card title="Evolution projetee">
        <ProjectionChart points={r.points} series={SERIES} />
        <button className="btn sm ghost block" style={{ marginTop: 14 }} onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Masquer le tableau' : 'Voir les chiffres'}
        </button>
        {showTable && (
          <div style={{ marginTop: 14 }}>
            <ProjectionTable points={r.points} series={SERIES} />
          </div>
        )}
      </Card>

      {r.firstNegative && (
        <Callout tone="critical" icon="&#9888;&#65039;" title="Passage en negatif prevu">
          Le {shortDate(r.firstNegative)}. Point le plus bas : {euro(r.lowest.cash)} le{' '}
          {shortDate(r.lowest.date)}.
        </Callout>
      )}

      <Card title="Ce que la projection additionne">
        <div className="calc">
          <Row label="Revenus attendus" value={r.totalIncome} />
          <Row label="Obligations" value={-r.totalObligations} />
          <Row label="Remboursements de dettes" value={-r.totalDebtPaid} />
          <Row label="Budget de vie" value={-r.totalLiving} />
          <div className="line total">
            <span className="lbl">Variation de tresorerie</span>
            <span className="spacer" />
            <span className="v num">
              {euro(r.totalIncome - r.totalObligations - r.totalDebtPaid - r.totalLiving)}
            </span>
          </div>
        </div>
        <p className="fine" style={{ marginTop: 12 }}>
          En fin de mois, tout ce qui depasse ton coussin de {euro(state.settings.safetyBuffer)}{' '}
          est bascule vers l&rsquo;epargne : c&rsquo;est ce qui fait monter la courbe bleue-verte.
          Les revenus marques &laquo; prevu &raquo; sont inclus : la projection est un plan, pas
          une promesse.
        </p>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="line">
      <span className="lbl">{label}</span>
      <span className="spacer" />
      <span className="v num">{value < 0 ? `− ${euro(-value)}` : euro(value)}</span>
    </div>
  )
}
