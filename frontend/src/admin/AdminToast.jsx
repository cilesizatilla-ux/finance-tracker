import { useState, useCallback, useRef } from 'react'

export function useAdminToast() {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const addToast = useCallback((message, type = 'info') => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  }

  const ToastContainer = () => {
    const colors = {
      success: { bg: '#22c55e20', border: '#22c55e60', text: '#4ade80' },
      error:   { bg: '#ef444420', border: '#ef444460', text: '#fca5a5' },
      info:    { bg: '#6366f120', border: '#6366f160', text: '#a5b4fc' },
    }
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info
          return (
            <div key={t.id} style={{
              backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text,
              padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              maxWidth: 320, pointerEvents: 'auto',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
    )
  }

  return { toast, ToastContainer }
}
