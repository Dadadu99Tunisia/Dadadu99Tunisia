import { useRef, useState } from 'react'
import { useStore } from '../store'
import { downloadExport, importJSON, emptyState } from '../lib/storage'
import { euro, parseAmount } from '../lib/money'
import { today } from '../lib/dates'
import { Callout, Card, ConfirmButton, Field, Segmented, Switch } from '../components/ui'
import { useToast } from '../components/Toast'
import { ImportModal } from '../modals/ImportModal'

export function Settings({ theme, onTheme }: { theme: 'light' | 'dark'; onTheme: (t: 'light' | 'dark') => void }) {
  const { state, dispatch, reset } = useStore()
  const { notify } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [budget, setBudget] = useState(String(state.settings.livingBudget).replace('.', ','))
  const [buffer, setBuffer] = useState(String(state.settings.safetyBuffer).replace('.', ','))
  const [expected, setExpected] = useState(String(state.settings.expectedMonthlyIncome).replace('.', ','))
  const [name, setName] = useState(state.settings.ownerName)
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState(false)
  const [bankImport, setBankImport] = useState(false)

  function commitNumber(raw: string, key: 'livingBudget' | 'safetyBuffer' | 'expectedMonthlyIncome') {
    const v = parseAmount(raw)
    if (Number.isFinite(v) && v >= 0) dispatch({ type: 'settings', patch: { [key]: v } })
  }

  async function onFile(file: File) {
    setImportError('')
    setImported(false)
    try {
      const next = importJSON(await file.text())
      dispatch({ type: 'replace', state: next })
      setBudget(String(next.settings.livingBudget).replace('.', ','))
      setBuffer(String(next.settings.safetyBuffer).replace('.', ','))
      setExpected(String(next.settings.expectedMonthlyIncome).replace('.', ','))
      setName(next.settings.ownerName)
      setImported(true)
    } catch {
      setImportError('Fichier illisible. Attendu : un export JSON du cockpit.')
    }
  }

  return (
    <div className="stack">
      <Card title="Ton cadre">
        <Field label="Prenom" hint="Sert uniquement a t'accueillir sur le tableau de bord.">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => dispatch({ type: 'settings', patch: { ownerName: name.trim() } })}
            placeholder="Ton prenom"
          />
        </Field>

        <div style={{ height: 14 }} />

        <Field
          label="Budget de vie mensuel"
          hint="L'enveloppe fermee de tes depenses personnelles courantes."
        >
          <input
            className="num-input"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={() => commitNumber(budget, 'livingBudget')}
          />
        </Field>

        <div style={{ height: 14 }} />

        <Field
          label="Revenu mensuel attendu"
          hint="Sert au score de sante. Laisse 0 pour utiliser la moyenne de tes 3 derniers mois."
        >
          <input
            className="num-input"
            inputMode="decimal"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            onBlur={() => commitNumber(expected, 'expectedMonthlyIncome')}
          />
        </Field>

        <div style={{ height: 14 }} />

        <Field
          label="Coussin de tresorerie"
          hint="Dans la projection, l'excedent au-dessus de ce montant bascule vers l'epargne en fin de mois."
        >
          <input
            className="num-input"
            inputMode="decimal"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onBlur={() => commitNumber(buffer, 'safetyBuffer')}
          />
        </Field>
      </Card>

      <Card title="Alertes et affichage">
        <Switch
          checked={state.settings.klarnaAlertEnabled}
          onChange={(v) => dispatch({ type: 'settings', patch: { klarnaAlertEnabled: v } })}
          label="Alerter sur les paiements fractionnes"
        />
        <p className="fine" style={{ marginTop: 8 }}>
          Desactivee, une depense fractionnee cree toujours la dette correspondante : seule
          l&rsquo;alerte disparait.
        </p>

        <div style={{ height: 18 }} />

        <Field label="Mode stabilisation">
          <Segmented
            value={state.settings.crisisMode}
            onChange={(v) => dispatch({ type: 'settings', patch: { crisisMode: v } })}
            ariaLabel="Mode stabilisation"
            options={[
              { value: 'auto', label: 'Automatique' },
              { value: 'on', label: 'Toujours' },
              { value: 'off', label: 'Jamais' },
            ]}
          />
        </Field>
        <p className="fine" style={{ marginTop: 8 }}>
          En automatique, il s&rsquo;active si ton compte est a decouvert, si une obligation est
          en retard, ou si tes engagements depassent ton solde.
        </p>

        <div style={{ height: 18 }} />

        <Field label="Theme">
          <Segmented
            value={theme}
            onChange={onTheme}
            ariaLabel="Theme"
            options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]}
          />
        </Field>
      </Card>

      <Card title="Releves bancaires">
        <p className="fine" style={{ marginBottom: 12 }}>
          Importe un export CSV, OFX ou QIF de ta banque : les mouvements sont classes
          automatiquement, et tu relis tout avant enregistrement. Une ligne deja importee
          n&rsquo;est jamais ajoutee deux fois.
        </p>
        <button className="btn primary block" onClick={() => setBankImport(true)}>
          Importer un releve
        </button>
      </Card>

      <Card title="Tes donnees">
        <Callout tone="info" icon="&#128274;">
          Tout est stocke dans ce navigateur uniquement. Rien n&rsquo;est envoye sur un serveur,
          rien n&rsquo;est partage. Exporte regulierement : vider les donnees du navigateur
          efface aussi ton cockpit.
        </Callout>

        <div className="stack" style={{ marginTop: 14, gap: 10 }}>
          <button
            className="btn block"
            onClick={async () => {
              const r = await downloadExport(state)
              if (r === 'saved') notify('Export enregistre.', { tone: 'good' })
              else if (r === 'declined') notify('Export annule.')
              else notify('Le telechargement est bloque ici. Ouvre la page dans un navigateur pour exporter.', { tone: 'warn' })
            }}
          >
            Exporter mes donnees (JSON)
          </button>
          <button className="btn block" onClick={() => fileRef.current?.click()}>
            Importer un fichier
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {imported && (
          <div style={{ marginTop: 12 }}>
            <Callout tone="good" icon="&#9989;">Donnees importees.</Callout>
          </div>
        )}
        {importError && (
          <div style={{ marginTop: 12 }}>
            <Callout tone="critical" icon="&#9888;&#65039;">{importError}</Callout>
          </div>
        )}

        <div className="row" style={{ marginTop: 18, gap: 10, flexWrap: 'wrap' }}>
          <ConfirmButton
            onConfirm={reset}
            confirmLabel="Confirmer l'effacement"
          >
            Tout effacer
          </ConfirmButton>
          <button
            className="btn sm ghost"
            onClick={async () => {
              const { demoState } = await import('../lib/demo')
              dispatch({ type: 'replace', state: demoState() })
            }}
          >
            Charger la demonstration
          </button>
        </div>
      </Card>

      {bankImport && <ImportModal onClose={() => setBankImport(false)} />}

      <Card title="Repere">
        <p className="fine">
          Solde d&rsquo;ouverture : {euro(state.settings.openingBalance)} au{' '}
          {state.settings.openingBalanceDate}.
        </p>
        <p className="fine" style={{ marginTop: 6 }}>
          {state.incomes.length} revenu(s) &middot; {state.transactions.length} mouvement(s) &middot;{' '}
          {state.obligations.length} obligation(s) &middot; {state.debts.length} dette(s) &middot;{' '}
          {state.savingsGoals.length} objectif(s).
        </p>
        <p className="fine" style={{ marginTop: 6 }}>
          Version du schema : {emptyState().version} &middot; aujourd&rsquo;hui : {today()}.
        </p>
      </Card>
    </div>
  )
}
