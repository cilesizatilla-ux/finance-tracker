import { useState, useRef, useEffect } from 'react'
import { sendChat, getStatus } from '../api/index.js'
import { useAuth } from '../contexts/AuthContext.jsx'

function RobotIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 3a2 2 0 002 2h2a2 2 0 002-2M9 3h6m-3 9h.01M9 12h.01M15 12h.01M9 16h6" />
    </svg>
  )
}

function Message({ role, content, userInitials }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border'
        }`}
        style={!isUser ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#94a3b8' } : {}}
      >
        {isUser ? userInitials : <RobotIcon />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'rounded-tl-sm'
        }`}
        style={!isUser ? {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#f1f5f9'
        } : {}}
      >
        {content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#94a3b8' }}
      >
        <RobotIcon />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm border"
        style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: '#64748b', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your AI Finance Advisor. Ask me anything about your spending, budget, or financial health.\n\nFor example:\n• \"How am I doing this month?\"\n• \"What's my biggest expense category?\"\n• \"Am I on track with my budget?\""
}

const SUGGESTIONS = [
  'How am I doing this month?',
  "What's my biggest expense?",
  'Am I on track with my budget?',
  'Show my spending trends'
]

export default function Chat() {
  const { user } = useAuth()
  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [aiConfigured, setAiConfigured] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    getStatus().then(r => setAiConfigured(r.data?.ai_configured !== false)).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const message = text.trim()
    if (!message || loading) return

    const userMsg = { role: 'user', content: message }
    const history = messages.slice(1).filter((m) => m.role !== 'system')

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const res = await sendChat(message, history)
      const reply = res.data?.data?.reply || res.data?.reply || res.data?.response || 'No response received.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to get a response. Please try again.'
      setError(errMsg)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE])
    setError(null)
    inputRef.current?.focus()
  }

  const showSuggestions = messages.length <= 1 && !loading

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)', minHeight: 500, maxHeight: 900 }}>
      {/* API key banner */}
      {!aiConfigured && (
        <div
          className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b30', color: '#fbbf24' }}
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span>
            <strong>API key not configured.</strong> Add your <code className="px-1 rounded" style={{ backgroundColor: '#f59e0b20' }}>ANTHROPIC_API_KEY</code> to the <code className="px-1 rounded" style={{ backgroundColor: '#f59e0b20' }}>.env</code> file and restart the backend to enable AI chat.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">AI Finance Advisor</h1>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{ backgroundColor: '#6366f115', borderColor: '#6366f130', color: '#818cf8' }}
            >
              claude-sonnet-4-6
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            Ask me anything about your finances
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors hover:bg-slate-700/50"
          style={{ borderColor: '#334155', color: '#94a3b8' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear chat
        </button>
      </div>

      {/* Chat window */}
      <div
        className="flex-1 rounded-2xl border overflow-hidden flex flex-col"
        style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
      >
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full py-16" style={{ color: '#64748b' }}>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
                style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-sm font-medium">Ask me anything about your finances</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <Message key={i} role={msg.role} content={msg.content} userInitials={userInitials} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestion chips */}
        {showSuggestions && (
          <div className="px-5 pb-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all hover:border-indigo-500/50 hover:text-indigo-300"
                style={{ borderColor: '#334155', color: '#94a3b8', backgroundColor: '#1e293b' }}
              >
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mx-5 mb-3 px-4 py-2.5 rounded-xl text-xs border flex items-center gap-2"
            style={{ backgroundColor: '#ef444410', borderColor: '#ef444430', color: '#f87171' }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Input bar */}
        <div className="border-t p-4" style={{ borderColor: '#1e293b', backgroundColor: '#1e293b' }}>
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 resize-none px-4 py-3 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:border-indigo-500"
              style={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                color: '#f1f5f9',
                minHeight: '46px',
                maxHeight: '120px',
                fontFamily: 'Inter, sans-serif'
              }}
              placeholder="Ask me anything about your finances…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 flex-shrink-0 shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
          <p className="text-center text-xs mt-2" style={{ color: '#475569' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
