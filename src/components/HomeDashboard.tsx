'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client, Task, Meeting, Profile, Post } from '@/types/database'

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
  { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 }, { label: 'Sáb', value: 6 },
]

const POST_STATUSES = [
  { key: 'nao_iniciado',   label: 'Não iniciado',   color: '#6b7280' },
  { key: 'em_andamento',   label: 'Em andamento',   color: '#3b82f6' },
  { key: 'criar_copy',     label: 'Criar copy',     color: '#8b5cf6' },
  { key: 'fazer_captacao', label: 'Fazer captação', color: '#f59e0b' },
  { key: 'editar_video',   label: 'Editar vídeo',   color: '#ec4899' },
  { key: 'criar_arte',     label: 'Criar arte',     color: '#f97316' },
  { key: 'em_aprovacao',   label: 'Em aprovação',   color: '#eab308' },
  { key: 'publicado',      label: 'Publicado',      color: '#22c55e' },
]

type TaskTab = 'hoje' | 'amanha' | 'semana' | 'concluidas'

interface Props {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  upcomingMeetings: Meeting[]
  todayStr: string
  tomorrowStr: string
  weekEndStr?: string
  allProfiles?: Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]
  allPosts?: Post[]
  allClients?: Client[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ────────────────────────────────────────────────────────────────
// ADMIN VIEW
// ────────────────────────────────────────────────────────────────

function AdminView({ profile, myClients, allTasks, upcomingMeetings, todayStr, tomorrowStr, allProfiles, allPosts }: Props & {
  allProfiles: Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]
  allPosts: Post[]
}) {
  const router = useRouter()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const roleColor = ROLE_COLORS['admin']

  const activeClients = myClients.filter(c => c.status === 'ativo')
  const onboardingClients = myClients.filter(c => c.status === 'onboarding')
  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const todayMeetings = scheduledMeetings.filter(m => m.date.startsWith(todayStr))
  const urgentTasks = allTasks.filter(t => t.status !== 'done' && t.priority === 'urgent')
  const pendingPosts = allPosts.filter(p => p.status !== 'publicado')

  const postsByStatus = POST_STATUSES.map(s => ({
    ...s,
    count: allPosts.filter(p => p.status === s.key).length,
  }))

  const teamWithStats = allProfiles
    .filter(p => p.id !== profile.id)
    .map(p => ({
      ...p,
      pendingTasks: allTasks.filter(t => t.status !== 'done' && (t.assignee_id === p.id || t.created_by === p.id)).length,
      activePosts: allPosts.filter(post => post.assignee_ids?.includes(p.id) && post.status !== 'publicado').length,
      urgentCount: allTasks.filter(t => t.status !== 'done' && t.priority === 'urgent' && (t.assignee_id === p.id || t.created_by === p.id)).length,
    }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 flex items-start gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 text-white"
          style={{ background: profile.avatar_color || roleColor }}>
          {getInitials(profile.name || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{greeting}, {profile.name?.split(' ')[0]}</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}40` }}>
              Admin
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { v: myClients.length, l: 'Clientes', c: '#4ade80' },
            { v: allProfiles.length, l: 'Equipa', c: roleColor },
            { v: urgentTasks.length, l: 'Urgentes', c: urgentTasks.length > 0 ? 'var(--danger)' : 'white' },
            { v: todayMeetings.length, l: 'Reuniões hoje', c: todayMeetings.length > 0 ? '#6c63ff' : 'white' },
          ].map(s => (
            <div key={s.l} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-bold" style={{ color: s.c }}>{s.v}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { href: '/admin', label: 'Gerir equipa', icon: '👥', color: roleColor },
          { href: '/leads', label: 'Leads & Clientes', icon: '📊', color: '#4ade80' },
          { href: '/conteudos?view=kanban', label: 'Pipeline de conteúdos', icon: '📋', color: '#8b5cf6' },
          { href: '/financial', label: 'Financeiro', icon: '💰', color: '#f59e0b' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="rounded-xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--surface)', border: `1px solid ${a.color}30` }}>
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Team overview */}
      {teamWithStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>EQUIPA — CARGA ATUAL</h2>
            <Link href="/admin" className="text-xs" style={{ color: 'var(--accent)' }}>Gerir →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {teamWithStats.map(member => (
              <button key={member.id}
                onClick={() => router.push(`/admin/preview/${member.id}`)}
                className="rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: (member.avatar_color || ROLE_COLORS[member.role] || 'var(--accent)') + '30', color: member.avatar_color || ROLE_COLORS[member.role] || 'var(--accent)' }}>
                    {getInitials(member.name || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--cream)' }}>{member.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ROLE_LABELS[member.role] || member.role}</p>
                  </div>
                  {member.urgentCount > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                      style={{ background: '#ef444420', color: 'var(--danger)' }}>
                      {member.urgentCount} urg.
                    </span>
                  )}
                </div>
                <div className={`grid gap-2 ${['designer', 'social_media', 'editor'].includes(member.role) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface-2)' }}>
                    <div className="text-base font-bold" style={{ color: member.pendingTasks > 0 ? '#f59e0b' : 'white' }}>{member.pendingTasks}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>tarefas</div>
                  </div>
                  {['designer', 'social_media', 'editor'].includes(member.role) && (
                    <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface-2)' }}>
                      <div className="text-base font-bold" style={{ color: member.activePosts > 0 ? '#8b5cf6' : 'white' }}>{member.activePosts}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>posts ativos</div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Posts pipeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            PIPELINE DE CONTEÚDOS — {pendingPosts.length} posts ativos
          </h2>
          <Link href="/conteudos?view=kanban" className="text-xs" style={{ color: 'var(--accent)' }}>Ver kanban →</Link>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {postsByStatus.map(s => (
            <Link key={s.key} href={`/conteudos?view=kanban`}
              className="rounded-xl p-3 text-center hover:opacity-90 transition-opacity"
              style={{ background: 'var(--surface)', border: `1px solid ${s.count > 0 ? s.color + '30' : 'var(--border)'}` }}>
              <div className="text-xl font-bold" style={{ color: s.count > 0 ? s.color : 'var(--text-muted)' }}>{s.count}</div>
              <div className="text-xs mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Clients + Meetings */}
      <div className="grid grid-cols-2 gap-6">

        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-semibold text-white">Clientes</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {activeClients.length} ativos · {onboardingClients.length} onboarding
              </p>
            </div>
            <Link href="/leads" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todos →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {myClients.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => router.push(`/leads/${c.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:opacity-80 text-left"
                style={{ background: 'var(--surface-2)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: roleColor + '30', color: roleColor }}>
                  {getInitials(c.name)}
                </div>
                <p className="flex-1 text-sm font-medium truncate text-white">{c.name}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: c.status === 'ativo' ? 'var(--success)' : c.status === 'onboarding' ? '#f59e0b' : 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.status === 'ativo' ? 'Ativo' : c.status === 'onboarding' ? 'Onboarding' : c.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-white">Próximas reuniões</h2>
            <Link href="/meetings" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todas →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {scheduledMeetings.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem reuniões agendadas
              </div>
            ) : scheduledMeetings.slice(0, 6).map(m => {
              const isToday = m.date.startsWith(todayStr)
              const isTomorrow = m.date.startsWith(tomorrowStr)
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: isToday ? '#6c63ff20' : 'var(--surface)', border: `1px solid ${isToday ? '#6c63ff' : 'var(--border)'}`, color: isToday ? '#6c63ff' : 'white' }}>
                    {new Date(m.date).getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-white">{m.title}</p>
                    <p className="text-xs" style={{ color: isToday ? '#6c63ff' : isTomorrow ? '#f59e0b' : 'var(--text-muted)' }}>
                      {isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : new Date(m.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// GESTOR VIEW
// ────────────────────────────────────────────────────────────────

function GestorView({ profile, myClients, allTasks, upcomingMeetings, todayStr, tomorrowStr, weekEndStr }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState(allTasks)
  const [taskTab, setTaskTab] = useState<TaskTab>('hoje')
  const [responsibilities, setResponsibilities] = useState(profile.responsibilities || '')
  const [editingResp, setEditingResp] = useState(false)
  const [respDraft, setRespDraft] = useState(profile.responsibilities || '')
  const [savingResp, setSavingResp] = useState(false)

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
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const activeClients = myClients.filter(c => c.status === 'ativo')

  function isRecurringOnDay(task: Task, dow: number) {
    if (!task.recurrence) return false
    return task.recurrence.replace('weekly:', '').split(',').map(Number).includes(dow)
  }
  const todayDow = new Date(todayStr + 'T12:00:00').getDay()
  const tomorrowDow = new Date(tomorrowStr + 'T12:00:00').getDay()

  const tasksByTab: Record<TaskTab, Task[]> = {
    hoje: tasks.filter(t => t.status !== 'done' && (t.due_date?.startsWith(todayStr) || isRecurringOnDay(t, todayDow))),
    amanha: tasks.filter(t => t.status !== 'done' && (t.due_date?.startsWith(tomorrowStr) || isRecurringOnDay(t, tomorrowDow))),
    semana: tasks.filter(t => t.status !== 'done' && ((t.due_date && t.due_date >= todayStr && t.due_date <= (weekEndStr || '')) || !!t.recurrence)),
    concluidas: tasks.filter(t => t.status === 'done').slice(0, 10),
  }
  const visibleTasks = tasksByTab[taskTab]
  const todayCount = tasksByTab.hoje.length

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
      title: tTitle, description: tDescription || null, assignee_id: user?.id, created_by: user?.id,
      priority: tPriority, status: 'todo', due_date: tMode === 'date' && tDate ? tDate : null, recurrence, position: 0,
    }).select().single()
    if (data) setTasks(prev => [data as Task, ...prev])
    setTSaving(false); setShowTaskModal(false); setTTitle(''); setTDescription(''); setTPriority('medium')
    setTMode('date'); setTDate(todayStr); setTDays([])
  }

  async function toggleTaskDone(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 flex items-start gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ background: profile.avatar_color || roleColor }}>
          {getInitials(profile.name || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{greeting}, {profile.name?.split(' ')[0] || 'aí'}</h1>
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
                className="text-left group flex items-start gap-1.5 text-sm"
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
          {[
            { v: activeClients.length, l: 'Clientes', c: '#4ade80' },
            { v: todayCount, l: 'Hoje', c: todayCount > 0 ? '#f59e0b' : 'white' },
            { v: scheduledMeetings.length, l: 'Reuniões', c: scheduledMeetings.length > 0 ? roleColor : 'white' },
          ].map(s => (
            <div key={s.l} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-bold" style={{ color: s.c }}>{s.v}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { href: '/leads', label: 'Leads & Clientes', icon: '👥', color: '#4ade80' },
          { href: '/meetings', label: 'Reuniões', icon: '📅', color: roleColor },
          { href: '/kanban', label: 'Minhas tarefas', icon: '📋', color: '#f59e0b' },
          { href: '/conteudos?view=kanban', label: 'Conteúdos', icon: '✍️', color: '#8b5cf6' },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className="rounded-xl p-4 flex items-center gap-3 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--surface)', border: `1px solid ${a.color}30` }}>
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Clients grid */}
      {myClients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>SEUS CLIENTES</h2>
            <Link href="/leads" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todos →</Link>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {myClients.slice(0, 10).map(c => (
              <button key={c.id} onClick={() => router.push(`/leads/${c.id}`)}
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
                      background: c.status === 'ativo' ? 'var(--success)' : c.status === 'onboarding' ? '#f59e0b' : 'var(--text-muted)'
                    }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.status === 'ativo' ? 'Ativo' : c.status === 'onboarding' ? 'Onboarding' : c.status === 'em_negociacao' ? 'Negociação' : c.status}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tasks + Meetings */}
      <div className="grid grid-cols-2 gap-6">

        {/* Tasks with tabs */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Acompanhamento de Tarefas</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTaskModal(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'var(--accent)' }}>
                  + Nova
                </button>
                <Link href="/kanban" className="text-xs" style={{ color: 'var(--text-muted)' }}>Kanban →</Link>
              </div>
            </div>
            <div className="flex gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {([
                { key: 'hoje', label: 'Hoje', count: tasksByTab.hoje.length },
                { key: 'amanha', label: 'Amanhã', count: tasksByTab.amanha.length },
                { key: 'semana', label: 'Semana', count: tasksByTab.semana.length },
                { key: 'concluidas', label: 'Concluídas', count: null },
              ] as { key: TaskTab; label: string; count: number | null }[]).map(tab => (
                <button key={tab.key} onClick={() => setTaskTab(tab.key)}
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
            ) : visibleTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <button onClick={() => toggleTaskDone(task)}
                  className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ borderColor: task.status === 'done' ? 'var(--success)' : PRIORITY_COLOR[task.priority], background: task.status === 'done' ? 'var(--success)' : 'transparent' }}>
                  {task.status === 'done' && <span className="text-white text-xs leading-none">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate"
                    style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                    {task.title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {PRIORITY_LABEL[task.priority]}{task.recurrence && ' · 🔁'}{task.due_date && ` · ${new Date(task.due_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meetings */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-white">Reuniões próximas</h2>
            <Link href="/meetings" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todas →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
            {scheduledMeetings.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem reuniões agendadas
              </div>
            ) : scheduledMeetings.slice(0, 6).map(m => {
              const isToday = m.date.startsWith(todayStr)
              const isTomorrow = m.date.startsWith(tomorrowStr)
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0"
                    style={{ background: isToday ? roleColor + '20' : 'var(--surface)', border: `1px solid ${isToday ? roleColor : 'var(--border)'}` }}>
                    <span className="text-xs font-bold leading-none" style={{ color: isToday ? roleColor : 'white' }}>{new Date(m.date).getDate()}</span>
                    <span className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(m.date).toLocaleDateString('pt-PT', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-white">{m.title}</p>
                    <p className="text-xs" style={{ color: isToday ? roleColor : isTomorrow ? '#f59e0b' : 'var(--text-muted)' }}>
                      {isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : new Date(m.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Task create modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowTaskModal(false) }}>
          <div className="rounded-2xl p-6 w-full max-w-md space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-lg font-semibold text-white">Nova tarefa</h3>
            <input value={tTitle} onChange={e => setTTitle(e.target.value)}
              placeholder="Título da tarefa"
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={inputStyle} autoFocus />
            <textarea value={tDescription} onChange={e => setTDescription(e.target.value)}
              placeholder="Descrição (opcional)" rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm text-white resize-none outline-none"
              style={inputStyle} />
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Prioridade</label>
              <select value={tPriority} onChange={e => setTPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                style={inputStyle}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>Agendamento</label>
              <div className="flex gap-2 mb-3">
                {(['date', 'recurrence'] as const).map(m => (
                  <button key={m} onClick={() => setTMode(m)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: tMode === m ? 'var(--accent)' : 'var(--surface-2)', color: tMode === m ? 'white' : 'var(--text-muted)' }}>
                    {m === 'date' ? '📅 Data específica' : '🔁 Recorrente'}
                  </button>
                ))}
              </div>
              {tMode === 'date' ? (
                <input type="date" value={tDate} onChange={e => setTDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={inputStyle} />
              ) : (
                <div className="flex gap-1.5">
                  {WEEKDAYS.map(d => (
                    <button key={d.value}
                      onClick={() => setTDays(prev => prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value])}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: tDays.includes(d.value) ? 'var(--accent)' : 'var(--surface-2)', color: tDays.includes(d.value) ? 'white' : 'var(--text-muted)' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowTaskModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Cancelar
              </button>
              <button onClick={createTask} disabled={tSaving || !tTitle.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {tSaving ? 'A criar...' : 'Criar tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ────────────────────────────────────────────────────────────────

export default function HomeDashboard(props: Props) {
  const { profile, allProfiles, allPosts } = props
  if (profile.role === 'admin' && allProfiles && allPosts) {
    return <AdminView {...props} allProfiles={allProfiles} allPosts={allPosts} />
  }
  return <GestorView {...props} />
}
