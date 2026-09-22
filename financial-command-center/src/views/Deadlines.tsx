import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Deadline, DeadlinePriority, ImpactPeriod } from '../types'
import { deadlineStakes, deadlinesDueWithin, openDeadlines, overdueDeadlines, yearlyImpact } from '../lib/engine'
import { euro, parseAmount } from '../lib/money'
import { longDate, relativeDue, today } from '../lib/dates'
import { uid } from '../lib/storage'
import {
  AmountInput, Badge, Callout, Card, ConfirmButton, Empty, Field, Modal, Segmented, Stat, useAmount,
} from '../components/ui'
import { useToast } from '../components/Toast'

const PRIORITY_LABEL: Record<DeadlinePriority, string> = {
  urgente: 'Urgente',
  importante: 'Importante',
  a_prevoir: 'A prevoir',
}
const PRIORITY_TONE: Record<DeadlinePriority, string> = {
  urgente: 'critical',
  importante: 'warn',
  a_prevoir: '',
}
const PERIOD_LABEL: Record<ImpactPeriod, string> = {
  an: 'par an',
  mois: 'par mois',
  unique: 'une fois',
}

/**
 * Les echeances administratives et fiscales : une action a faire avant une
 * date. Ni depense ni dette, mais la rater coute reellement de l'argent,
 * donc elle merite sa place a cote du reste.
 */
