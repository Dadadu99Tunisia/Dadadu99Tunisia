import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  tone: 'good' | 'info' | 'warn'
  undo?: () => void
}

interface ToastApi {
  /** Affiche un message. `undo` ajoute un bouton Annuler pendant 6 secondes. */
  notify: (message: string, opts?: { tone?: ToastItem['tone']; undo?: () => void }) => void
}

const Ctx = createContext<ToastApi | null>(null)

/**
 * Retours d'action non bloquants.
 * Une suppression propose d'annuler plutot que de demander confirmation :
 * on avance vite, et l'erreur reste rattrapable.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback<ToastApi['notify']>((message, opts) => {
    const id = ++seq.current
    setItems((prev) => [...prev.slice(-2), { id, message, tone: opts?.tone ?? 'info', undo: opts?.undo }])
    setTimeout(() => dismiss(id), opts?.undo ? 6000 : 3200)
  }, [dismiss])

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div className={`toast ${t.tone}`} key={t.id}>
            <span className="msg">{t.message}</span>
            {t.undo && (
              <button
                className="undo"
                onClick={() => { t.undo!(); dismiss(t.id) }}
              >
                Annuler
              </button>
            )}
            <button className="close" onClick={() => dismiss(t.id)} aria-label="Fermer">&times;</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  // Sans fournisseur, on ne casse rien : les messages sont simplement ignores.
  return ctx ?? { notify: () => {} }
}

/** Ferme une modale a la touche Echap, meme imbriquee. */
export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onEscape()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onEscape])
}
