'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, Expense, Client } from '@/types/database'

type InvoiceWithClient = Invoice & { clients: { name: string } | null }

const EXPENSE_CATEGORIES: Record<string, string> = {
  software: '💻 Software', marketing: '📣 Marketing', office: '🏢 Escritório',
  salary: '👤 Salário', freelancer: '🤝 Freelancer', other: '📦 Outro',
}

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#f59e0b' },
  paid: { label: 'Pago', color: 'var(--success)' },
  overdue: { label: 'Em atraso', color: 'var(--danger)' },
  cancelled: { label: 'Cancelado', color: 'var(--text-muted)' },
}

export default function FinancialView({
  initialInvoices, initialExpenses, clients,
}: {
  initialInvoices: InvoiceWithClient[]
  initialExpenses: Expense[]
  clients: Pick<Client, 'id' | 'name'>[]
}) {
  const [tab, setTab] = useState<'invoices' | 'expenses'>('invoices')
  const [invoices, setInvoices] = useState(initialInvoices)
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showForm, setShowForm] = useState(false)

  // Invoice form
  const [iClientId, setIClientId] = useState('')
  const [iDescription, setIDescription] = useState('')
  const [iAmount, setIAmount] = useState('')
  const [iDueDate, setIDueDate] = useState('')
  const [iNotes, setINotes] = useState('')

  // Expense form
  const [eDescription, setEDescription] = useState('')
  const [eCategory, setECategory] = useState('other')
  const [eAmount, setEAmount] = useState('')
  const [eDate, setEDate] = useState(new Date().toISOString().split('T')[0])
  const [eNotes, setENotes] = useState('')

  const [saving, setSaving] = useState(false)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthInvoices = invoices.filter(i => new Date(i.created_at) >= startOfMonth)
  const totalPaid = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
  const totalPending = monthInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.filter(e => new Date(e.date) >= startOfMonth).reduce((s, e) => s + Number(e.amount), 0)

  async function saveInvoice() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('invoices').insert({
      client_id: iClientId, description: iDescription,
      amount: parseFloat(iAmount), due_date: iDueDate || null,
      notes: iNotes || null, created_by: user?.id,
    }).select('*, clients(name)').single()
    if (data) setInvoices(prev => [data as InvoiceWithClient, ...prev])
    setSaving(false); setShowForm(false)
    setIClientId(''); setIDescription(''); setIAmount(''); setIDueDate(''); setINotes('')
  }

  async function saveExpense() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('expenses').insert({
      description: eDescription, category: eCategory,
      amount: parseFloat(eAmount), date: eDate,
      notes: eNotes || null, created_by: user?.id,
    }).select().single()
    if (data) setExpenses(prev => [data as Expense, ...prev])
    setSaving(false); setShowForm(false)
    setEDescription(''); setECategory('other'); setEAmount(''); setENotes('')
  }

  async function markPaid(id: string) {
    const supabase = createClient()
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
  }

  async function deleteInvoice(id: string) {
    if (!confirm('Eliminar fatura?')) return
    const supabase = createClient()
    await supabase.from('invoices').delete().eq('id', id)
    setInvoices(prev => prev.filter(i => i.id !== id))
  }

  async function deleteExpense(id: string) {
    if (!confirm('Eliminar despesa?')) return
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          + {tab === 'invoices' ? 'Nova fatura' : 'Nova despesa'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Recebido este mês', value: `€${totalPaid.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: 'var(--success)' },
          { label: 'A receber', value: `€${totalPending.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: '#a855f7' },
          { label: 'Despesas este mês', value: `€${totalExpenses.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: 'var(--danger)' },
          { label: 'Resultado', value: `€${(totalPaid - totalExpenses).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, color: totalPaid - totalExpenses >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['invoices', 'expenses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t ? 'var(--surface-2)' : 'transparent',
              color: tab === t ? 'white' : 'var(--text-muted)',
              border: `1px solid ${tab === t ? 'var(--border)' : 'transparent'}`,
            }}>
            {t === 'invoices' ? '🧾 Faturas' : '💸 Despesas'}
          </button>
        ))}
      </div>

      {/* Invoices list */}
      {tab === 'invoices' && (
        <div className="space-y-2">
          {!invoices.length ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-4xl mb-2">🧾</p>
              <p className="text-white font-medium">Nenhuma fatura ainda</p>
            </div>
          ) : invoices.map(inv => {
            const s = INVOICE_STATUS[inv.status] ?? INVOICE_STATUS.pending
            return (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-4 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{inv.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {inv.clients?.name} · {new Date(inv.created_at).toLocaleDateString('pt-PT')}
                    {inv.due_date && ` · Vence ${new Date(inv.due_date).toLocaleDateString('pt-PT')}`}
                  </p>
                </div>
                <span className="font-bold text-white">€{Number(inv.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>
                  {s.label}
                </span>
                {inv.status === 'pending' && (
                  <button onClick={() => markPaid(inv.id)}
                    className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: 'var(--success)20', color: 'var(--success)', border: '1px solid var(--success)' }}>
                    ✓ Marcar pago
                  </button>
                )}
                <button onClick={() => deleteInvoice(inv.id)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Expenses list */}
      {tab === 'expenses' && (
        <div className="space-y-2">
          {!expenses.length ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-4xl mb-2">💸</p>
              <p className="text-white font-medium">Nenhuma despesa ainda</p>
            </div>
          ) : expenses.map(exp => (
            <div key={exp.id} className="flex items-center gap-4 px-5 py-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span className="text-lg">{EXPENSE_CATEGORIES[exp.category]?.split(' ')[0] ?? '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{exp.description}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {EXPENSE_CATEGORIES[exp.category]} · {new Date(exp.date).toLocaleDateString('pt-PT')}
                </p>
              </div>
              <span className="font-bold" style={{ color: 'var(--danger)' }}>
                -€{Number(exp.amount).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
              </span>
              <button onClick={() => deleteExpense(exp.id)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">{tab === 'invoices' ? 'Nova fatura' : 'Nova despesa'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {tab === 'invoices' ? (
              <>
                <select value={iClientId} onChange={e => setIClientId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Seleciona o cliente *</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Descrição *" value={iDescription} onChange={e => setIDescription(e.target.value)} className={inputClass} style={inputStyle} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Valor (€) *" value={iAmount} onChange={e => setIAmount(e.target.value)} className={inputClass} style={inputStyle} />
                  <input type="date" value={iDueDate} onChange={e => setIDueDate(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <textarea placeholder="Notas (opcional)" value={iNotes} onChange={e => setINotes(e.target.value)} rows={2} className={inputClass} style={inputStyle} />
                <button onClick={saveInvoice} disabled={!iClientId || !iDescription || !iAmount || saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {saving ? 'A guardar...' : 'Criar fatura'}
                </button>
              </>
            ) : (
              <>
                <input type="text" placeholder="Descrição *" value={eDescription} onChange={e => setEDescription(e.target.value)} className={inputClass} style={inputStyle} />
                <div className="grid grid-cols-2 gap-3">
                  <select value={eCategory} onChange={e => setECategory(e.target.value)} className={inputClass} style={inputStyle}>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input type="number" placeholder="Valor (€) *" value={eAmount} onChange={e => setEAmount(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <input type="date" value={eDate} onChange={e => setEDate(e.target.value)} className={inputClass} style={inputStyle} />
                <textarea placeholder="Notas (opcional)" value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} className={inputClass} style={inputStyle} />
                <button onClick={saveExpense} disabled={!eDescription || !eAmount || saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {saving ? 'A guardar...' : 'Registar despesa'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