export function Deadlines() {
  const { state, dispatch } = useStore()
  const { notify } = useToast()
  const ref = today()
  const [editing, setEditing] = useState<Deadline | null>(null)
  const [creating, setCreating] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const open = useMemo(() => openDeadlines(state), [state])
  const late = useMemo(() => overdueDeadlines(state, ref), [state, ref])
  const soon = useMemo(() => deadlinesDueWithin(state, 30, ref), [state, ref])
  const done = useMemo(
    () => state.deadlines.filter((d) => d.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
    [state.deadlines],
  )
  const stakes = deadlineStakes(state)

  function toggle(d: Deadline) {
    dispatch({ type: 'deadline/toggle', id: d.id, date: ref })
    notify(d.done ? `${d.title} remise a faire.` : `${d.title} : c'est fait.`, {
      tone: d.done ? 'info' : 'good',
      undo: () => dispatch({ type: 'deadline/toggle', id: d.id, date: ref }),
    })
  }

  return (
    <div className="stack">
      <div className="grid k3">
        <Stat label="A faire" value={String(open.length)} accent={late.length ? 'critical' : 'obligations'} hint={late.length ? `${late.length} en retard` : 'aucune en retard'} />
        <Stat label="Gains en jeu" value={euro(stakes.gains)} accent="vie" hint="sur un an, si tu agis" />
        <Stat label="Couts a anticiper" value={euro(stakes.costs)} accent="dettes" hint="sur un an, si rien ne bouge" />
      </div>

      {late.length > 0 && (
        <Callout tone="critical" icon="&#9888;&#65039;" title={`${late.length} echeance(s) depassee(s)`}>
          {late.map((d) => d.title).join(', ')}. Une date passee ne veut pas toujours dire perdu :
          verifie s&rsquo;il reste un recours.
        </Callout>
      )}

      {soon.length > 0 && late.length === 0 && (
        <Callout tone="warn" icon="&#9203;" title={`${soon.length} echeance(s) sous 30 jours`}>
          La plus proche : {soon[0].title}, {relativeDue(soon[0].dueDate, ref)}.
        </Callout>
      )}

      <button className="btn primary block" onClick={() => setCreating(true)}>+ Nouvelle echeance</button>

      <Card title="A faire" flush>
        {open.length === 0 ? (
          <Empty icon="&#9989;">
            Rien en attente. Les demarches fiscales, les resiliations et les dates limites
            se rangent ici.
          </Empty>
        ) : (
          <div className="list">
            {open.map((d) => {
              const isLate = d.dueDate < ref
              const impact = yearlyImpact(d)
              return (
                <div className="deadline" key={d.id}>
                  <button
                    className="tick"
                    onClick={() => toggle(d)}
                    aria-label={`Marquer ${d.title} comme faite`}
                  />
                  <div className="main-col">
                    <div className="title">{d.title}</div>
                    <div className="sub">
                      {longDate(d.dueDate)} &middot;{' '}
                      <span style={isLate ? { color: 'var(--critical)', fontWeight: 600 } : undefined}>
                        {relativeDue(d.dueDate, ref)}
                      </span>
                    </div>
                    {d.detail && <div className="detail">{d.detail}</div>}
                    <div className="row" style={{ gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                      <Badge tone={PRIORITY_TONE[d.priority]}>{PRIORITY_LABEL[d.priority]}</Badge>
                      {d.link && (
                        <a className="btn sm ghost" href={d.link} target="_blank" rel="noreferrer noopener">
                          Ouvrir le site
                        </a>
                      )}
                      <button className="btn sm ghost" onClick={() => setEditing(d)}>Modifier</button>
                    </div>
                  </div>
                  {d.impact ? (
                    <div className="figures">
                      <div className={`per-month ${d.impact > 0 ? 'gain' : 'cost'}`}>
                        {d.impact > 0 ? '+' : '−'} {euro(Math.abs(d.impact))}
                      </div>
                      <div className="of">{PERIOD_LABEL[d.impactPeriod ?? 'unique']}</div>
                      {d.impactPeriod === 'mois' && (
                        <div className="of">soit {euro(Math.abs(impact))} / an</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {done.length > 0 && (
        <Card
          title={`Faites (${done.length})`}
          flush
          action={
            <button className="btn sm ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Masquer' : 'Afficher'}
            </button>
          }
        >
          {showDone && (
            <div className="list">
              {done.map((d) => (
                <div className="deadline done" key={d.id}>
                  <button className="tick on" onClick={() => toggle(d)} aria-label={`Remettre ${d.title} a faire`}>
                    &#10003;
                  </button>
                  <div className="main-col">
                    <div className="title">{d.title}</div>
                    <div className="sub">Faite le {longDate(d.doneAt || d.dueDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <p className="fine">
        Une echeance n&rsquo;est ni une depense ni une dette : c&rsquo;est une action datee.
        Son impact est indicatif, il sert a savoir laquelle traiter en premier.
      </p>

      {creating && <DeadlineModal onClose={() => setCreating(false)} />}
      {editing && <DeadlineModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function DeadlineModal({ onClose, initial }: { onClose: () => void; initial?: Deadline }) {
  const { dispatch } = useStore()
  const { notify } = useToast()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [detail, setDetail] = useState(initial?.detail ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? today())
  const [priority, setPriority] = useState<DeadlinePriority>(initial?.priority ?? 'importante')
  const [link, setLink] = useState(initial?.link ?? '')
  const [sign, setSign] = useState<'gain' | 'cout'>((initial?.impact ?? 0) < 0 ? 'cout' : 'gain')
  const [period, setPeriod] = useState<ImpactPeriod>(initial?.impactPeriod ?? 'an')
  const amount = useAmount(initial?.impact ? String(Math.abs(initial.impact)).replace('.', ',') : '')

  function save() {
    if (!title.trim()) return
    const raw = parseAmount(amount.raw)
    const value = Number.isFinite(raw) && raw > 0 ? raw : undefined
    dispatch({
      type: 'deadline/upsert',
      deadline: {
        id: initial?.id ?? uid(),
        title: title.trim(),
        detail: detail.trim() || undefined,
        dueDate,
        priority,
        impact: value === undefined ? undefined : sign === 'cout' ? -value : value,
        impactPeriod: value === undefined ? undefined : period,
        link: link.trim() || undefined,
        done: initial?.done ?? false,
        doneAt: initial?.doneAt,
      },
    })
    notify(initial ? 'Echeance mise a jour.' : 'Echeance ajoutee.', { tone: 'good' })
    onClose()
  }

  return (
    <Modal
      title={initial ? 'Modifier l’echeance' : 'Nouvelle echeance'}
      onClose={onClose}
      footer={
        <>
          {initial && (
            <ConfirmButton onConfirm={() => { dispatch({ type: 'deadline/remove', id: initial.id }); onClose() }} />
          )}
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={!title.trim()} onClick={save}>Enregistrer</button>
        </>
      }
    >
      <Field label="Quoi">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activer le versement liberatoire" autoFocus />
      </Field>
      <Field label="Precision" hint="Facultatif : ou agir, quoi preparer.">
        <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Sur le portail de l&rsquo;URSSAF" />
      </Field>
      <div className="field-row">
        <Field label="Date limite">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Priorite">
          <select value={priority} onChange={(e) => setPriority(e.target.value as DeadlinePriority)}>
            <option value="urgente">Urgente</option>
            <option value="importante">Importante</option>
            <option value="a_prevoir">A prevoir</option>
          </select>
        </Field>
      </div>

      <Field label="Ce que ca change" hint="Facultatif. Sert a classer ce qui merite d&rsquo;etre traite en premier.">
        <Segmented
          value={sign}
          onChange={setSign}
          ariaLabel="Sens de l&rsquo;impact"
          options={[{ value: 'gain', label: 'Ca rapporte' }, { value: 'cout', label: 'Ca coute' }]}
        />
      </Field>
      <div className="field-row">
        <Field label="Montant">
          <AmountInput value={amount.raw} onChange={amount.setRaw} placeholder="4 000" />
        </Field>
        <Field label="Periode">
          <select value={period} onChange={(e) => setPeriod(e.target.value as ImpactPeriod)}>
            <option value="an">Par an</option>
            <option value="mois">Par mois</option>
            <option value="unique">Une seule fois</option>
          </select>
        </Field>
      </div>

      <Field label="Lien" hint="Facultatif : le site ou la demarche se fait.">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" inputMode="url" />
      </Field>
    </Modal>
  )
}
