'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, Expense, Client, PaymentSchedule } from '@/types/database'

type InvoiceWithClient = Invoice & { clients: { name: string } | null }
type ScheduleWithClient = PaymentSchedule & { clients: { name: string; status: string } | null }
type ClientOption = Pick<Client, 'id' | 'name' | 'monthly_value' | 'payment_day' | 'status'>

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

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
}

export default function FinancialView({
  initialInvoices, initialExpenses, clients, initialSchedules,
}: {
  initialInvoices: InvoiceWithClient[]
  initialExpenses: Expense[]
  clients: ClientOption[]
  initialSchedules: ScheduleWithClient[]
}) {
  const [tab, setTab] = useState<'invoices' | 'expenses' | 'schedules'>('invoices')
  const [invoices, setInvoices] = useState(initialInvoices)
  const [expenses, setExpenses] = useState(initialExpenses)
  const [schedules, setSchedules] = useState(initialSchedules)
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

  // Schedule form
  const [sClientId, setSClientId] = useState('')
  const [sDescription, setSDescription] = useState('Mensalidade')
  const [sAmount, setSAmount] = useState('')
  const [sDay, setSDay] = useState('')

  const [saving, setSaving] = useState(false)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const monthInvoices = invoices.filter(i => new Date(i.created_at) >= startOfMonth)
  const totalPaid = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0)
  const totalPending = monthInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.filter(e => new Date(e.date) >= startOfMonth).reduce((s, e) => s + Number(e.amount), 0)

  // MRR = soma das recorrências ativas com cliente ativo
  const mrr = schedules.filter(s => s.active && s.clients?.status === 'ativo').reduce((acc, s) => acc + Number(s.amount), 0)

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

  async function saveSchedule() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('payment_schedules').insert({
      client_id: sClientId,
      description: sDescription || 'Mensalidade',
      amount: parseFloat(sAmount),
      payment_day: parseInt(sDay),
      created_by: user?.id,
    }).select('*, clients(name, status)').single()
    if (data) setSchedules(prev => [...prev, data as ScheduleWithClient].sort((a, b) => a.payment_day - b.payment_day))
    setSaving(false); setShowForm(false)
    setSClientId(''); setSDescription('Mensalidade'); setSAmount(''); setSDay('')
  }

  async function toggleSchedule(id: string, active: boolean) {
    const supabase = createClient()
    await supabase.from('payment_schedules').update({ active }).eq('id', id)
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active } : s))
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Remover esta recorrência?')) return
    const supabase = createClient()
    await supabase.from('payment_schedules').delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
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

  // Preenche campos do formulário de recorrência ao selecionar cliente
  function onScheduleClientChange(clientId: string) {
    setSClientId(clientId)
    const c = clients.find(c => c.id === clientId)
    if (c) {
      if (c.monthly_value) setSAmount(String(c.monthly_value))
      if (c.payment_day) setSDay(String(c.payment_day))
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  // A aba de recorrências só aparece se o componente recebeu dados (role financeiro)
  const hasSchedulesAccess = initialSchedules !== null

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        {tab !== 'schedules' && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + {tab === 'invoices' ? 'Nova fatura' : 'Nova despesa'}
          </button>
        )}
        {tab === 'schedules' && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + Nova recorrência
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Recebido este mês', value: fmt(totalPaid), color: 'var(--success)' },
          { label: 'A receber', value: fmt(totalPending), color: '#a855f7' },
          { label: 'Despesas este mês', value: fmt(totalExpenses), color: 'var(--danger)' },
          { label: 'Resultado', value: fmt(totalPaid - totalExpenses), color: totalPaid - totalExpenses >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* MRR card — só visível para quem tem acesso às recorrências */}
      {hasSchedulesAccess && mrr > 0 && (
        <div className="rounded-xl p-4 mb-6 flex items-center gap-4"
          style={{ background: 'var(--surface)', border: '1px solid #a855f720' }}>
          <span className="text-2xl">📈</span>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MRR previsto (clientes ativos)</p>
            <p className="text-xl font-bold" style={{ color: '#a855f7' }}>{fmt(mrr)}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{schedules.filter(s => s.active && s.clients?.status === 'ativo').length} contratos ativos</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'invoices', label: '🧾 Faturas' },
          { key: 'expenses', label: '💸 Despesas' },
          ...(hasSchedulesAccess ? [{ key: 'schedules', label: '📅 Recorrências' }] : []),
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: tab === t.key ? 'var(--surface-2)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-muted)',
              border: `1px solid ${tab === t.key ? 'var(--border)' : 'transparent'}`,
            }}>
            {t.label}
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
                    {inv.clients?.name} · {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                    {inv.due_date && ` · Vence ${new Date(inv.due_date).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <span className="font-bold text-white">{fmt(Number(inv.amount))}</span>
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
                  {EXPENSE_CATEGORIES[exp.category]} · {new Date(exp.date).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className="font-bold" style={{ color: 'var(--danger)' }}>
                -{fmt(Number(exp.amount))}
              </span>
              <button onClick={() => deleteExpense(exp.id)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Schedules list */}
      {tab === 'schedules' && (
        <div className="space-y-2">
          {!schedules.length ? (
            <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-4xl mb-2">📅</p>
              <p className="text-white font-medium">Nenhuma recorrência cadastrada</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Adicione os pagamentos mensais de cada cliente</p>
            </div>
          ) : schedules.map(s => {
            const clientInactive = s.clients?.status !== 'ativo'
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4 rounded-xl"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${s.active && !clientInactive ? 'var(--border)' : 'var(--border)'}`,
                  opacity: s.active && !clientInactive ? 1 : 0.55,
                }}>
                <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                  style={{ background: s.active && !clientInactive ? '#a855f720' : 'var(--surface-2)' }}>
                  <span className="text-xs font-bold leading-none" style={{ color: s.active && !clientInactive ? '#a855f7' : 'var(--text-muted)' }}>dia</span>
                  <span className="text-sm font-bold leading-none" style={{ color: s.active && !clientInactive ? '#a855f7' : 'var(--text-muted)' }}>{s.payment_day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{s.clients?.name ?? '—'}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {s.description}
                    {clientInactive && <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--danger)20', color: 'var(--danger)' }}>cliente inativo</span>}
                  </p>
                </div>
                <span className="font-bold text-white">{fmt(Number(s.amount))}</span>
                <button
                  onClick={() => toggleSchedule(s.id, !s.active)}
                  className="text-xs px-2 py-1 rounded-lg font-medium shrink-0"
                  style={{
                    background: s.active ? 'var(--success)20' : 'var(--surface-2)',
                    color: s.active ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${s.active ? 'var(--success)' : 'var(--border)'}`,
                  }}>
                  {s.active ? '● Ativa' : '○ Pausada'}
                </button>
                <button onClick={() => deleteSchedule(s.id)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">
                {tab === 'invoices' ? 'Nova fatura' : tab === 'expenses' ? 'Nova despesa' : 'Nova recorrência'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {tab === 'invoices' && (
              <>
                <select value={iClientId} onChange={e => setIClientId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Seleciona o cliente *</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Descrição *" value={iDescription} onChange={e => setIDescription(e.target.value)} className={inputClass} style={inputStyle} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Valor (R$) *" value={iAmount} onChange={e => setIAmount(e.target.value)} className={inputClass} style={inputStyle} />
                  <input type="date" value={iDueDate} onChange={e => setIDueDate(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <textarea placeholder="Notas (opcional)" value={iNotes} onChange={e => setINotes(e.target.value)} rows={2} className={inputClass} style={inputStyle} />
                <button onClick={saveInvoice} disabled={!iClientId || !iDescription || !iAmount || saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {saving ? 'A guardar...' : 'Criar fatura'}
                </button>
              </>
            )}

            {tab === 'expenses' && (
              <>
                <input type="text" placeholder="Descrição *" value={eDescription} onChange={e => setEDescription(e.target.value)} className={inputClass} style={inputStyle} />
                <div className="grid grid-cols-2 gap-3">
                  <select value={eCategory} onChange={e => setECategory(e.target.value)} className={inputClass} style={inputStyle}>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input type="number" placeholder="Valor (R$) *" value={eAmount} onChange={e => setEAmount(e.target.value)} className={inputClass} style={inputStyle} />
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

            {tab === 'schedules' && (
              <>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  O valor e dia são preenchidos automaticamente com os dados do cliente.
                </p>
                <select value={sClientId} onChange={e => onScheduleClientChange(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Seleciona o cliente *</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="text" placeholder="Descrição (ex: Mensalidade)" value={sDescription} onChange={e => setSDescription(e.target.value)} className={inputClass} style={inputStyle} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Valor mensal (R$) *" value={sAmount} onChange={e => setSAmount(e.target.value)} className={inputClass} style={inputStyle} />
                  <input type="number" min={1} max={31} placeholder="Dia do mês *" value={sDay} onChange={e => setSDay(e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <button onClick={saveSchedule} disabled={!sClientId || !sAmount || !sDay || saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {saving ? 'A guardar...' : 'Criar recorrência'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
