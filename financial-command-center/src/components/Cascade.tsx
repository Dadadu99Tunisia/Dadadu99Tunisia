import { useState } from 'react'
import type { Cascade } from '../lib/engine'
import { OBLIGATION_CATEGORY_LABELS } from '../types'
import type { ObligationCategory } from '../types'
import { euro } from '../lib/money'

/**
 * La cascade : REVENU -> FRAIS FIXES -> RESTE -> VIE -> DETTES -> RESTE REEL.
 * C'est la representation qui remplace "j'ai de l'argent donc je peux acheter".
 */
export function CascadeView({ c }: { c: Cascade }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="cascade">
      <Step label="REVENU" amount={c.income} tone="in" big>
        {c.incomeExpected > 0 && (
          <span className="note">
            {euro(c.incomeCashed)} encaisse &middot; {euro(c.incomeExpected)} encore attendu
          </span>
        )}
      </Step>

      <Arrow />

      <Step label="FRAIS FIXES" amount={-c.fixedTotal} tone="out">
        {c.fixedByCategory.length > 0 && (
          <button className="disclose" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Masquer le detail' : `Detail (${c.fixedByCategory.length} postes)`}
          </button>
        )}
        {open && (
          <ul className="tree">
            {c.fixedByCategory.map((l, i) => (
              <li key={l.key}>
                <span className="branch" aria-hidden>{i === c.fixedByCategory.length - 1 ? '└──' : '├──'}</span>
                <span className="n">{OBLIGATION_CATEGORY_LABELS[l.key as ObligationCategory] ?? l.label}</span>
                <span className="v">{euro(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Arrow />
      <Step label="RESTE" amount={c.afterFixed} tone="mid" />
      <Arrow />
      <Step label="VIE" amount={-c.living} tone="out" />

      {c.debts > 0 && (
        <>
          <Arrow />
          <Step label="DETTES" amount={-c.debts} tone="out">
            <ul className="tree">
              {c.debtLines.slice(0, 5).map((l, i, arr) => (
                <li key={l.key}>
                  <span className="branch" aria-hidden>{i === arr.length - 1 ? '└──' : '├──'}</span>
                  <span className="n">{l.label}</span>
                  <span className="v">{euro(l.amount)}</span>
                </li>
              ))}
            </ul>
          </Step>
        </>
      )}

      <Arrow />
      <Step label="RESTE REEL" amount={c.real} tone={c.real >= 0 ? 'final' : 'bad'} big>
        <span className="note">
          {c.real >= 0
            ? 'Ce montant est ton vrai disponible du mois : il peut aller a l’epargne.'
            : 'Le mois ne se finance pas tout seul : il manque de quoi couvrir tes engagements.'}
        </span>
      </Step>
    </div>
  )
}

function Arrow() {
  return <div className="casc-arrow" aria-hidden>&darr;</div>
}

function Step({
  label, amount, tone, big, children,
}: {
  label: string
  amount: number
  tone: 'in' | 'out' | 'mid' | 'final' | 'bad'
  big?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`casc-step ${tone} ${big ? 'big' : ''}`}>
      <div className="casc-row">
        <span className="l">{label}</span>
        <span className="v">{amount < 0 ? `− ${euro(-amount)}` : euro(amount)}</span>
      </div>
      {children}
    </div>
  )
}
