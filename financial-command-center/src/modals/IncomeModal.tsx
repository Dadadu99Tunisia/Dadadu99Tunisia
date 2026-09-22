import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Income, IncomeStatus, IncomeType } from '../types'
import { incomeCascade, suggestAllocation } from '../lib/engine'
import { euro, parseAmount } from '../lib/money'
import { today } from '../lib/dates'
import { uid } from '../lib/storage'
import { AmountInput, Callout, ConfirmButton, Field, Modal, Segmented, Switch, useAmount } from '../components/ui'

const TYPES: { value: IncomeType; label: string }[] = [
  { value: 'mission', label: 'Mission' },
  { value: 'acompte', label: 'Acompte' },
  { value: 'prime', label: 'Prime' },
  { value: 'aide', label: 'Aide' },
  { value: 'autre', label: 'Autre' },
]

export function IncomeModal({ onClose, initial }: { onClose: () => void; initial?: Income }) {
  const { dispatch } = useStore()
  const amount = useAmount(initial ? String(initial.amount).replace('.', ',') : '')
  const [client, setClient] = useState(initial?.client ?? '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [type, setType] = useState<IncomeType>(initial?.type ?? 'mission')
  const [status, setStatus] = useState<IncomeStatus>(initial?.status ?? 'prevu')
  const [recurring, setRecurring] = useState(!!initial?.recurring)
  const [allocate, setAllocate] = useState(false)

  const income: Income | null = amount.valid
    ? {
      id: initial?.id ?? uid(),
      date, client: client.trim(), amount: amount.value, type, status,
      recurring: recurring || undefined,
      allocation: initial?.allocation,
    }
    : null

  function save() {
    if (!income) return
    dispatch({ type: 'income/upsert', income })
    // Un encaissement pose tout de suite la question : que fait-on de cet argent ?
    if (status === 'encaisse' && initial?.status !== 'encaisse') setAllocate(true)
    else onClose()
  }

  if (allocate && income) {
    return <AllocationModal income={income} onClose={onClose} />
  }

  return (
    <Modal
      title={initial ? 'Modifier le revenu' : 'Nouveau revenu'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'income/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!amount.valid} onClick={save}>
            {status === 'encaisse' ? 'Encaisser' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <Field label="Montant encaisse">
        <AmountInput value={amount.raw} onChange={amount.setRaw} autoFocus placeholder="5 000" />
      </Field>

      <Field label="Client">
        <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nom du client" />
      </Field>

      <div className="field-row">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as IncomeType)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Statut">
        <Segmented
          value={status}
          onChange={setStatus}
          ariaLabel="Statut du revenu"
          options={[
            { value: 'prevu', label: 'Prevu' },
            { value: 'facture', label: 'Facture' },
            { value: 'encaisse', label: 'Encaisse' },
          ]}
        />
      </Field>

      <Switch
        checked={recurring}
        onChange={setRecurring}
        label="Revenu recurrent chaque mois (utilise pour la projection)"
      />

      {status !== 'encaisse' && (
        <p className="fine">
          Un revenu prevu ou facture n&rsquo;entre pas dans ton solde : il apparait dans le
          calendrier et la projection, pas dans ton disponible.
        </p>
      )}
    </Modal>
  )
}

/**
 * "Que veux-tu faire de cet argent ?"
 * La cascade appliquee a un encaissement, ajustable a la main.
 */
export function AllocationModal({ income, onClose }: { income: Income; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const suggested = useMemo(() => suggestAllocation(state, income.amount, income.date), [state, income])
  const cascade = useMemo(() => incomeCascade(state, income.amount, income.date), [state, income])

  const [obligations, setObligations] = useState(String(suggested.obligations).replace('.', ','))
  const [vie, setVie] = useState(String(suggested.vie).replace('.', ','))
  const [dettes, setDettes] = useState(String(suggested.dettes).replace('.', ','))
  const [epargne, setEpargne] = useState(String(suggested.epargne).replace('.', ','))
  const [goalId, setGoalId] = useState(state.savingsGoals[0]?.id ?? '')

  const n = (s: string) => (Number.isFinite(parseAmount(s)) ? parseAmount(s) : 0)
  const total = n(obligations) + n(vie) + n(dettes) + n(epargne)
  const diff = Math.round((income.amount - total) * 100) / 100

  function confirm() {
    dispatch({
      type: 'income/upsert',
      income: {
        ...income,
        allocation: {
          obligations: n(obligations), vie: n(vie), dettes: n(dettes), epargne: n(epargne),
        },
      },
    })
    // Seule la part epargne est un mouvement reel : elle quitte le compte courant.
    if (n(epargne) > 0 && goalId) {
      dispatch({ type: 'goal/deposit', id: goalId, amount: n(epargne), date: income.date })
    }
    onClose()
  }

  return (
    <Modal
      title="Que veux-tu faire de cet argent ?"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Plus tard</button>
          <button className="btn primary" onClick={confirm}>Valider la repartition</button>
        </>
      }
    >
      <div className="casc-step in big">
        <div className="casc-row">
          <span className="l">Encaisse</span>
          <span className="v">{euro(income.amount)}</span>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <AllocRow color="obligations" label="Obligations" hint="URSSAF, impots, charges a echeance sous 60 jours" value={obligations} onChange={setObligations} />
        <AllocRow color="vie" label="Vie" hint={`Enveloppe de ${euro(state.settings.livingBudget)} du mois`} value={vie} onChange={setVie} />
        <AllocRow color="dettes" label="Dettes" hint="Mensualites du mois" value={dettes} onChange={setDettes} />
        <AllocRow color="epargne" label="Epargne" hint="Le reste, reellement disponible" value={epargne} onChange={setEpargne} />
      </div>

      {n(epargne) > 0 && (
        <Field label="Vers quel objectif d&rsquo;epargne ?">
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            {state.savingsGoals.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
            ))}
          </select>
        </Field>
      )}

      {Math.abs(diff) > 0.009 && (
        <Callout tone={diff > 0 ? 'info' : 'warn'} icon={diff > 0 ? 'ℹ️' : '⚠️'}>
          {diff > 0
            ? `Il reste ${euro(diff)} non affectes.`
            : `Tu repartis ${euro(-diff)} de plus que le montant encaisse.`}
        </Callout>
      )}

      <div className="card" style={{ background: 'var(--bg)' }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Pourquoi cette proposition</div>
        {cascade.reasons.map((r, i) => (
          <p key={i} className="fine" style={{ marginTop: i ? 6 : 0 }}>&bull; {r}</p>
        ))}
      </div>

      <p className="fine">
        Les parts obligations et dettes sont un guide d&rsquo;action : elles restent sur ton compte
        jusqu&rsquo;a ce que tu regles la ligne correspondante. Seule la part epargne est
        deplacee tout de suite.
      </p>
    </Modal>
  )
}

function AllocRow({
  color, label, hint, value, onChange,
}: {
  color: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="alloc-row">
      <span className="dot" style={{ background: `var(--${color})` }} aria-hidden />
      <div className="txt">
        <div className="l">{label}</div>
        <div className="h">{hint}</div>
      </div>
      <input className="num-input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
