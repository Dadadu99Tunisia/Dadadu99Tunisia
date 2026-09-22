import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { euro, parseAmount, ratio } from '../lib/money'

export function Card({
  title, action, children, flush, className = '',
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`}>
      {title && (
        <header className="card-head" style={flush ? { padding: '18px 18px 0', marginBottom: 12 } : undefined}>
          <h2>{title}</h2>
          <span className="spacer" />
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label, value, hint, accent,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: 'vie' | 'obligations' | 'dettes' | 'epargne' | 'critical'
}) {
  return (
    <div className={`stat ${accent ? `accent-${accent}` : ''}`}>
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Bar({
  value, max, tone = '', pace, tall,
}: {
  value: number
  max: number
  tone?: '' | 'obligations' | 'dettes' | 'epargne' | 'over'
  /** Repere du rythme attendu, en part de `max`. */
  pace?: number
  tall?: boolean
}) {
  const pct = ratio(value, max) * 100
  return (
    <div
      className={`bar ${tone} ${tall ? 'tall' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${pct}%` }} />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <span className="pace" style={{ left: `${pace * 100}%` }} title="Rythme attendu a ce stade du mois" />
      )}
    </div>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone || ''}`}>{children}</span>
}

export function Callout({
  tone = 'info', icon, title, children,
}: {
  tone?: 'info' | 'warn' | 'critical' | 'good'
  icon?: string
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`callout ${tone}`}>
      {icon && <span className="ico" aria-hidden>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  )
}

export function Empty({ icon = '\u{1F4C4}', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="ico" aria-hidden>{icon}</span>
      {children}
    </div>
  )
}

export function Modal({
  title, onClose, children, footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">&times;</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Field({
  label, children, error, hint,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && !error && <span className="fine">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  )
}

/** Saisie de montant tolerante : "12,50", "1 234,56 EUR", "180". */
export function AmountInput({
  value, onChange, placeholder = '0,00', autoFocus,
}: {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      className="num-input"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function Segmented<T extends string>({
  value, options, onChange, ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked, onChange, label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
}) {
  const id = useId()
  return (
    <label className="switch" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  )
}

/** Confirmation en deux temps, pour ne jamais supprimer par accident. */
export function ConfirmButton({
  onConfirm, children = 'Supprimer', confirmLabel = 'Confirmer ?',
}: {
  onConfirm: () => void
  children?: ReactNode
  confirmLabel?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className="btn danger sm"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}

export function Money({ value, signed }: { value: number; signed?: boolean }) {
  const cls = value < 0 ? 'neg' : signed ? 'pos' : ''
  return <span className={`num ${cls}`}>{signed && value > 0 ? '+' : ''}{euro(value)}</span>
}

/** Etat controle d'un montant : la chaine saisie + sa valeur numerique. */
export function useAmount(initial = '') {
  const [raw, setRaw] = useState(initial)
  const value = parseAmount(raw)
  return { raw, setRaw, value, valid: Number.isFinite(value) && value > 0 }
}
