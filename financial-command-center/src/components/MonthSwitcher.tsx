import { monthLabel } from '../lib/dates'
import { shiftMonth } from '../lib/engine'

/**
 * Navigation de mois en mois.
 * Presente partout ou l'information est mensuelle, toujours au meme endroit :
 * on ne cherche jamais ou changer de periode.
 */
export function MonthSwitcher({
  value, onChange, current, max,
}: {
  value: string
  onChange: (key: string) => void
  /** Mois en cours, pour proposer le retour a aujourd'hui. */
  current: string
  /** Dernier mois navigable (par defaut : un an devant). */
  max?: string
}) {
  const limit = max ?? shiftMonth(current, 12)
  const canNext = value < limit

  return (
    <div className="month-switch">
      <button
        className="icon-btn"
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label="Mois precedent"
      >
        &lsaquo;
      </button>

      <div className="label">
        <span className="m">{monthLabel(value)}</span>
        {value !== current && (
          <button className="linkish" onClick={() => onChange(current)}>
            revenir a aujourd&rsquo;hui
          </button>
        )}
      </div>

      <button
        className="icon-btn"
        onClick={() => canNext && onChange(shiftMonth(value, 1))}
        disabled={!canNext}
        aria-label="Mois suivant"
      >
        &rsaquo;
      </button>
    </div>
  )
}
