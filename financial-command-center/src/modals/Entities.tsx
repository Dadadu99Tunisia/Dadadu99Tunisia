import { useRef, useState } from 'react'
import { useStore } from '../store'
import { OBLIGATION_CATEGORY_LABELS, DEBT_KIND_LABELS } from '../types'
import type { Debt, DebtKind, DebtPriority, Obligation, ObligationCategory, Recurrence, SavingsGoal } from '../types'
import { euro } from '../lib/money'
import { today } from '../lib/dates'
import { uid } from '../lib/storage'
import { AmountInput, Callout, ConfirmButton, Field, Modal, Segmented, useAmount } from '../components/ui'
import { prepareImage } from '../lib/image'

const OBL_CATS = Object.keys(OBLIGATION_CATEGORY_LABELS) as ObligationCategory[]
const DEBT_KINDS = Object.keys(DEBT_KIND_LABELS) as DebtKind[]

export function ObligationModal({ onClose, initial }: { onClose: () => void; initial?: Obligation }) {
  const { dispatch } = useStore()
  const amount = useAmount(initial ? String(initial.amount).replace('.', ',') : '')
  const [name, setName] = useState(initial?.name ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? today())
  const [category, setCategory] = useState<ObligationCategory>(initial?.category ?? 'urssaf')
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'monthly')

  function save() {
    if (!amount.valid || !name.trim()) return
    dispatch({
      type: 'obligation/upsert',
      obligation: {
        id: initial?.id ?? uid(),
        name: name.trim(),
        amount: amount.value,
        dueDate,
        category,
        recurrence,
        status: initial?.status ?? 'a_payer',
        paidAt: initial?.paidAt,
      },
    })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier l’obligation' : 'Nouvelle obligation'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'obligation/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!amount.valid || !name.trim()} onClick={save}>Enregistrer</button>
        </>
      }
    >
      <Field label="Nom">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="URSSAF, loyer, assurance&hellip;" autoFocus />
      </Field>
      <div className="field-row">
        <Field label="Montant">
          <AmountInput value={amount.raw} onChange={amount.setRaw} />
        </Field>
        <Field label="Echeance">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Categorie">
        <select value={category} onChange={(e) => setCategory(e.target.value as ObligationCategory)}>
          {OBL_CATS.map((c) => <option key={c} value={c}>{OBLIGATION_CATEGORY_LABELS[c]}</option>)}
        </select>
      </Field>
      <Field label="Recurrence" hint="Une obligation recurrente reapparait automatiquement une fois reglee.">
        <Segmented
          value={recurrence}
          onChange={setRecurrence}
          ariaLabel="Recurrence"
          options={[
            { value: 'none', label: 'Ponctuelle' },
            { value: 'monthly', label: 'Mensuelle' },
            { value: 'quarterly', label: 'Trimestrielle' },
            { value: 'yearly', label: 'Annuelle' },
          ]}
        />
      </Field>
    </Modal>
  )
}

