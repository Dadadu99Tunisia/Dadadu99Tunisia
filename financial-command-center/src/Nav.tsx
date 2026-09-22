export type View =
  | 'dashboard' | 'revenus' | 'depenses' | 'obligations' | 'dettes'
  | 'epargne' | 'calendrier' | 'projection' | 'sante' | 'habitudes' | 'reglages'

interface Entry { view: View; label: string; icon: string; group: string }

/** Regroupe par intention, pas par type de donnee. */
export const ENTRIES: Entry[] = [
  { view: 'dashboard',   label: 'Tableau de bord', icon: '\u{1F3E0}', group: 'Piloter' },
  { view: 'revenus',     label: 'Revenus',         icon: '\u{1F4B0}', group: 'Construire' },
  { view: 'obligations', label: 'Obligations',     icon: '\u{1F4C5}', group: 'Construire' },
  { view: 'depenses',    label: 'Depenses',        icon: '\u{1F9FE}', group: 'Vivre le mois' },
  { view: 'calendrier',  label: 'Calendrier',      icon: '\u{1F5D3}️', group: 'Vivre le mois' },
  { view: 'dettes',      label: 'Dettes',          icon: '\u{1F4C9}', group: 'Securiser' },
  { view: 'epargne',     label: 'Epargne',         icon: '\u{1F6DF}', group: 'Securiser' },
  { view: 'projection',  label: 'Projection',      icon: '\u{1F52D}', group: 'Anticiper' },
  { view: 'sante',       label: 'Sante',           icon: '\u{1F49A}', group: 'Anticiper' },
  { view: 'habitudes',   label: 'Habitudes',       icon: '\u{1F4CA}', group: 'Anticiper' },
  { view: 'reglages',    label: 'Reglages',        icon: '⚙️', group: 'Anticiper' },
]

export function Nav({
  view, onChange, hidden,
}: {
  view: View
  onChange: (v: View) => void
  /** En mode stabilisation, on masque les modules secondaires. */
  hidden?: View[]
}) {
  const entries = ENTRIES.filter((e) => !hidden?.includes(e.view))
  let lastGroup = ''

  return (
    <div className="nav-col">
    <nav className="nav" aria-label="Navigation principale">
      <div className="nav-title">Mon cockpit<span>financier</span></div>
      {entries.map((e) => {
        const head = e.group !== lastGroup ? e.group : null
        lastGroup = e.group
        return (
          <div key={e.view} style={{ display: 'contents' }}>
            {head && <div className="nav-group">{head}</div>}
            <button
              aria-current={view === e.view ? 'page' : undefined}
              onClick={() => onChange(e.view)}
            >
              <span className="ico" aria-hidden>{e.icon}</span>
              {e.label}
            </button>
          </div>
        )
      })}
    </nav>
    </div>
  )
}
