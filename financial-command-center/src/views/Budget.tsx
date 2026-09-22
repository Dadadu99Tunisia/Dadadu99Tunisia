import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { TX_CATEGORY_EMOJI, TX_CATEGORY_LABELS, LIVING_CATEGORIES } from '../types'
import type { TxCategory } from '../types'
import { categoryBreakdown, monthPosition } from '../lib/engine'
import { euro, parseAmount } from '../lib/money'
import { monthLabel, today } from '../lib/dates'
import { Bar, Callout, Card, Empty, Stat } from '../components/ui'
import { MonthSwitcher } from '../components/MonthSwitcher'
import { useToast } from '../components/Toast'

/** Repartition proposee de l'enveloppe, utile pour demarrer sans page blanche. */
const PRESETS: { label: string; hint: string; split: Partial<Record<TxCategory, number>> }[] = [
  {
    label: 'Equilibre',
    hint: 'Un peu de tout, sans se priver',
    split: { alimentation: 0.3, restaurant: 0.12, shopping: 0.2, transport: 0.12, loisirs: 0.1, sante: 0.06, autre: 0.1 },
  },
  {
    label: 'Sobre',
    hint: 'Priorite a l’essentiel',
    split: { alimentation: 0.4, restaurant: 0.07, shopping: 0.1, transport: 0.15, loisirs: 0.08, sante: 0.1, autre: 0.1 },
  },
  {
    label: 'Sorties',
    hint: 'De la place pour la vie sociale',
    split: { alimentation: 0.26, restaurant: 0.22, shopping: 0.14, transport: 0.12, loisirs: 0.16, sante: 0.05, autre: 0.05 },
  },
]

export function Budget() {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  const ref = today()
  const current = ref.slice(0, 7)
  const [month, setMonth] = useState(current)

  const pos = monthPosition(month, ref)
  const b = useMemo(() => categoryBreakdown(state, month), [state, month])
  const budgets = state.settings.categoryBudgets || {}

  function setBudget(category: TxCategory, raw: string) {
    const v = parseAmount(raw)
    const next = { ...budgets }
    if (!Number.isFinite(v) || v <= 0) delete next[category]
    else next[category] = v
    dispatch({ type: 'settings', patch: { categoryBudgets: next } })
  }

  function applyPreset(split: Partial<Record<TxCategory, number>>) {
    const previous = { ...budgets }
    const next: Partial<Record<TxCategory, number>> = {}
    for (const [cat, share] of Object.entries(split)) {
      next[cat as TxCategory] = Math.round(state.settings.livingBudget * (share as number))
    }
    dispatch({ type: 'settings', patch: { categoryBudgets: next } })
    notify('Repartition appliquee.', {
      tone: 'good',
      undo: () => dispatch({ type: 'settings', patch: { categoryBudgets: previous } }),
    })
  }

  const rows = b.rows.filter((r) => r.planned > 0 || r.actual > 0)
  const unallocated = b.unallocated

  return (
    <div className="stack">
      <MonthSwitcher value={month} onChange={setMonth} current={current} />

      <div className="grid k3">
        <Stat label="Enveloppe de vie" value={euro(b.budget)} accent="vie" hint="par mois" />
        <Stat
          label="Reparti"
          value={euro(b.plannedTotal)}
          accent={Math.abs(unallocated) < 1 ? 'vie' : 'obligations'}
          hint={
            Math.abs(unallocated) < 1
              ? 'tout est affecte'
              : unallocated > 0 ? `${euro(unallocated)} non affectes` : `${euro(-unallocated)} de trop`
          }
        />
        <Stat
          label={pos.isFuture ? 'Depense (a venir)' : 'Depense'}
          value={euro(b.actualTotal)}
          accent={b.actualTotal > b.budget ? 'dettes' : 'epargne'}
          hint={monthLabel(month)}
        />
      </div>

      {b.plannedTotal === 0 && (
        <Card title="Par ou commencer">
          <p className="fine" style={{ marginBottom: 14 }}>
            Repartis tes {euro(b.budget)} entre les categories du quotidien. Tu verras ensuite,
            chaque mois, quelle enveloppe deborde et laquelle te laisse de la marge.
          </p>
          <div className="grid k3">
            {PRESETS.map((p) => (
              <button className="preset" key={p.label} onClick={() => applyPreset(p.split)}>
                <span className="n">{p.label}</span>
                <span className="h">{p.hint}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={`Mes enveloppes — ${monthLabel(month)}`}
        flush
        action={<span className="fine">depense / prevu &middot; enveloppe</span>}
      >
        {rows.length === 0 ? (
          <Empty icon="&#129534;">
            Aucune enveloppe definie ni depense enregistree sur ce mois.
          </Empty>
        ) : (
          <div className="list">
            {rows.map((r) => {
              const over = r.planned > 0 && r.delta < 0
              return (
                <div className="cat-row" key={r.category}>
                  <span className="ico" aria-hidden>{TX_CATEGORY_EMOJI[r.category]}</span>
                  <div className="body">
                    <div className="head">
                      <span className="n">{TX_CATEGORY_LABELS[r.category]}</span>
                      <span className="spacer" />
                      <span className="v">{euro(r.actual)}</span>
                      {r.planned > 0 && <span className="p">/ {euro(r.planned)}</span>}
                    </div>
                    <div className="foot">
                      <Bar
                        value={r.actual}
                        max={r.planned || r.actual || 1}
                        tone={over ? 'over' : r.planned === 0 ? 'obligations' : ''}
                      />
                      {r.planned > 0 ? (
                        <span className={`delta ${over ? 'over' : 'ok'}`}>
                          {over ? `+ ${euro(-r.delta)}` : `${euro(r.delta)} restants`}
                        </span>
                      ) : (
                        <span className="delta">{Math.round(r.share * 100)} %</span>
                      )}
                    </div>
                  </div>
                  <input
                    className="budget-input"
                    inputMode="decimal"
                    defaultValue={r.planned > 0 ? String(r.planned).replace('.', ',') : ''}
                    placeholder="—"
                    aria-label={`Enveloppe ${TX_CATEGORY_LABELS[r.category]}`}
                    onBlur={(e) => setBudget(r.category, e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card title="Ajouter une enveloppe">
        <div className="chips">
          {LIVING_CATEGORIES.filter((c) => !((budgets[c] ?? 0) > 0) && !rows.some((r) => r.category === c)).map((c) => (
            <button
              key={c}
              className="chip"
              onClick={() => setBudget(c, String(Math.max(20, Math.round(unallocated > 0 ? unallocated : 50))))}
            >
              {TX_CATEGORY_EMOJI[c]} {TX_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        {LIVING_CATEGORIES.every((c) => (budgets[c] ?? 0) > 0 || rows.some((r) => r.category === c)) && (
          <p className="fine" style={{ margin: 0 }}>Toutes les categories du quotidien ont une enveloppe.</p>
        )}
      </Card>

      {unallocated < 0 && (
        <Callout tone="warn" icon="&#9888;&#65039;" title="Tes enveloppes depassent ton budget de vie">
          La somme de tes enveloppes fait {euro(b.plannedTotal)} pour un budget de{' '}
          {euro(b.budget)}. Soit tu reduis une enveloppe, soit tu montes le budget dans les
          reglages &mdash; mais alors il faut que le revenu suive.
        </Callout>
      )}

      <p className="fine">
        Ces enveloppes ne bloquent rien : elles servent de repere. Le seul plafond ferme
        reste ton budget de vie de {euro(b.budget)}.
      </p>
    </div>
  )
}
