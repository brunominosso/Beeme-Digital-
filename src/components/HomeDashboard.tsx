'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client, Task, Meeting, Profile } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  gestor: 'Gestor de Tráfego',
  social_media: 'Social Media',
  designer: 'Designer',
  editor: 'Editor de Vídeos',
  admin: 'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  gestor: '#6c63ff',
  social_media: '#f59e0b',
  designer: '#ec4899',
  editor: '#10b981',
  admin: '#ef4444',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--danger)',
  high: '#f59e0b',
  medium: 'var(--accent)',
  low: 'var(--text-muted)',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const WEEKDAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
]

type TaskTab = 'hoje' | 'amanha' | 'semana' | 'concluidas'

interface Props {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  upcomingMeetings: Meeting[]
  todayStr: string
  tomorrowStr: string
  weekEndStr: string
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getRoleStats(role: string, myClients: Client[], weekCount: number, meetingsCount: number, roleColor: string) {
  const active = myClients.filter(c => c.status === 'ativo').length
  const onboarding = myClients.filter(c => c.status === 'onboarding').length

  const base = [
    { label: 'Tarefas esta semana', value: weekCount, icon: '📋', href: '/kanban', color: '#f59e0b' },
    { label: 'Reuniões agendadas', value: meetingsCount, icon: '📅', href: '/meetings', color: roleColor },
  ]

  switch (role) {
    case 'gestor':
      return [
        { label: 'Clientes ativos', value: active, icon: '👥', href: '/leads', color: roleColor },
        { label: 'Em onboarding', value: onboarding, icon: '🚀', href: '/leads', color: '#a855f7' },
        ...base,
      ]
    case 'social_media':
      return [
        { label: 'Clientes ativos', value: active, icon: '👥', href: '/leads', color: roleColor },
        { label: 'Conteúdos esta semana', value: weekCount, icon: '✍️', href: '/kanban', color: '#f59e0b' },
        { label: 'Reuniões agendadas', value: meetingsCount, icon: '📅', href: '/meetings', color: roleColor },
        { label: 'Em onboarding', value: onboarding, icon: '🚀', href: '/leads', color: '#a855f7' },
      ]
    case 'designer':
      return [
        { label: 'Clientes ativos', value: active, icon: '👥', href: '/leads', color: roleColor },
        { label: 'Projetos esta semana', value: weekCount, icon: '🎨', href: '/kanban', color: '#f59e0b' },
        { label: 'Reuniões agendadas', value: meetingsCount, icon: '📅', href: '/meetings', color: roleColor },
        { label: 'Total clientes', value: myClients.length, icon: '📁', href: '/leads', color: '#a855f7' },
      ]
    case 'editor':
      return [
        { label: 'Clientes ativos', value: active, icon: '👥', href: '/leads', color: roleColor },
        { label: 'Vídeos esta semana', value: weekCount, icon: '🎬', href: '/kanban', color: '#f59e0b' },
        { label: 'Reuniões agendadas', value: meetingsCount, icon: '📅', href: '/meetings', color: roleColor },
        { label: 'Total clientes', value: myClients.length, icon: '📁', href: '/leads', color: '#a855f7' },
      ]
    case 'admin':
      return [
        { label: 'Total clientes', value: myClients.length, icon: '👥', href: '/leads', color: roleColor },
        { label: 'Clientes ativos', value: active, icon: '✅', href: '/leads', color: '#4ade80' },
        { label: 'Tarefas esta semana', value: weekCount, icon: '📋', href: '/kanban', color: '#f59e0b' },
        { label: 'Reuniões agendadas', value: meetingsCount, icon: '📅', href: '/meetings', color: roleColor },
      ]
    default:
      return [
        { label: 'Clientes ativos', value: active, icon: '👥', href: '/leads', color: roleColor },
        ...base,
        { label: 'Em onboarding', value: onboarding, icon: '🚀', href: '/leads', color: '#a855f7' },
      ]
  }
}

function getRoleQuickActions(role: string) {
  switch (role) {
    case 'gestor':
      return [
        { href: '/leads', label: 'Ver clientes', icon: '👥' },
        { href: '/meetings', label: 'Agendar reunião', icon: '📅' },
        { href: '/kanban', label: 'Ver tarefas', icon: '📋' },
      ]
    case 'social_media':
      return [
        { href: '/leads', label: 'Ver clientes', icon: '👥' },
        { href: '/kanban', label: 'Criar conteúdo', icon: '✍️' },
        { href: '/meetings', label: 'Reuniões', icon: '📅' },
      ]
    case 'designer':
      return [
        { href: '/leads', label: 'Ver clientes', icon: '👥' },
        { href: '/kanban', label: 'Projetos', icon: '🎨' },
        { href: '/services', label: 'Serviços', icon: '📦' },
      ]
    case 'editor':
      return [
        { href: '/leads', label: 'Ver clientes', icon: '👥' },
        { href: '/kanban', label: 'Projetos vídeo', icon: '🎬' },
        { href: '/runs', label: 'Roteiros', icon: '📝' },
      ]
    case 'admin':
      return [
        { href: '/leads', label: 'Leads & Clientes', icon: '👥' },
        { href: '/goals', label: 'Metas & OKR', icon: '🎯' },
        { href: '/financial', label: 'Financeiro', icon: '💰' },
      ]
    default:
      return [
        { href: '/leads', label: 'Ver clientes', icon: '👥' },
        { href: '/kanban', label: 'Tarefas', icon: '📋' },
        { href: '/meetings', label: 'Reuniões', icon: '📅' },
      ]
  }
}

export default function HomeDashboard({
  profile, myClients, allTasks, upcomingMeetings,
  todayStr, tomorrowStr, weekEndStr,
}: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState(allTasks)
  const [taskTab, setTaskTab] = useState<TaskTab>('hoje')
  const [responsibilities, setResponsibilities] = useState(profile.responsibilities || '')
  const [editingResp, setEditingResp] = useState(false)
  const [respDraft, setRespDraft] = useState(responsibilities)
  const [savingResp, setSavingResp] = useState(false)

  // Task create modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [tTitle, setTTitle] = useState('')
  const [tDescription, setTDescription] = useState('')
  const [tPriority, setTPriority] = useState('medium')
  const [tMode, setTMode] = useState<'date' | 'recurrence'>('date')
  const [tDate, setTDate] = useState(todayStr)
  const [tDays, setTDays] = useState<number[]>([])
  const [tSaving, setTSaving] = useState(false)

  const roleColor = ROLE_COLORS[profile.role] || 'var(--accent)'
  const roleLabel = ROLE_LABELS[profile.role] || profile.role

  function isRecurringOnDay(task: Task, dayOfWeek: number) {
    if (!task.recurrence) return false
    const days = task.recurrence.replace('weekly:', '').split(',').map(Number)
    return days.includes(dayOfWeek)
  }
  const todayDow = new Date(todayStr + 'T12:00:00').getDay()
  const tomorrowDow = new Date(tomorrowStr + 'T12:00:00').getDay()

  const tasksByTab: Record<TaskTab, Task[]> = {
    hoje: tasks.filter(t =>
      t.status !== 'done' && (
        (t.due_date && t.due_date.startsWith(todayStr)) ||
        isRecurringOnDay(t, todayDow)
      )
    ),
    amanha: tasks.filter(t =>
      t.status !== 'done' && (
        (t.due_date && t.due_date.startsWith(tomorrowStr)) ||
        isRecurringOnDay(t, tomorrowDow)
      )
    ),
    semana: tasks.filter(t =>
      t.status !== 'done' && (
        (t.due_date && t.due_date >= todayStr && t.due_date <= weekEndStr) ||
        !!t.recurrence
      )
    ),
    concluidas: tasks.filter(t => t.status === 'done').slice(0, 10),
  }

  const visibleTasks = tasksByTab[taskTab]
  const todayCount = tasksByTab.hoje.length
  const weekCount = tasksByTab.semana.length

  async function saveResponsibilities() {
    setSavingResp(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ responsibilities: respDraft }).eq('id', profile.id)
    setResponsibilities(respDraft)
    setSavingResp(false)
    setEditingResp(false)
  }

