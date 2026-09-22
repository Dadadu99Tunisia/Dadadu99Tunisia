import { useState } from 'react'
import { useStore } from '../store'
import type { Provision, Recurrence } from '../types'
import { provisionStatus } from '../lib/engine'
import { euro } from '../lib/money'
import { longDate, today } from '../lib/dates'
import { uid } from '../lib/storage'
import { useToast } from '../components/Toast'
import { AmountInput, Callout, ConfirmButton, Field, Modal, Segmented, useAmount } from '../components/ui'

export function ProvisionModal({ onClose, initial }: { onClose: () => void; initial?: Provision }) {
  const { dispatch } = useStore()
  const { notify } = useToast()
  const amount = useAmount(initial ? String(initial.amount).replace('.', ',') : '')
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '\u{1F3DB}️')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? today())
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'yearly')

  const preview = amount.valid
    ? provisionStatus(
      { id: 'x', name, emoji, amount: amount.value, dueDate, recurrence, saved: initial?.saved ?? 0 },
      today(),
    )
    : null

  function save() {
    if (!amount.valid || !name.trim()) return
    dispatch({
      type: 'provision/upsert',
      provision: {
        id: initial?.id ?? uid(),
        name: name.trim(),
        emoji: emoji || '\u{1F3DB}️',
        amount: amount.value,
        dueDate,
        recurrence,
        saved: initial?.saved ?? 0,
      },
    })
    notify(initial ? 'Provision mise a jour.' : 'Provision creee.', { tone: 'good' })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier la provision' : 'Nouvelle provision'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'provision/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!amount.valid || !name.trim()} onClick={save}>Enregistrer</button>
        </>
      }
    >
      <Callout tone="info" icon="&#128161;">
        Une provision sert aux depenses qui ne tombent pas tous les mois : taxe fonciere,
        assurance annuelle, revision. Tu mets un peu de cote chaque mois pour ne plus les subir.
      </Callout>

      <div className="field-row" style={{ gridTemplateColumns: '80px 1fr' }}>
        <Field label="Icone">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Taxe fonciere" autoFocus />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Montant de la facture">
          <AmountInput value={amount.raw} onChange={amount.setRaw} placeholder="1 100" />
        </Field>
        <Field label="Prochaine echeance">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Frequence">
        <Segmented
          value={recurrence}
          onChange={setRecurrence}
          ariaLabel="Frequence"
          options={[
            { value: 'yearly', label: 'Annuelle' },
            { value: 'quarterly', label: 'Trimestrielle' },
            { value: 'monthly', label: 'Mensuelle' },
            { value: 'none', label: 'Une fois' },
          ]}
        />
      </Field>

      {preview && preview.monthly > 0 && (
        <Callout tone="good" icon="&#128197;" title={`${euro(preview.monthly)} par mois`}>
          Sur {preview.monthsLeft} mois jusqu&rsquo;au {longDate(dueDate)}, tu couvres la facture
          sans a-coup.
        </Callout>
      )}
    </Modal>
  )
}

export function ProvisionFundModal({ provision, onClose }: { provision: Provision; onClose: () => void }) {
  const { dispatch } = useStore()
  const { notify } = useToast()
  const status = provisionStatus(provision, today())
  const amount = useAmount(String(status.monthly).replace('.', ','))
  const [date, setDate] = useState(today())
  const after = Math.round((provision.saved + (amount.value || 0)) * 100) / 100

  return (
    <Modal
      title={`${provision.emoji} ${provision.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            disabled={!amount.valid}
            onClick={() => {
              dispatch({ type: 'provision/fund', id: provision.id, amount: amount.value, date })
              notify(`${euro(amount.value)} mis de cote.`, { tone: 'good' })
              onClose()
            }}
          >
            Mettre de cote
          </button>
        </>
      }
    >
      <Field label="Montant">
        <AmountInput value={amount.raw} onChange={amount.setRaw} autoFocus />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="impact">
        <div className="side">
          <div className="l">Deja de cote</div>
          <div className="v">{euro(provision.saved)}</div>
        </div>
        <div className="arrow" aria-hidden>&rarr;</div>
        <div className="side">
          <div className="l">Apres</div>
          <div className={`v ${after >= provision.amount ? 'ok' : ''}`}>{euro(after)}</div>
        </div>
      </div>

      <p className="fine">
        Sur une facture de {euro(provision.amount)} attendue le {longDate(provision.dueDate)}.
        Ce virement sort de ton compte courant : c&rsquo;est un vrai transfert.
      </p>

      <button
        className="btn danger block"
        onClick={() => {
          dispatch({ type: 'provision/settle', id: provision.id, date })
          notify('Facture reglee, provision reprise.', { tone: 'good' })
          onClose()
        }}
      >
        La facture est arrivee, je la regle
      </button>
    </Modal>
  )
}
