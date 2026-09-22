import { useEffect, useMemo, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Nav } from './Nav'
import type { View } from './Nav'
import { Dashboard } from './views/Dashboard'
import { Incomes } from './views/Incomes'
import { Expenses } from './views/Expenses'
import { Obligations } from './views/Obligations'
import { Debts } from './views/Debts'
import { Savings } from './views/Savings'
import { CalendarView } from './views/Calendar'
import { Projection } from './views/Projection'
import { Health } from './views/Health'
import { Habits } from './views/Habits'
import { Settings } from './views/Settings'
import { Budget } from './views/Budget'
import { ToastProvider } from './components/Toast'
import { ExpenseModal } from './modals/ExpenseModal'
import { IncomeModal } from './modals/IncomeModal'
import { BalanceModal } from './modals/Entities'
import { crisisState } from './lib/engine'
import { today } from './lib/dates'

const THEME_KEY = 'cockpit-financier/theme'
/** Masques en mode stabilisation : on garde l'essentiel sous les yeux. */
const CRISIS_HIDDEN: View[] = ['habitudes', 'projection', 'epargne', 'budget']

const TITLES: Record<View, string> = {
  dashboard: 'Tableau de bord',
  revenus: 'Revenus',
  depenses: 'Depenses',
  obligations: 'Obligations',
  dettes: 'Dettes',
  budget: 'Budget type',
  epargne: 'Epargne',
  calendrier: 'Calendrier',
  projection: 'Projection',
  sante: 'Sante financiere',
  habitudes: 'Habitudes',
  reglages: 'Reglages',
}

function Shell() {
  const { state, saveError } = useStore()
  const [view, setView] = useState<View>('dashboard')
  const [expense, setExpense] = useState(false)
  const [income, setIncome] = useState(false)
  const [balance, setBalance] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // stockage indisponible : le theme reste valable pour la session
    }
  }, [theme])

  const crisis = useMemo(() => crisisState(state, today()), [state])
  const hidden = crisis.active ? CRISIS_HIDDEN : undefined

  // Si la vue courante vient d'etre masquee, on retombe sur le tableau de bord.
  useEffect(() => {
    if (hidden?.includes(view)) setView('dashboard')
  }, [hidden, view])

  const greeting = state.settings.ownerName
    ? `Bonjour ${state.settings.ownerName} !`
    : 'Bonjour !'

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())

  return (
    <div className="app">
      <Nav view={view} onChange={setView} hidden={hidden} />

      <div className="app-body">
        <main className="main">
          <header className="hello">
            <div style={{ minWidth: 0 }}>
              <h1>{view === 'dashboard' ? greeting : TITLES[view]}</h1>
              <div className="sub">{dateLabel}</div>
            </div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setExpense(true)}>+ Depense</button>
          </header>

          {saveError && (
            <div className="callout critical" style={{ marginBottom: 14 }}>
              <span className="ico" aria-hidden>&#9888;&#65039;</span>
              <div>
                <strong>Tes dernieres saisies ne sont pas enregistrees</strong>
                <p>
                  {saveError === 'quota'
                    ? "L'espace du navigateur est plein. Exporte tes donnees depuis les reglages, puis allege les images de tes objectifs d'epargne."
                    : "Le navigateur bloque le stockage local (navigation privee ?). Exporte tes donnees avant de fermer l'onglet."}
                </p>
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <Dashboard
              go={setView}
              onExpense={() => setExpense(true)}
              onIncome={() => setIncome(true)}
              onBalance={() => setBalance(true)}
            />
          )}
          {view === 'revenus' && <Incomes />}
          {view === 'depenses' && <Expenses />}
          {view === 'obligations' && <Obligations />}
          {view === 'dettes' && <Debts />}
          {view === 'budget' && <Budget />}
          {view === 'epargne' && <Savings />}
          {view === 'calendrier' && <CalendarView />}
          {view === 'projection' && <Projection />}
          {view === 'sante' && <Health />}
          {view === 'habitudes' && <Habits />}
          {view === 'reglages' && <Settings theme={theme} onTheme={setTheme} />}
        </main>
      </div>

      {/* Sur mobile, l'action la plus frequente reste a portee de pouce. */}
      <button className="fab" onClick={() => setExpense(true)} aria-label="Nouvelle depense">+</button>

      {expense && <ExpenseModal onClose={() => setExpense(false)} />}
      {income && <IncomeModal onClose={() => setIncome(false)} />}
      {balance && <BalanceModal onClose={() => setBalance(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  )
}