export function DebtModal({ onClose, initial }: { onClose: () => void; initial?: Debt }) {
  const { dispatch } = useStore()
  const remaining = useAmount(initial ? String(initial.remainingAmount).replace('.', ',') : '')
  const monthly = useAmount(initial ? String(initial.monthlyPayment).replace('.', ',') : '')
  const [name, setName] = useState(initial?.name ?? '')
  const [initialAmount, setInitialAmount] = useState(
    initial ? String(initial.initialAmount).replace('.', ',') : '',
  )
  const [dueDay, setDueDay] = useState(initial?.dueDay ?? 5)
  const [priority, setPriority] = useState<DebtPriority>(initial?.priority ?? 'moyenne')
  const [kind, setKind] = useState<DebtKind>(initial?.kind ?? 'credit')

  function save() {
    if (!remaining.valid || !name.trim()) return
    const init = Number.isFinite(Number(initialAmount.replace(',', '.')))
      ? Math.max(Number(initialAmount.replace(',', '.')) || 0, remaining.value)
      : remaining.value
    dispatch({
      type: 'debt/upsert',
      debt: {
        id: initial?.id ?? uid(),
        name: name.trim(),
        initialAmount: init,
        remainingAmount: remaining.value,
        monthlyPayment: Number.isFinite(monthly.value) ? Math.max(0, monthly.value) : 0,
        dueDay: Math.min(28, Math.max(1, dueDay)),
        priority,
        kind,
        status: remaining.value <= 0 ? 'paid' : 'active',
        installmentsTotal: initial?.installmentsTotal,
        installmentsPaid: initial?.installmentsPaid,
        rate: initial?.rate,
      },
    })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier la dette' : 'Nouvelle dette'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'debt/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!remaining.valid || !name.trim()} onClick={save}>Enregistrer</button>
        </>
      }
    >
      <Field label="Nom">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Klarna, decouvert, credit conso&hellip;" autoFocus />
      </Field>
      <div className="field-row">
        <Field label="Montant initial">
          <input className="num-input" inputMode="decimal" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} />
        </Field>
        <Field label="Montant restant">
          <AmountInput value={remaining.raw} onChange={remaining.setRaw} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Mensualite">
          <AmountInput value={monthly.raw} onChange={monthly.setRaw} placeholder="0" />
        </Field>
        <Field label="Jour de prelevement">
          <input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(Number(e.target.value) || 1)} />
        </Field>
      </div>
      <Field label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
          {DEBT_KINDS.map((k) => <option key={k} value={k}>{DEBT_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field label="Priorite">
        <Segmented
          value={priority}
          onChange={setPriority}
          ariaLabel="Priorite"
          options={[
            { value: 'haute', label: 'Haute' },
            { value: 'moyenne', label: 'Moyenne' },
            { value: 'basse', label: 'Basse' },
          ]}
        />
      </Field>
    </Modal>
  )
}

export function DebtPaymentModal({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { dispatch } = useStore()
  const amount = useAmount(String(Math.min(debt.monthlyPayment || debt.remainingAmount, debt.remainingAmount)).replace('.', ','))
  const [date, setDate] = useState(today())
  const after = Math.max(0, Math.round((debt.remainingAmount - (amount.value || 0)) * 100) / 100)

  return (
    <Modal
      title={`Remboursement — ${debt.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            disabled={!amount.valid}
            onClick={() => { dispatch({ type: 'debt/pay', id: debt.id, amount: amount.value, date }); onClose() }}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <Field label="Montant rembourse">
        <AmountInput value={amount.raw} onChange={amount.setRaw} autoFocus />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="impact">
        <div className="side">
          <div className="l">Reste aujourd&rsquo;hui</div>
          <div className="v">{euro(debt.remainingAmount)}</div>
        </div>
        <div className="arrow" aria-hidden>&rarr;</div>
        <div className="side">
          <div className="l">Apres</div>
          <div className={`v ${after === 0 ? 'ok' : ''}`}>{euro(after)}</div>
        </div>
      </div>
      {after === 0 && amount.valid && (
        <div className="callout good">
          <span className="ico" aria-hidden>&#127881;</span>
          <div><strong>Cette dette passe a zero.</strong><p>Une ligne de moins sur ton budget de chaque mois.</p></div>
        </div>
      )}
    </Modal>
  )
}

export function GoalModal({ onClose, initial }: { onClose: () => void; initial?: SavingsGoal }) {
  const { dispatch } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '\u{1F3AF}')
  const [target, setTarget] = useState(initial ? String(initial.target).replace('.', ',') : '')
  const [image, setImage] = useState<string | undefined>(initial?.image)
  const [imageError, setImageError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(file: File) {
    setImageError('')
    setBusy(true)
    try {
      setImage(await prepareImage(file))
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Image illisible.')
    } finally {
      setBusy(false)
    }
  }

  function save() {
    if (!name.trim()) return
    dispatch({
      type: 'goal/upsert',
      goal: {
        id: initial?.id ?? uid(),
        name: name.trim(),
        emoji: emoji || '\u{1F3AF}',
        target: Math.max(0, Number(target.replace(',', '.')) || 0),
        current: initial?.current ?? 0,
        system: initial?.system,
        image,
      },
    })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier l’objectif' : 'Nouvel objectif d’epargne'}
      onClose={onClose}
      footer={
        <>
          {initial && !initial.system && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'goal/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!name.trim()} onClick={save}>Enregistrer</button>
        </>
      }
    >
      <div className="field-row" style={{ gridTemplateColumns: '80px 1fr' }}>
        <Field label="Icone">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fonds de securite" autoFocus />
        </Field>
      </div>
      <Field label="Objectif" hint="Laisse a 0 pour une epargne sans cible.">
        <input className="num-input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="3 000" />
      </Field>

      <Field label="Image" hint="Une photo rend l'objectif concret. Elle est redimensionnee avant d'etre stockee.">
        {image ? (
          <div className="img-preview">
            <img src={image} alt="" />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Remplacer</button>
              <button className="btn sm danger" onClick={() => setImage(undefined)}>Retirer</button>
            </div>
          </div>
        ) : (
          <button className="dropzone" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="ico" aria-hidden>{busy ? '\u23F3' : '\u{1F5BC}\uFE0F'}</span>
            <strong>{busy ? 'Preparation\u2026' : 'Ajouter une image'}</strong>
            <span className="fine">JPEG, PNG ou HEIC depuis ton telephone</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />
      </Field>

      {imageError && <Callout tone="critical" icon="&#9888;&#65039;">{imageError}</Callout>}
    </Modal>
  )
}

export function GoalDepositModal({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { dispatch } = useStore()
  const amount = useAmount('')
  const [date, setDate] = useState(today())
  const [mode, setMode] = useState<'in' | 'out'>('in')
  const signed = mode === 'in' ? amount.value : -amount.value

  return (
    <Modal
      title={`${goal.emoji} ${goal.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            disabled={!amount.valid}
            onClick={() => { dispatch({ type: 'goal/deposit', id: goal.id, amount: signed, date }); onClose() }}
          >
            {mode === 'in' ? 'Epargner' : 'Retirer'}
          </button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        ariaLabel="Sens du mouvement"
        options={[{ value: 'in', label: 'Epargner' }, { value: 'out', label: 'Retirer' }]}
      />
      <Field label="Montant">
        <AmountInput value={amount.raw} onChange={amount.setRaw} autoFocus />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="fine">
        Actuellement : {euro(goal.current)}
        {goal.target > 0 && ` sur un objectif de ${euro(goal.target)}`}.
      </p>
    </Modal>
  )
}

export function BalanceModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [raw, setRaw] = useState('')
  const parsed = Number(raw.replace(/\s| /g, '').replace(',', '.'))
  const valid = raw.trim() !== '' && Number.isFinite(parsed)

  function save() {
    if (!valid) return
    // Premier reglage : on pose le solde d'ouverture. Ensuite : on recale via un
    // ajustement, pour que l'historique des mouvements reste vrai.
    const hasLedger = state.incomes.length > 0 || state.transactions.length > 0
    if (!hasLedger) {
      dispatch({ type: 'settings', patch: { openingBalance: parsed, openingBalanceDate: today() } })
    } else {
      const current = balanceNow()
      const delta = Math.round((parsed - current) * 100) / 100
      if (delta !== 0) {
        dispatch({
          type: 'tx/upsert',
          tx: {
            id: uid(), date: today(), description: 'Recalage du solde reel',
            category: 'autre', amount: delta, kind: 'ajustement',
          },
        })
      }
    }
    onClose()
  }

  function balanceNow(): number {
    let t = state.settings.openingBalance
    for (const i of state.incomes) if (i.status === 'encaisse' && i.date >= state.settings.openingBalanceDate) t += i.amount
    for (const x of state.transactions) {
      if (x.date < state.settings.openingBalanceDate) continue
      t += x.kind === 'ajustement' ? x.amount : -Math.abs(x.amount)
    }
    return Math.round(t * 100) / 100
  }

  return (
    <Modal
      title="Solde bancaire reel"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!valid} onClick={save}>Mettre a jour</button>
        </>
      }
    >
      <Field label="Solde affiche par ta banque" hint="Un montant negatif est accepte : le decouvert fait partie du tableau.">
        <input className="num-input" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="2 450,30" autoFocus />
      </Field>
      <p className="fine">
        Le cockpit recalcule ensuite ton solde a partir de tes revenus encaisses et de tes
        depenses. Reviens ici quand l&rsquo;ecart se creuse : un ajustement sera enregistre.
      </p>
    </Modal>
  )
}
