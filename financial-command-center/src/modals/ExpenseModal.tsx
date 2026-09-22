import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { LIVING_CATEGORIES, TX_CATEGORY_LABELS } from '../types'
import type { Transaction, TxCategory } from '../types'
import { analyseExpense, splitPaymentImpact } from '../lib/engine'
import { euro, percent, round2 } from '../lib/money'
import { today, longDate } from '../lib/dates'
import { uid } from '../lib/storage'
import { AmountInput, Callout, Field, Modal, Switch, useAmount } from '../components/ui'
import { AccountPicker } from '../views/Accounts'

const CATEGORIES = Object.keys(TX_CATEGORY_LABELS) as TxCategory[]

/**
 * "+ Nouvelle depense" : on ne repond pas oui ou non, on montre l'impact.
 * Deux temps : saisie, puis analyse avant validation.
 */
export function ExpenseModal({
  onClose, initial,
}: {
  onClose: () => void
  initial?: Transaction
}) {
  const { state, dispatch } = useStore()
  const editing = !!initial

  const amount = useAmount(initial ? String(initial.amount).replace('.', ',') : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState<TxCategory>(initial?.category ?? 'shopping')
  const [date, setDate] = useState(initial?.date ?? today())
  const [split, setSplit] = useState(!!initial?.split)
  const [accountId, setAccountId] = useState<string | undefined>(initial?.accountId)
  const [installments, setInstallments] = useState(3)
  const [step, setStep] = useState<'form' | 'impact'>(editing ? 'form' : 'form')

  const countsAsLiving = LIVING_CATEGORIES.includes(category)

  const impact = useMemo(
    () => (amount.valid ? analyseExpense(state, amount.value, { countsAsLiving, ref: date }) : null),
    [state, amount.value, amount.valid, countsAsLiving, date],
  )
  const splitInfo = useMemo(
    () => (amount.valid && split ? splitPaymentImpact(state, amount.value, installments, date) : null),
    [state, amount.value, amount.valid, split, installments, date],
  )

  function commit() {
    if (!amount.valid) return
    const tx: Transaction = {
      id: initial?.id ?? uid(),
      date,
      description: description.trim() || TX_CATEGORY_LABELS[category],
      category,
      amount: amount.value,
      kind: initial?.kind ?? (countsAsLiving ? 'vie' : category === 'epargne' ? 'epargne' : 'obligation'),
      split: split || undefined,
      accountId,
    }
    dispatch({ type: 'tx/upsert', tx })

    // Un paiement fractionne cree une dette : c'est tout l'interet de la regle.
    if (split && !editing && splitInfo && splitInfo.installments > 1) {
      dispatch({
        type: 'debt/upsert',
        debt: {
          id: uid(),
          name: `${tx.description} (fractionne)`,
          initialAmount: amount.value,
          remainingAmount: round2(amount.value - splitInfo.monthly),
          monthlyPayment: splitInfo.monthly,
          dueDay: Math.min(28, Number(date.slice(8, 10))),
          priority: 'haute',
          kind: 'klarna',
          status: 'active',
          installmentsTotal: splitInfo.installments,
          installmentsPaid: 1,
        },
      })
    }
    onClose()
  }

  const showKlarnaAlert = split && state.settings.klarnaAlertEnabled && amount.valid

  return (
    <Modal
      title={editing ? 'Modifier la depense' : 'Nouvelle depense'}
      onClose={onClose}
      footer={
        step === 'form' ? (
          <>
            <button className="btn ghost" onClick={onClose}>Annuler</button>
            {editing ? (
              <button className="btn primary" disabled={!amount.valid} onClick={commit}>Enregistrer</button>
            ) : (
              <button className="btn primary" disabled={!amount.valid} onClick={() => setStep('impact')}>
                Voir l&rsquo;impact
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={() => setStep('form')}>Retour</button>
            <button className="btn primary" onClick={commit}>Enregistrer</button>
          </>
        )
      }
    >
      {step === 'form' && (
        <>
          <Field label="Montant">
            <AmountInput value={amount.raw} onChange={amount.setRaw} autoFocus placeholder="180" />
          </Field>

          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chaussures"
            />
          </Field>

          <div className="field-row">
            <Field label="Categorie">
              <select value={category} onChange={(e) => setCategory(e.target.value as TxCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{TX_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <AccountPicker value={accountId} onChange={setAccountId} label="Compte debite" />

          {!countsAsLiving && (
            <p className="fine">
              Cette categorie ne consomme pas ton enveloppe de vie de {euro(state.settings.livingBudget)} :
              elle sort quand meme de ton compte.
            </p>
          )}

          <Switch
            checked={split}
            onChange={setSplit}
            label="Paiement fractionne (Klarna, Alma, 3x&hellip;)"
          />

          {split && (
            <Field label="Nombre d&rsquo;echeances">
              <input
                type="number"
                min={1}
                max={36}
                value={installments}
                onChange={(e) => setInstallments(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          )}

          {showKlarnaAlert && splitInfo && (
            <Callout tone="warn" icon="&#128680;" title="Tu transformes une depense d&rsquo;aujourd&rsquo;hui en obligation pour ton futur budget.">
              <span style={{ display: 'block', marginTop: 6 }}>
                {euro(splitInfo.total)} en {splitInfo.installments} fois, soit{' '}
                <b>{euro(splitInfo.monthly)} par mois</b> jusqu&rsquo;au {longDate(splitInfo.lastDueDate)}.
              </span>
              <span style={{ display: 'block', marginTop: 6 }}>
                Le mois prochain, ton enveloppe de vie ne demarrera pas a{' '}
                {euro(state.settings.livingBudget)} mais a <b>{euro(splitInfo.nextMonthLivingLeft)}</b>{' '}
                ({percent(splitInfo.shareOfNextMonth)} de ton budget deja engage).
              </span>
              <span style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                Tu peux desactiver cette alerte dans les reglages.
              </span>
            </Callout>
          )}
        </>
      )}

      {step === 'impact' && impact && (
        <>
          <div className="impact">
            <div className="side">
              <div className="l">Avant</div>
              <div className={`v ${impact.availableBefore >= 0 ? 'ok' : 'bad'}`}>{euro(impact.availableBefore)}</div>
            </div>
            <div className="arrow" aria-hidden>&rarr;</div>
            <div className="side">
              <div className="l">Apres</div>
              <div className={`v ${impact.availableAfter >= 0 ? 'ok' : 'bad'}`}>{euro(impact.availableAfter)}</div>
            </div>
          </div>
          <p className="fine" style={{ marginTop: -6 }}>
            Argent reellement disponible, une fois retire tout ce qui est deja engage.
          </p>

          {countsAsLiving && (
            <div className="impact">
              <div className="side">
                <div className="l">Enveloppe de vie</div>
                <div className="v ok">{euro(impact.livingBefore)}</div>
              </div>
              <div className="arrow" aria-hidden>&rarr;</div>
              <div className="side">
                <div className="l">Apres</div>
                <div className={`v ${impact.livingAfter >= 0 ? 'ok' : 'bad'}`}>{euro(impact.livingAfter)}</div>
              </div>
            </div>
          )}

          <Callout
            tone={
              impact.level === 'depassement' ? 'critical'
                : impact.level === 'tendu' ? 'warn'
                  : impact.level === 'notable' ? 'info' : 'good'
            }
            icon={
              impact.level === 'depassement' ? '⚠️'
                : impact.level === 'tendu' ? '\u{1F7E0}'
                  : impact.level === 'notable' ? '\u{1F7E1}' : '✅'
            }
            title={impact.headline}
          >
            <span style={{ display: 'block' }}>
              {impact.facts.map((f, i) => (
                <span key={i} style={{ display: 'block', marginTop: i ? 4 : 0 }}>{f}</span>
              ))}
            </span>
          </Callout>

          {impact.upcomingObligations.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="list">
                {impact.upcomingObligations.slice(0, 4).map((o) => (
                  <div className="item" key={o.id}>
                    <span className="avatar" aria-hidden>&#128197;</span>
                    <div className="main-col">
                      <div className="title">{o.name}</div>
                      <div className="sub">{longDate(o.dueDate)}</div>
                    </div>
                    <span className="amount">{euro(o.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="fine">
            Le cockpit ne te dit pas oui ou non. Il te montre ce que cette depense change,
            et tu decides.
          </p>
        </>
      )}
    </Modal>
  )
}
