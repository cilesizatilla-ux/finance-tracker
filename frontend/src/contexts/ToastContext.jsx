import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  }

  const colors = {
    success: { bg: '#22c55e20', border: '#22c55e60', text: '#4ade80' },
    error:   { bg: '#ef444420', border: '#ef444460', text: '#fca5a5' },
    info:    { bg: '#6366f120', border: '#6366f160', text: '#a5b4fc' },
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info
          return (
            <div key={t.id} style={{
              backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text,
              padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              backdropFilter: 'blur(8px)', maxWidth: 320, pointerEvents: 'auto',
              animation: 'fadeSlideIn 0.2s ease',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px)} to { opacity:1; transform:translateY(0)} }`}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
