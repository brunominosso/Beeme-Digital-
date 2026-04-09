'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Client, Task, Invoice, Expense, Profile } from '@/types/database'

const WEEKDAYS = [{ label: 'Dom', value: 0 },{ label: 'Seg', value: 1 },{ label: 'Ter', value: 2 },{ label: 'Qua', value: 3 },{ label: 'Qui', value: 4 },{ label: 'Sex', value: 5 },{ label: 'Sáb', value: 6 }]
function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
function fmt(v: number) { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(v) }

const roleColor = '#4ade80'
const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

export default function HomeFinanceiro({ profile, myClients, allTasks, todayStr, weekEndStr, allInvoices, allExpenses }: {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  todayStr: string
  weekEndStr: string
  allInvoices: Invoice[]
  allExpenses: Expense[]
}) {
  const [tasks, setTasks] = useState(allTasks)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [tTitle, setTTitle] = useState('')
  const [tMode, setTMode] = useState<'date' | 'recurrence'>('date')
  const [tDate, setTDate] = useState(todayStr)
  const [tDays, setTDays] = useState<number[]>([])
  const [tSaving, setTSaving] = useState(false)

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const mesAtual = now.toISOString().slice(0, 7) // "2026-04"

  // Métricas financeiras
  const invoicesPagas = allInvoices.filter(i => i.status === 'paid' && i.paid_at?.startsWith(mesAtual))
  const invoicesPendentes = allInvoices.filter(i => i.status === 'pending' || i.status === 'overdue')
  const invoicesVencidas = allInvoices.filter(i => i.status === 'overdue')
  const receitaMes = invoicesPagas.reduce((s, i) => s + i.amount, 0)
  const aReceber = invoicesPendentes.reduce((s, i) => s + i.amount, 0)
  const despesasMes = allExpenses.filter(e => e.date.startsWith(mesAtual)).reduce((s, e) => s + e.amount, 0)
  const saldo = receitaMes - despesasMes

  // Tarefas de hoje
  function isRecurringOnDay(task: Task, dow: number) {
    if (!task.recurrence) return false
    return task.recurrence.replace('weekly:', '').split(',').map(Number).includes(dow)
  }
  const todayDow = new Date(todayStr + 'T12:00:00').getDay()
  const todayTasks = tasks.filter(t => t.status !== 'done' && (t.due_date?.startsWith(todayStr) || isRecurringOnDay(t, todayDow)))

  async function createTask() {
    if (!tTitle.trim()) return
    setTSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const recurrence = tMode === 'recurrence' && tDays.length > 0 ? `weekly:${tDays.sort().join(',')}` : null
    const { data } = await supabase.from('tasks').insert({ title: tTitle, assignee_id: user?.id, created_by: user?.id, priority: 'medium', status: 'todo', due_date: tMode === 'date' && tDate ? tDate : null, recurrence, position: 0 }).select().single()
    if (data) setTasks(prev => [data as Task, ...prev])
    setTSaving(false); setShowTaskModal(false); setTTitle(''); setTMode('date'); setTDate(todayStr); setTDays([])
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  // Próximas faturas pendentes (ordenadas por vencimento)
  const proximasFaturas = [...invoicesPendentes].sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  }).slice(0, 6)

  // Clientes com valor mensal
  const clientesComValor = myClients.filter(c => c.monthly_value && c.monthly_value > 0).sort((a, b) => (b.monthly_value ?? 0) - (a.monthly_value ?? 0))
  const mrr = clientesComValor.reduce((s, c) => s + (c.monthly_value ?? 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="rounded-2xl p-6 flex items-start justify-between gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: profile.avatar_color || roleColor, color: '#08080F' }}>
            {getInitials(profile.name || '?')}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>{greeting}, {profile.name?.split(' ')[0]}</h1>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}40` }}>Financeiro</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button onClick={() => setShowTaskModal(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: roleColor, color: '#08080F' }}>
          + Nova tarefa
        </button>
      </div>

      {/* KPIs financeiros */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Recebido este mês', value: fmt(receitaMes), icon: '💰', color: roleColor, sub: `${invoicesPagas.length} faturas pagas` },
          { label: 'A receber', value: fmt(aReceber), icon: '📄', color: invoicesVencidas.length > 0 ? 'var(--danger)' : '#f59e0b', sub: `${invoicesVencidas.length > 0 ? `${invoicesVencidas.length} vencidas` : `${invoicesPendentes.length} pendentes`}` },
          { label: 'Despesas este mês', value: fmt(despesasMes), icon: '📉', color: '#ef4444', sub: 'Despesas registadas' },
          { label: 'MRR', value: fmt(mrr), icon: '📈', color: '#a855f7', sub: `${clientesComValor.length} clientes com contrato` },
        ].map(k => (
          <Link key={k.label} href="/financial"
            className="rounded-xl p-4 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--surface)', border: `1px solid ${k.color}25` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{k.icon}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: k.color + '20', color: k.color }}>{k.sub}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: k.color, fontFamily: 'var(--font-barlow)' }}>{k.value}</div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Faturas pendentes */}
        <div className="col-span-2 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Faturas pendentes</h2>
              {invoicesVencidas.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>{invoicesVencidas.length} vencidas</p>
              )}
            </div>
            <Link href="/financial" className="text-xs" style={{ color: roleColor }}>Ver todas →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {proximasFaturas.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem faturas pendentes 🎉
              </div>
            ) : proximasFaturas.map(inv => {
              const isOverdue = inv.status === 'overdue' || (inv.due_date && inv.due_date < todayStr && inv.status !== 'paid')
              const clientName = myClients.find(c => c.id === inv.client_id)?.name ?? 'Cliente'
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{inv.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{clientName}{inv.due_date && ` · Vence ${new Date(inv.due_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: isOverdue ? 'var(--danger)' : 'var(--cream)' }}>{fmt(inv.amount)}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: isOverdue ? 'var(--danger)20' : '#f59e0b20', color: isOverdue ? 'var(--danger)' : '#f59e0b' }}>
                      {isOverdue ? 'Vencida' : 'Pendente'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">

          {/* Tarefas de hoje */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>Tarefas de hoje</h2>
              <button onClick={() => setShowTaskModal(true)} className="text-xs px-2 py-1 rounded-md font-semibold"
                style={{ background: roleColor, color: '#08080F' }}>+ Nova</button>
            </div>
            <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {todayTasks.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Sem tarefas para hoje</p>
              ) : todayTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <button onClick={() => toggleDone(task)}
                    className="w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors"
                    style={{ borderColor: roleColor, background: task.status === 'done' ? roleColor : 'transparent' }}>
                    {task.status === 'done' && <span className="text-black text-xs leading-none">✓</span>}
                  </button>
                  <p className="text-sm flex-1 truncate" style={{ color: 'var(--cream)', textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.5 : 1 }}>{task.title}</p>
                  {task.recurrence && <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>🔁</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Clientes — MRR */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>Clientes ativos</h2>
              <Link href="/leads" className="text-xs" style={{ color: roleColor }}>Ver →</Link>
            </div>
            <div className="p-3 space-y-1.5 max-h-56 overflow-y-auto">
              {clientesComValor.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Sem valores definidos</p>
              ) : clientesComValor.map(c => (
                <div key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: roleColor + '22', color: roleColor }}>
                    {getInitials(c.name)}
                  </div>
                  <p className="text-sm flex-1 truncate font-medium" style={{ color: 'var(--cream)' }}>{c.name}</p>
                  <p className="text-sm font-bold shrink-0" style={{ color: roleColor }}>{fmt(c.monthly_value ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Acesso rápido */}
      <div>
        <h2 className="label-caps mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/financial', label: 'Financeiro', icon: '💸', desc: 'Faturas e despesas' },
            { href: '/leads', label: 'Clientes', icon: '👥', desc: 'Gerir contratos' },
            { href: '/services', label: 'Serviços', icon: '📦', desc: 'Produtos e preços' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:opacity-80 transition-opacity"
              style={{ background: 'var(--surface)', border: `1px solid ${roleColor}20` }}>
              <span className="text-xl shrink-0">{a.icon}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--cream)' }}>{a.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Modal nova tarefa */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Nova tarefa</h2>
              <button onClick={() => setShowTaskModal(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <input type="text" placeholder="Título *" value={tTitle} onChange={e => setTTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
              autoFocus onKeyDown={e => e.key === 'Enter' && createTask()} />
            <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              <button onClick={() => setTMode('date')} className="flex-1 py-1.5 rounded-md text-sm font-medium"
                style={{ background: tMode === 'date' ? roleColor : 'transparent', color: tMode === 'date' ? '#08080F' : 'var(--text-muted)' }}>
                📅 Data
              </button>
              <button onClick={() => setTMode('recurrence')} className="flex-1 py-1.5 rounded-md text-sm font-medium"
                style={{ background: tMode === 'recurrence' ? roleColor : 'transparent', color: tMode === 'recurrence' ? '#08080F' : 'var(--text-muted)' }}>
                🔁 Repetir
              </button>
            </div>
            {tMode === 'date' && (
              <input type="date" value={tDate} onChange={e => setTDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            )}
            {tMode === 'recurrence' && (
              <div className="flex gap-1.5">
                {WEEKDAYS.map(day => (
                  <button key={day.value}
                    onClick={() => setTDays(prev => prev.includes(day.value) ? prev.filter(d => d !== day.value) : [...prev, day.value])}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: tDays.includes(day.value) ? roleColor : 'var(--surface-2)', color: tDays.includes(day.value) ? '#08080F' : 'var(--text-muted)', border: `1px solid ${tDays.includes(day.value) ? roleColor : 'var(--border)'}` }}>
                    {day.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={createTask} disabled={!tTitle.trim() || tSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: roleColor, color: '#08080F' }}>
              {tSaving ? 'A criar...' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
