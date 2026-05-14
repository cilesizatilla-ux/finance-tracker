import { useState, useEffect } from 'react'
import adminApi from '../adminApi.js'
import { useAdminToast } from '../AdminToast.jsx'

export default function AdminNotifications() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [past, setPast] = useState([])
  const { toast, ToastContainer } = useAdminToast()

  useEffect(() => {
    adminApi.get('/notifications').then(r => setPast(r.data?.data || [])).catch(() => {})
  }, [])

  async function handleSend() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSending(true)
    try {
      await adminApi.post('/notifications/broadcast', { title: title.trim(), body: body.trim() })
      toast.success('Notification broadcast to all users')
      setTitle(''); setBody('')
      const r = await adminApi.get('/notifications')
      setPast(r.data?.data || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0f172a' }}>
      <ToastContainer />
      <h1 className="text-xl font-bold text-white mb-6">Broadcast Notifications</h1>
      <div className="rounded-2xl border p-6 mb-6 max-w-xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
        <h2 className="text-base font-semibold text-white mb-4">New Broadcast</h2>
        <div className="space-y-3">
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-4 py-3 rounded-xl text-sm text-white border outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
          />
          <textarea
            value={body} onChange={e => setBody(e.target.value)}
            placeholder="Message body (optional)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm text-white border outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
          />
          <button
            onClick={handleSend} disabled={sending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#6366f1' }}
          >
            {sending ? 'Sending…' : 'Broadcast to All Users'}
          </button>
        </div>
      </div>
      {past.length > 0 && (
        <div className="rounded-2xl border p-6 max-w-xl" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-base font-semibold text-white mb-4">Past Broadcasts</h2>
          <div className="space-y-3">
            {past.map(n => (
              <div key={n.id} className="rounded-xl p-4 border" style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}>
                <p className="text-sm font-medium text-white">{n.title}</p>
                {n.body && <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{n.body}</p>}
                <p className="text-xs mt-2" style={{ color: '#475569' }}>{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
