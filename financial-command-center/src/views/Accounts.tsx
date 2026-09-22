import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Account } from '../types'
import { accountBalances, bankBalance } from '../lib/engine'
import { euro, parseAmount } from '../lib/money'
import { longDate, today } from '../lib/dates'
import { uid } from '../lib/storage'
import {
  Badge, Callout, Card, ConfirmButton, Field, Modal, Stat, Switch, useAmount,
} from '../components/ui'
import { useToast } from '../components/Toast'

export function Accounts() {
  const { state, dispatch } = useStore()
  const ref = today()
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)

  const balances = useMemo(() => accountBalances(state, ref), [state, ref])
  const total = bankBalance(state, ref)
  const trouble = balances.filter((b) => b.negative)
  const shared = balances.filter((b) => b.account.shared)

  return (
    <div className="stack">
      <div className="grid k3">
        <Stat
          label="Solde personnel"
          value={euro(total)}
          accent={total < 0 ? 'critical' : 'vie'}
          hint={`${balances.length - shared.length} compte(s)`}
        />
        <Stat
          label="Comptes dans le rouge"
          value={String(trouble.length)}
          accent={trouble.length ? 'critical' : 'vie'}
          hint={trouble.length ? trouble.map((t) => t.account.name).join(', ') : 'aucun'}
        />
        <Stat
          label="Comptes joints"
          value={euro(shared.reduce((a, b) => a + b.balance, 0))}
          accent="epargne"
          hint="hors solde personnel"
        />
      </div>

      {trouble.length > 0 && total >= 0 && (
        <Callout tone="critical" icon="&#9888;&#65039;" title="Un compte est a decouvert">
          Ton total est positif ({euro(total)}), mais{' '}
          {trouble.map((t) => `${t.account.name} est a ${euro(t.balance)}`).join(' et ')}.
          Un solde global ne dit rien des agios preleves sur un compte precis.
        </Callout>
      )}

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Ajouter un compte</button>

      <div className="stack">
        {balances.map(({ account, balance, negative, breached }) => (
          <Card key={account.id}>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="avatar" aria-hidden style={{ fontSize: 19 }}>{account.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16 }}>{account.name}</h3>
                <div className="fine">
                  Depuis le {longDate(account.openingBalanceDate)}
                  {account.overdraftLimit > 0 && ` · decouvert autorise ${euro(account.overdraftLimit)}`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                {account.primary && <Badge tone="good">Principal</Badge>}
                {account.shared && <Badge tone="epargne">Joint</Badge>}
                {breached && <Badge tone="critical">Hors decouvert</Badge>}
              </div>
            </div>

            <div
              className="num"
              style={{
                fontSize: 30,
                fontWeight: 740,
                letterSpacing: '-.04em',
                color: negative ? 'var(--critical)' : 'var(--vie)',
              }}
            >
              {euro(balance)}
            </div>
            {account.note && <p className="fine" style={{ marginTop: 6 }}>{account.note}</p>}

            <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm ghost" onClick={() => setEditing(account)}>Modifier</button>
              {!account.primary && (
                <button
                  className="btn sm ghost"
                  onClick={() => dispatch({ type: 'account/primary', id: account.id })}
                >
                  Definir comme principal
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <p className="fine">
        Chaque depense, revenu et prelevement se rattache a un compte. Sans precision,
        c&rsquo;est le compte principal. Un compte joint apparait ici mais n&rsquo;entre pas
        dans ton argent disponible : son solde n&rsquo;est pas le tien.
      </p>

      {creating && <AccountModal onClose={() => setCreating(false)} />}
      {editing && <AccountModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AccountModal({ onClose, initial }: { onClose: () => void; initial?: Account }) {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '\u{1F3E6}')
  const [shared, setShared] = useState(initial?.shared ?? false)
  const [note, setNote] = useState(initial?.note ?? '')
  const [date, setDate] = useState(initial?.openingBalanceDate ?? today())
  const [balanceRaw, setBalanceRaw] = useState(
    initial ? String(initial.openingBalance).replace('.', ',') : '',
  )
  const overdraft = useAmount(initial ? String(initial.overdraftLimit).replace('.', ',') : '0')

  const parsedBalance = parseAmount(balanceRaw)
  const balanceValid = balanceRaw.trim() !== '' && Number.isFinite(parsedBalance)
  const canDelete = !!initial && state.accounts.length > 1

  function save() {
    if (!name.trim() || !balanceValid) return
    dispatch({
      type: 'account/upsert',
      account: {
        id: initial?.id ?? uid(),
        name: name.trim(),
        emoji: emoji || '\u{1F3E6}',
        openingBalance: parsedBalance,
        openingBalanceDate: date,
        overdraftLimit: Number.isFinite(overdraft.value) ? Math.abs(overdraft.value) : 0,
        shared,
        primary: initial?.primary,
        note: note.trim() || undefined,
      },
    })
    notify(initial ? 'Compte mis a jour.' : 'Compte ajoute.', { tone: 'good' })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier le compte' : 'Nouveau compte'}
      onClose={onClose}
      footer={
        <>
          {canDelete && (
            <ConfirmButton
              onConfirm={() => { dispatch({ type: 'account/remove', id: initial!.id }); onClose() }}
            />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!name.trim() || !balanceValid} onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="field-row" style={{ gridTemplateColumns: '80px 1fr' }}>
        <Field label="Icone">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} style={{ textAlign: 'center' }} />
        </Field>
        <Field label="Nom">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Credit Mutuel" autoFocus />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Solde au" hint="Un montant negatif est accepte.">
          <input
            className="num-input"
            inputMode="decimal"
            value={balanceRaw}
            onChange={(e) => setBalanceRaw(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Decouvert autorise" hint="Au-dela, la banque facture des frais d&rsquo;incident.">
        <input
          className="num-input"
          inputMode="decimal"
          value={overdraft.raw}
          onChange={(e) => overdraft.setRaw(e.target.value)}
          placeholder="0"
        />
      </Field>

      <Switch
        checked={shared}
        onChange={setShared}
        label="Compte joint (son solde n&rsquo;est pas ton argent disponible)"
      />

      <Field label="Note" hint="Facultatif.">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Compte des charges communes" />
      </Field>

      {canDelete && (
        <p className="fine">
          Supprimer ce compte rebascule ses mouvements sur le compte principal : rien
          n&rsquo;est perdu.
        </p>
      )}
    </Modal>
  )
}

/** Selecteur de compte, masque tant qu'il n'y en a qu'un. */
export function AccountPicker({
  value, onChange, label = 'Compte',
}: {
  value: string | undefined
  onChange: (id: string | undefined) => void
  label?: string
}) {
  const { state } = useStore()
  if (state.accounts.length <= 1) return null
  const primary = state.accounts.find((a) => a.primary) ?? state.accounts[0]
  return (
    <Field label={label}>
      <select value={value ?? primary.id} onChange={(e) => onChange(e.target.value)}>
        {state.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.emoji} {a.name}{a.shared ? ' (joint)' : ''}
          </option>
        ))}
      </select>
    </Field>
  )
}
