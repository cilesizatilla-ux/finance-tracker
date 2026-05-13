import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getTransactions, createTransaction, updateTransaction,
  deleteTransaction, importCSV, getCategories, createCategory,
  getParties, createParty, extractReceipt
} from '../api/index.js'
import CurrencyAmount from '../components/CurrencyAmount.jsx'

// ─── Language names ────────────────────────────────────────────────────────
const LANG_NAMES = {
  en:'English',tr:'Turkish',de:'German',fr:'French',es:'Spanish',
  ar:'Arabic',zh:'Chinese',ja:'Japanese',ko:'Korean',ru:'Russian',
  it:'Italian',pt:'Portuguese',nl:'Dutch',pl:'Polish',sv:'Swedish'
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const cls = type === 'error'
    ? 'bg-red-500/15 border-red-500/30 text-red-300'
    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl text-sm font-medium flex items-center gap-2 ${cls}`}>
      {type === 'error'
        ? <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
      }
      {message}
    </div>
  )
}

// ─── Constants ─────────────────────────────────────────────────────────────
const PRESET_COLORS = ['#22c55e','#ef4444','#f97316','#3b82f6','#a855f7','#f59e0b','#06b6d4','#8b5cf6','#10b981','#6b7280']
const PAYMENT_METHODS = ['card','cash','transfer','check','other']
const EMPTY_FORM = {
  date: new Date().toISOString().slice(0,10),
  description:'', amount:'', category_id:'', party_id:'', source:'', type:'expense',
  invoice_number:'', tax_amount:'', payment_method:'', notes:'', is_reconciled:false, receipt_path:''
}

// ─── Transaction Modal ──────────────────────────────────────────────────────
function TransactionModal({ open, onClose, onSave, categories, parties, initial, onCategoryCreated, onPartyCreated }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [catSaving, setCatSaving] = useState(false)
  const [addingParty, setAddingParty] = useState(false)
  const [newParty, setNewParty] = useState({ name:'', party_type:'vendor', tax_id:'', email:'', phone:'' })
  const [partySaving, setPartySaving] = useState(false)
  const [auditorOpen, setAuditorOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [langDetected, setLangDetected] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    setForm(initial || EMPTY_FORM)
    setAddingCat(false); setAddingParty(false); setAuditorOpen(false)
    setLangDetected(null); setReceiptPreview(null)
  }, [initial, open])

  if (!open) return null

  const isIncome = form.type === 'income'
  const filteredCats = categories.filter(c => c.is_income === isIncome)
  const filteredParties = parties.filter(p =>
    isIncome ? p.party_type !== 'vendor' : p.party_type !== 'customer'
  )

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setCheck = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.checked }))

  const handleTypeChange = (t) => {
    setForm(f => ({ ...f, type: t, category_id: '', party_id: '' }))
    setAddingCat(false); setAddingParty(false)
  }

  // ── Receipt upload + AI extraction ──
  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setReceiptPreview(URL.createObjectURL(file))
    setExtracting(true)
    try {
      const res = await extractReceipt(file)
      const d = res.data?.data
      if (!d || d.error) { setExtracting(false); return }

      // Auto-fill form
      setForm(f => ({
        ...f,
        date: d.date || f.date,
        description: d.description || f.description,
        amount: d.amount ? String(Math.abs(d.amount)) : f.amount,
        type: d.is_expense === false ? 'income' : 'expense',
        invoice_number: d.invoice_number || f.invoice_number,
        tax_amount: d.tax_amount ? String(d.tax_amount) : f.tax_amount,
        payment_method: d.payment_method || f.payment_method,
        notes: d.notes || f.notes,
        receipt_path: d.receipt_path || f.receipt_path,
      }))

      // Language detection
      const lang = d.detected_language
      const stored = localStorage.getItem('ft_lang') || 'en'
      if (lang && lang !== 'en' && lang !== stored) setLangDetected(lang)

      // Match category hint
      if (d.category_hint && !form.category_id) {
        const hint = categories.find(c =>
          c.name.toLowerCase().includes(d.category_hint.toLowerCase()) &&
          c.is_income === (d.is_expense === false)
        )
        if (hint) setForm(f => ({ ...f, category_id: String(hint.id) }))
      }
    } catch {
      // extraction failed silently
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  // ── Quick add category ──
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    setCatSaving(true)
    try {
      const res = await createCategory({ name: newCatName.trim(), color: newCatColor, is_income: isIncome, budget_cents: 0 })
      const newCat = res.data?.data
      if (newCat?.id) { onCategoryCreated(newCat); setForm(f => ({ ...f, category_id: String(newCat.id) })) }
      setAddingCat(false); setNewCatName(''); setNewCatColor('#6366f1')
    } catch {} finally { setCatSaving(false) }
  }

  // ── Quick add party ──
  const handleAddParty = async () => {
    if (!newParty.name.trim()) return
    setPartySaving(true)
    try {
      const payload = {
        ...newParty,
        party_type: isIncome ? 'customer' : 'vendor',
        name: newParty.name.trim()
      }
      const res = await createParty(payload)
      const created = res.data?.data
      if (created?.id) { onPartyCreated(created); setForm(f => ({ ...f, party_id: String(created.id) })) }
      setAddingParty(false); setNewParty({ name:'', party_type:'vendor', tax_id:'', email:'', phone:'' })
    } catch {} finally { setPartySaving(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const ib = 'w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
  const is = { backgroundColor:'#0f172a', borderColor:'#334155', color:'#f1f5f9' }
  const lbl = 'block text-xs font-medium mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col" style={{ backgroundColor:'#1e293b', borderColor:'#334155', maxHeight:'90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor:'#334155' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white">{initial ? 'Edit Transaction' : 'Add Transaction'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors" style={{ color:'#94a3b8' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* ── Receipt upload ── */}
            <div>
              <label className={lbl} style={{ color:'#94a3b8' }}>Receipt / Invoice photo <span style={{ color:'#475569' }}>(optional — AI will fill the form)</span></label>
              <div
                className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-indigo-500/50"
                style={{ borderColor: receiptPreview ? '#6366f130' : '#334155', backgroundColor:'#0f172a', minHeight: receiptPreview ? 0 : 80 }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                {receiptPreview ? (
                  <div className="w-full flex items-center gap-3 p-3">
                    <img src={receiptPreview} alt="receipt" className="w-16 h-16 object-cover rounded-lg flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      {extracting ? (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          <span className="text-sm text-indigo-400">Extracting data with AI…</span>
                        </div>
                      ) : (
                        <span className="text-sm text-emerald-400 font-medium">✓ Data extracted — review fields below</span>
                      )}
                      <p className="text-xs mt-0.5" style={{ color:'#475569' }}>Click to replace</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color:'#475569' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span className="text-xs" style={{ color:'#64748b' }}>Upload photo to auto-fill</span>
                  </div>
                )}
              </div>
            </div>

            {/* Language detection banner */}
            {langDetected && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm" style={{ backgroundColor:'#f59e0b10', borderColor:'#f59e0b30', color:'#fbbf24' }}>
                <span>Document in <strong>{LANG_NAMES[langDetected] || langDetected}</strong> detected.</span>
                <div className="flex gap-2 ml-4">
                  <button type="button" onClick={() => { localStorage.setItem('ft_lang', langDetected); setLangDetected(null) }}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium">Use it</button>
                  <button type="button" onClick={() => setLangDetected(null)} className="text-xs px-2 py-1 rounded-lg hover:bg-white/10">Dismiss</button>
                </div>
              </div>
            )}

            {/* Type toggle */}
            <div>
              <label className={lbl} style={{ color:'#94a3b8' }}>Type</label>
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor:'#334155' }}>
                {['expense','income'].map((t) => (
                  <button key={t} type="button" onClick={() => handleTypeChange(t)}
                    className="flex-1 py-2 text-sm font-medium transition-all capitalize"
                    style={{
                      backgroundColor: form.type===t ? (t==='income'?'#16a34a20':'#dc262620') : 'transparent',
                      color: form.type===t ? (t==='income'?'#22c55e':'#ef4444') : '#64748b',
                      borderRight: t==='expense'?'1px solid #334155':'none'
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl} style={{ color:'#94a3b8' }}>Date</label>
                <input type="date" required className={ib} style={is} value={form.date} onChange={set('date')}/>
              </div>
              <div>
                <label className={lbl} style={{ color:'#94a3b8' }}>Amount ($)</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00"
                  className={ib} style={is} value={form.amount} onChange={set('amount')}/>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={lbl} style={{ color:'#94a3b8' }}>Description</label>
              <input type="text" required placeholder="e.g. Office supplies" className={ib} style={is} value={form.description} onChange={set('description')}/>
            </div>

            {/* Party / Company / Customer */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color:'#94a3b8' }}>
                  {isIncome ? 'Customer' : 'Vendor / Supplier'}
                  <span className="ml-1" style={{ color:'#475569' }}>(optional)</span>
                </label>
                {!addingParty && (
                  <button type="button" onClick={() => setAddingParty(true)}
                    className="flex items-center gap-1 text-xs transition-colors" style={{ color:'#818cf8' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                    New {isIncome ? 'customer' : 'vendor'}
                  </button>
                )}
              </div>
              <select className={ib} style={is} value={form.party_id} onChange={set('party_id')}>
                <option value="">— Select {isIncome ? 'customer' : 'vendor'} —</option>
                {filteredParties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.tax_id ? ` (${p.tax_id})` : ''}</option>
                ))}
              </select>
              {addingParty && (
                <div className="mt-2 p-3 rounded-xl border space-y-2" style={{ backgroundColor:'#0f172a', borderColor:'#334155' }}>
                  <p className="text-xs font-medium" style={{ color:'#64748b' }}>New {isIncome ? 'customer' : 'vendor'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input autoFocus type="text" placeholder="Name *" value={newParty.name}
                      onChange={e => setNewParty(p => ({...p, name: e.target.value}))}
                      className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }}/>
                    <input type="text" placeholder="Tax ID / VAT" value={newParty.tax_id}
                      onChange={e => setNewParty(p => ({...p, tax_id: e.target.value}))}
                      className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }}/>
                    <input type="email" placeholder="Email" value={newParty.email}
                      onChange={e => setNewParty(p => ({...p, email: e.target.value}))}
                      className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }}/>
                    <input type="tel" placeholder="Phone" value={newParty.phone}
                      onChange={e => setNewParty(p => ({...p, phone: e.target.value}))}
                      className="px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                      style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }}/>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setAddingParty(false); setNewParty({ name:'', party_type:'vendor', tax_id:'', email:'', phone:'' }) }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-slate-700/50"
                      style={{ borderColor:'#334155', color:'#94a3b8' }}>Cancel</button>
                    <button type="button" onClick={handleAddParty} disabled={partySaving || !newParty.name.trim()}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                      {partySaving ? 'Saving…' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color:'#94a3b8' }}>
                  Category <span style={{ color:'#475569' }}>({isIncome ? 'income' : 'expense'})</span>
                </label>
                {!addingCat && (
                  <button type="button" onClick={() => setAddingCat(true)}
                    className="flex items-center gap-1 text-xs transition-colors" style={{ color:'#818cf8' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                    New category
                  </button>
                )}
              </div>
              <select className={ib} style={is} value={form.category_id} onChange={set('category_id')}>
                <option value="">— Select category —</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {addingCat && (
                <div className="mt-2 p-3 rounded-xl border space-y-2" style={{ backgroundColor:'#0f172a', borderColor:'#334155' }}>
                  <p className="text-xs font-medium" style={{ color:'#64748b' }}>New {isIncome ? 'income' : 'expense'} category</p>
                  <input autoFocus type="text" placeholder="Category name" value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); handleAddCategory() } }}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                    style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }}/>
                  <div>
                    <p className="text-xs mb-1.5" style={{ color:'#64748b' }}>Color</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setNewCatColor(c)}
                          className="w-6 h-6 rounded-full transition-transform"
                          style={{ backgroundColor:c, transform:newCatColor===c?'scale(1.25)':'scale(1)', outline:newCatColor===c?`2px solid ${c}`:'none', outlineOffset:2 }}/>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setAddingCat(false); setNewCatName('') }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-slate-700/50"
                      style={{ borderColor:'#334155', color:'#94a3b8' }}>Cancel</button>
                    <button type="button" onClick={handleAddCategory} disabled={catSaving || !newCatName.trim()}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                      {catSaving ? 'Saving…' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Source */}
            <div>
              <label className={lbl} style={{ color:'#94a3b8' }}>Source / Account</label>
              <input type="text" placeholder="e.g. Chase, PayPal" className={ib} style={is} value={form.source} onChange={set('source')}/>
            </div>

            {/* ── Auditor / Accounting Details ── */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor:'#334155' }}>
              <button
                type="button"
                onClick={() => setAuditorOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-700/30"
                style={{ color:'#94a3b8', backgroundColor:'#0f172a' }}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Accounting Details
                  {(form.invoice_number || form.tax_amount || form.notes || form.is_reconciled) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600/20 text-indigo-400">filled</span>
                  )}
                </div>
                <svg className={`w-4 h-4 transition-transform ${auditorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {auditorOpen && (
                <div className="p-4 space-y-3 border-t" style={{ borderColor:'#334155', backgroundColor:'#0f172a' }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl} style={{ color:'#94a3b8' }}>Invoice / Receipt #</label>
                      <input type="text" placeholder="INV-001" className={ib} style={is} value={form.invoice_number} onChange={set('invoice_number')}/>
                    </div>
                    <div>
                      <label className={lbl} style={{ color:'#94a3b8' }}>Tax Amount ($)</label>
                      <input type="number" min="0" step="0.01" placeholder="0.00" className={ib} style={is} value={form.tax_amount} onChange={set('tax_amount')}/>
                    </div>
                  </div>
                  <div>
                    <label className={lbl} style={{ color:'#94a3b8' }}>Payment Method</label>
                    <select className={ib} style={is} value={form.payment_method} onChange={set('payment_method')}>
                      <option value="">— Select —</option>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl} style={{ color:'#94a3b8' }}>Notes</label>
                    <textarea rows={2} placeholder="Additional notes for audit trail…"
                      className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
                      style={{ backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9', fontFamily:'Inter,sans-serif' }}
                      value={form.notes} onChange={set('notes')}/>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      onClick={() => setForm(f => ({...f, is_reconciled: !f.is_reconciled}))}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer ${form.is_reconciled ? 'bg-indigo-600 border-indigo-600' : ''}`}
                      style={!form.is_reconciled ? { borderColor:'#334155' } : {}}
                    >
                      {form.is_reconciled && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm" style={{ color:'#94a3b8' }}>Reconciled</span>
                  </label>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-slate-700/50"
                style={{ borderColor:'#334155', color:'#94a3b8' }}>Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton row ───────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-t" style={{ borderColor:'#334155' }}>
      {[120,200,120,100,80,70,60].map((w,j) => (
        <td key={j} className="px-4 py-3.5">
          <div className="h-3.5 rounded-lg bg-slate-700/50 animate-pulse" style={{ width:w }}/>
        </td>
      ))}
    </tr>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [parties, setParties] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 20

  const [filters, setFilters] = useState({ start:'', end:'', category_id:'', type:'all' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)

  const showToast = (message, type='success') => setToast({ message, type })

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = { skip: page*limit, limit }
      if (filters.start) params.start_date = filters.start
      if (filters.end) params.end_date = filters.end
      if (filters.category_id) params.category_id = filters.category_id
      if (filters.type !== 'all') params.type = filters.type
      const res = await getTransactions(params)
      const d = res.data
      setTransactions(d?.data || d?.items || d || [])
      setTotal(d?.total || (Array.isArray(d) ? d.length : 0))
    } catch { showToast('Failed to load transactions.','error') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])
  useEffect(() => {
    getCategories().then(r => setCategories(r.data?.data || r.data || [])).catch(() => {})
    getParties().then(r => setParties(r.data?.data || r.data || [])).catch(() => {})
  }, [])

  const handleSave = async (form) => {
    try {
      const payload = {
        date: form.date,
        description: form.description,
        amount_cents: form.type==='income'
          ? Math.round(parseFloat(form.amount)*100)
          : -Math.round(parseFloat(form.amount)*100),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        party_id: form.party_id ? parseInt(form.party_id) : null,
        source: form.source || 'manual',
        invoice_number: form.invoice_number || null,
        tax_amount_cents: form.tax_amount ? Math.round(parseFloat(form.tax_amount)*100) : null,
        notes: form.notes || null,
        payment_method: form.payment_method || null,
        is_reconciled: form.is_reconciled,
        receipt_path: form.receipt_path || null,
      }
      if (editTarget) { await updateTransaction(editTarget.id, payload); showToast('Transaction updated.') }
      else { await createTransaction(payload); showToast('Transaction added.') }
      setModalOpen(false); setEditTarget(null); setPage(0); fetchTransactions()
    } catch { showToast('Failed to save transaction.','error') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    try { await deleteTransaction(id); showToast('Transaction deleted.'); fetchTransactions() }
    catch { showToast('Failed to delete.','error') }
  }

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setCsvLoading(true)
    try {
      const res = await importCSV(file)
      showToast(`Imported ${res.data?.imported || res.data?.count || '?'} transactions.`)
      fetchTransactions()
    } catch { showToast('CSV import failed.','error') }
    finally { setCsvLoading(false); e.target.value='' }
  }

  const handleCategoryCreated = (cat) => setCategories(prev => [...prev, cat].sort((a,b) => a.name.localeCompare(b.name)))
  const handlePartyCreated = (party) => setParties(prev => [...prev, party].sort((a,b) => a.name.localeCompare(b.name)))

  const openAdd = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (tx) => {
    setEditTarget({
      ...tx,
      amount: (Math.abs(tx.amount_cents||0)/100).toFixed(2),
      type: tx.is_income ? 'income' : 'expense',
      date: tx.date ? tx.date.slice(0,10) : '',
      tax_amount: tx.tax_amount_cents ? (tx.tax_amount_cents/100).toFixed(2) : '',
    })
    setModalOpen(true)
  }

  const totalPages = Math.ceil(total/limit)
  const hasFilters = filters.start||filters.end||filters.category_id||filters.type!=='all'
  const typeFilterStyle = (val) => ({
    backgroundColor: filters.type===val ? '#6366f1' : 'transparent',
    color: filters.type===val ? '#fff' : '#94a3b8',
    borderColor: filters.type===val ? '#6366f1' : '#334155'
  })
  const ib = 'px-3 py-2 rounded-xl text-sm border outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500'
  const is = { backgroundColor:'#1e293b', borderColor:'#334155', color:'#f1f5f9' }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Transactions</h1>
            {!loading && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor:'#6366f120', color:'#818cf8' }}>
                {total.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color:'#94a3b8' }}>Manage your income and expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-colors hover:bg-slate-700/50 ${csvLoading?'opacity-50 pointer-events-none':''}`}
            style={{ borderColor:'#334155', color:'#94a3b8' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
            {csvLoading ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport}/>
          </label>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Transaction
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3" style={{ backgroundColor:'#1e293b', borderColor:'#334155' }}>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color:'#64748b' }}>From</label>
          <input type="date" className={ib} style={is} value={filters.start} onChange={e => { setFilters({...filters, start:e.target.value}); setPage(0) }}/>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color:'#64748b' }}>To</label>
          <input type="date" className={ib} style={is} value={filters.end} onChange={e => { setFilters({...filters, end:e.target.value}); setPage(0) }}/>
        </div>
        <select className={ib} style={is} value={filters.category_id} onChange={e => { setFilters({...filters, category_id:e.target.value}); setPage(0) }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor:'#334155' }}>
          {[{val:'all',label:'All'},{val:'income',label:'Income'},{val:'expense',label:'Expense'}].map(({val,label},i) => (
            <button key={val} onClick={() => { setFilters({...filters, type:val}); setPage(0) }}
              className="px-3.5 py-2 text-xs font-medium border-0 transition-all"
              style={{ ...typeFilterStyle(val), borderRight:i<2?'1px solid #334155':'none' }}>
              {label}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button onClick={() => { setFilters({start:'',end:'',category_id:'',type:'all'}); setPage(0) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors hover:bg-slate-700/50"
            style={{ borderColor:'#334155', color:'#94a3b8' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor:'#334155' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor:'#1e293b', borderBottom:'1px solid #334155' }}>
                {['Date','Description','Party','Category','Amount','Source','Rec.','Actions'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ backgroundColor:'#0f172a' }}>
              {loading ? (
                Array.from({length:6}).map((_,i) => <SkeletonRow key={i}/>)
              ) : transactions.length===0 ? (
                <tr><td colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-16" style={{ color:'#64748b' }}>
                    <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <p className="text-sm">No transactions found</p>
                    <p className="text-xs mt-1" style={{ color:'#475569' }}>Try adjusting your filters</p>
                  </div>
                </td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="border-t transition-colors hover:bg-slate-800/50" style={{ borderColor:'#1e293b' }}>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs" style={{ color:'#64748b' }}>
                      {tx.date ? new Date(tx.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                    </td>
                    <td className="px-4 py-3.5 max-w-[160px]">
                      <div className="font-medium text-white truncate">{tx.description}</div>
                      {tx.invoice_number && <div className="text-[10px] mt-0.5" style={{ color:'#475569' }}>#{tx.invoice_number}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      {tx.party_name ? (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor:'#1e293b', color:'#94a3b8' }}>{tx.party_name}</span>
                      ) : <span style={{ color:'#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {tx.category_name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor:'#1e293b', color:'#94a3b8' }}>
                          {tx.category_color && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor:tx.category_color }}/>}
                          {tx.category_name}
                        </span>
                      ) : <span style={{ color:'#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <CurrencyAmount cents={tx.is_income ? tx.amount_cents : -Math.abs(tx.amount_cents||0)} className="font-semibold text-sm"/>
                    </td>
                    <td className="px-4 py-3.5">
                      {tx.source ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor:'#334155', color:'#94a3b8' }}>{tx.source}</span>
                      ) : <span style={{ color:'#475569' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {tx.is_reconciled ? (
                        <span className="text-emerald-400 text-xs">✓</span>
                      ) : <span style={{ color:'#334155' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {tx.receipt_path && (
                          <a href={tx.receipt_path} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg transition-colors" style={{ color:'#64748b' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor='#33415530'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}
                            title="View receipt">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                          </a>
                        )}
                        <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg transition-colors" style={{ color:'#818cf8' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor='#6366f115'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'} title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(tx.id)} className="p-1.5 rounded-lg transition-colors" style={{ color:'#f87171' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor='#ef444415'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'} title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t" style={{ backgroundColor:'#1e293b', borderColor:'#334155' }}>
            <p className="text-xs" style={{ color:'#64748b' }}>
              Showing {page*limit+1}–{Math.min((page+1)*limit,total)} of {total.toLocaleString()} results
            </p>
            <div className="flex items-center gap-2">
              <button disabled={page===0} onClick={() => setPage(page-1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none"
                style={{ borderColor:'#334155', color:'#94a3b8' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                Prev
              </button>
              <span className="px-3 py-1.5 rounded-xl text-xs font-medium" style={{ color:'#94a3b8', backgroundColor:'#0f172a' }}>{page+1} / {totalPages}</span>
              <button disabled={page>=totalPages-1} onClick={() => setPage(page+1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none"
                style={{ borderColor:'#334155', color:'#94a3b8' }}>
                Next
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSave={handleSave}
        categories={categories}
        parties={parties}
        initial={editTarget}
        onCategoryCreated={handleCategoryCreated}
        onPartyCreated={handlePartyCreated}
      />
    </div>
  )
}