  async function createTask() {
    if (!tTitle.trim()) return
    if (tMode === 'recurrence' && tDays.length === 0) return
    setTSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const recurrence = tMode === 'recurrence' ? `weekly:${tDays.sort().join(',')}` : null

    const { data } = await supabase.from('tasks').insert({
      title: tTitle,
      description: tDescription || null,
      assignee_id: user?.id,
      created_by: user?.id,
      priority: tPriority,
      status: 'todo',
      due_date: tMode === 'date' && tDate ? tDate : null,
      recurrence,
      position: 0,
    }).select().single()

    if (data) setTasks(prev => [data as Task, ...prev])
    setTSaving(false)
    setShowTaskModal(false)
    setTTitle(''); setTDescription(''); setTPriority('medium')
    setTMode('date'); setTDate(todayStr); setTDays([])
  }

  function toggleDay(day: number) {
    setTDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function toggleTaskDone(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile.name?.split(' ')[0] || 'aí'

  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const doneMeetings = upcomingMeetings.filter(m => m.status === 'done')

  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }
  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Hero header */}
      <div className="rounded-2xl p-6 flex items-start gap-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ background: profile.avatar_color || roleColor }}>
          {getInitials(profile.name || '?')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{greeting}, {firstName}</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}40` }}>
              {roleLabel}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          <div className="mt-3">
            {editingResp ? (
              <div className="flex gap-2 items-start">
                <textarea value={respDraft} onChange={e => setRespDraft(e.target.value)}
                  rows={2} placeholder="Descreve as tuas principais responsabilidades..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white resize-none outline-none"
                  style={inputStyle} autoFocus />
                <button onClick={saveResponsibilities} disabled={savingResp}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}>
                  {savingResp ? '...' : 'Guardar'}
                </button>
                <button onClick={() => { setEditingResp(false); setRespDraft(responsibilities) }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingResp(true); setRespDraft(responsibilities) }}
                className="text-left group flex items-start gap-1.5 text-sm transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                <span className="opacity-0 group-hover:opacity-100 text-xs mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>✎</span>
                <span className={responsibilities ? '' : 'italic'}>
                  {responsibilities || 'Clica para adicionar as tuas principais responsabilidades...'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="text-xl font-bold text-white">{myClients.length}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Clientes</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="text-xl font-bold" style={{ color: todayCount > 0 ? '#f59e0b' : 'white' }}>{todayCount}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hoje</div>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="text-xl font-bold" style={{ color: scheduledMeetings.length > 0 ? roleColor : 'white' }}>{scheduledMeetings.length}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Reuniões</div>
          </div>
        </div>
      </div>

      {/* Stats row — por role */}
      <div className="grid grid-cols-4 gap-4">
        {getRoleStats(profile.role, myClients, weekCount, scheduledMeetings.length, roleColor).map(stat => (
          <Link key={stat.label} href={stat.href}
            className="rounded-xl p-4 hover:opacity-90 transition-opacity flex items-center gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: stat.color + '20' }}>
              {stat.icon}
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Seus clientes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>SEUS CLIENTES</h2>
          <Link href="/leads" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todos →</Link>
        </div>
        {myClients.length === 0 ? (
          <div className="rounded-xl p-8 flex items-center gap-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-3xl shrink-0">👥</div>
            <div>
              <p className="text-white font-medium">Ainda sem clientes atribuídos a ti</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Para ver clientes aqui: vai a{' '}
                <Link href="/leads" className="underline" style={{ color: 'var(--accent)' }}>Leads & Clientes</Link>
                {' '}→ clica num cliente → na secção <strong className="text-white">Responsáveis</strong> clica no teu nome para te adicionar.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {myClients.slice(0, 10).map(c => (
              <button key={c.id}
                onClick={() => router.push(`/leads/${c.id}`)}
                className="rounded-xl overflow-hidden text-left hover:opacity-90 transition-opacity"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="h-20 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                      style={{ background: roleColor }}>
                      {getInitials(c.name)}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{
                      background: c.status === 'ativo' ? 'var(--success)' :
                        c.status === 'onboarding' ? '#f59e0b' : 'var(--text-muted)'
                    }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.status === 'ativo' ? 'Ativo' : c.status === 'onboarding' ? 'Onboarding' :
                        c.status === 'em_negociacao' ? 'Em negociação' : c.status}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom 2-col: Tasks + Meetings */}
      <div className="grid grid-cols-2 gap-6">

        {/* Tarefas com tabs */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Acompanhamento de Tarefas</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTaskModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                  style={{ background: 'var(--accent)' }}>
                  + Nova tarefa
                </button>
                <Link href="/kanban" className="text-xs" style={{ color: 'var(--text-muted)' }}>Kanban →</Link>
              </div>
            </div>
            <div className="flex gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {([
                { key: 'hoje', label: 'Hoje', count: tasksByTab.hoje.length },
                { key: 'amanha', label: 'Amanhã', count: tasksByTab.amanha.length },
                { key: 'semana', label: 'Esta semana', count: tasksByTab.semana.length },
                { key: 'concluidas', label: 'Concluídas', count: null },
              ] as { key: TaskTab; label: string; count: number | null }[]).map(tab => (
                <button key={tab.key}
                  onClick={() => setTaskTab(tab.key)}
                  className="px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors -mb-px"
                  style={{
                    borderColor: taskTab === tab.key ? 'var(--accent)' : 'transparent',
                    color: taskTab === tab.key ? 'white' : 'var(--text-muted)',
                  }}>
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: taskTab === tab.key ? 'var(--accent)' : 'var(--surface-2)', color: taskTab === tab.key ? 'white' : 'var(--text-muted)' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-1.5 min-h-48 max-h-72 overflow-y-auto">
            {visibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {taskTab === 'concluidas' ? 'Nenhuma tarefa concluída ainda' : 'Sem tarefas para este período 🎉'}
                </p>
                {taskTab !== 'concluidas' && (
                  <button onClick={() => setShowTaskModal(true)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                    + Criar tarefa
                  </button>
                )}
              </div>
            ) : (
              visibleTasks.map(task => (
                <div key={task.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                  style={{ background: 'var(--surface-2)' }}>
                  <button
                    onClick={() => toggleTaskDone(task)}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      borderColor: task.status === 'done' ? 'var(--success)' : PRIORITY_COLOR[task.priority],
                      background: task.status === 'done' ? 'var(--success)' : 'transparent',
                    }}>
                    {task.status === 'done' && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate" style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                      {task.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {PRIORITY_LABEL[task.priority]}
                      {task.recurrence && ' · 🔁 Recorrente'}
                      {task.due_date && ` · ${new Date(task.due_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reuniões */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Reuniões</h2>
              <Link href="/leads" className="text-xs" style={{ color: 'var(--text-muted)' }}>Ver todas →</Link>
            </div>
            <div className="flex gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {[
                { key: 'agendadas', label: 'Agendadas', count: scheduledMeetings.length },
                { key: 'realizadas', label: 'Realizadas', count: doneMeetings.length },
              ].map(tab => (
                <button key={tab.key}
                  className="px-3 py-2 text-xs font-medium border-b-2 -mb-px flex items-center gap-1.5"
                  style={{
                    borderColor: tab.key === 'agendadas' ? 'var(--accent)' : 'transparent',
                    color: tab.key === 'agendadas' ? 'white' : 'var(--text-muted)',
                  }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--surface-2)' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 space-y-1.5 min-h-48 max-h-72 overflow-y-auto">
            {scheduledMeetings.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem reuniões agendadas</p>
              </div>
            ) : (
              scheduledMeetings.map(meeting => {
                const d = new Date(meeting.date)
                const isToday = meeting.date.startsWith(todayStr)
                return (
                  <div key={meeting.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                    style={{ background: 'var(--surface-2)' }}>
                    <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-center"
                      style={{ background: isToday ? roleColor + '20' : 'var(--surface)', border: `1px solid ${isToday ? roleColor : 'var(--border)'}` }}>
                      <span className="text-xs font-bold leading-none" style={{ color: isToday ? roleColor : 'white' }}>
                        {d.getDate()}
                      </span>
                      <span className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {d.toLocaleDateString('pt-PT', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{meeting.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                        {isToday && <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: roleColor + '30', color: roleColor }}>Hoje</span>}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick actions por role */}
      <div>
        <h2 className="label-caps mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-3 gap-3">
          {getRoleQuickActions(profile.role).map(action => (
            <Link key={action.href} href={action.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span className="text-lg">{action.icon}</span>
              <span style={{ color: 'var(--cream)' }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Task create modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Nova Tarefa</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-lg leading-none" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Título da tarefa *" value={tTitle} onChange={e => setTTitle(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus
              onKeyDown={e => e.key === 'Enter' && createTask()} />

            <input type="text" placeholder="Descrição (opcional)" value={tDescription} onChange={e => setTDescription(e.target.value)}
              className={inputClass} style={inputStyle} />

            {/* Priority */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Prioridade</p>
              <div className="flex gap-2">
                {[
                  { value: 'low', label: 'Baixa', color: 'var(--text-muted)' },
                  { value: 'medium', label: 'Média', color: 'var(--accent)' },
                  { value: 'high', label: 'Alta', color: '#f59e0b' },
                  { value: 'urgent', label: 'Urgente', color: 'var(--danger)' },
                ].map(p => (
                  <button key={p.value} onClick={() => setTPriority(p.value)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: tPriority === p.value ? p.color + '30' : 'var(--surface-2)',
                      color: tPriority === p.value ? p.color : 'var(--text-muted)',
                      border: `1px solid ${tPriority === p.value ? p.color : 'var(--border)'}`,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Agendamento</p>
              <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <button onClick={() => setTMode('date')}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ background: tMode === 'date' ? 'var(--accent)' : 'transparent', color: tMode === 'date' ? 'white' : 'var(--text-muted)' }}>
                  📅 Data
                </button>
                <button onClick={() => setTMode('recurrence')}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ background: tMode === 'recurrence' ? 'var(--accent)' : 'transparent', color: tMode === 'recurrence' ? 'white' : 'var(--text-muted)' }}>
                  🔁 Repetir
                </button>
              </div>
            </div>

            {tMode === 'date' && (
              <input type="date" value={tDate} onChange={e => setTDate(e.target.value)}
                className={inputClass} style={inputStyle} />
            )}

            {tMode === 'recurrence' && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Repetir todos os</p>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map(day => (
                    <button key={day.value} onClick={() => toggleDay(day.value)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: tDays.includes(day.value) ? 'var(--accent)' : 'var(--surface-2)',
                        color: tDays.includes(day.value) ? 'white' : 'var(--text-muted)',
                        border: `1px solid ${tDays.includes(day.value) ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                      {day.label}
                    </button>
                  ))}
                </div>
                {tDays.length > 0 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                    Repete toda {tDays.map(d => WEEKDAYS[d]?.label).join(', ')}
                  </p>
                )}
              </div>
            )}

            <button onClick={createTask}
              disabled={!tTitle.trim() || (tMode === 'recurrence' && tDays.length === 0) || tSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {tSaving ? 'A criar...' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
