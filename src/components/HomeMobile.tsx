'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Task, Meeting, Profile, Post } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor de Tráfego',
  social_media: 'Social Media',
  designer: 'Designer',
  editor: 'Editor de Vídeos',
  financeiro: 'Financeiro',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#f87171',
  high: '#f59e0b',
  medium: '#9FA4DB',
  low: '#5a5e8a',
}

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

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

interface Props {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  upcomingMeetings: Meeting[]
  todayStr: string
  tomorrowStr: string
  allProfiles?: Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]
  allPosts?: Post[]
}

export default function HomeMobile({
  profile, myClients, allTasks, upcomingMeetings, todayStr, tomorrowStr, allProfiles = [], allPosts = [],
}: Props) {
  const router = useRouter()
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = profile.name?.split(' ')[0] || 'aí'
  const roleLabel = ROLE_LABELS[profile.role] || profile.role

  // Dados
  const activeClients = myClients.filter(c => c.status === 'ativo')
  const urgentTasks = allTasks.filter(t => t.status !== 'done' && t.priority === 'urgent')
  const todayTasks = allTasks.filter(t =>
    t.status !== 'done' && t.due_date && t.due_date <= todayStr
  )
  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const todayMeetings = scheduledMeetings.filter(m => m.date.startsWith(todayStr))
  const pendingPosts = allPosts.filter(p => p.status !== 'publicado')

  // Quick actions por role
  const quickActions = [
    { href: '/leads', icon: '👥', label: 'Leads', color: '#4ade80', roles: ['admin','gestor','social_media','designer','editor','financeiro'] },
    { href: '/conteudos', icon: '🎨', label: 'Conteúdos', color: '#8b5cf6', roles: ['admin','social_media','designer','editor'] },
    { href: '/kanban', icon: '📋', label: 'Tarefas', color: '#f59e0b', roles: ['admin','gestor','social_media','designer','editor'] },
    { href: '/meetings', icon: '📅', label: 'Reuniões', color: '#6c63ff', roles: ['admin','gestor','social_media'] },
    { href: '/financial', icon: '💰', label: 'Financeiro', color: '#fbbf24', roles: ['admin','financeiro'] },
    { href: '/admin', icon: '👤', label: 'Equipa', color: '#9FA4DB', roles: ['admin'] },
    { href: '/goals', icon: '🎯', label: 'Metas', color: '#ec4899', roles: ['admin','gestor'] },
    { href: '/services', icon: '📦', label: 'Serviços', color: '#f97316', roles: ['admin','gestor','financeiro'] },
  ].filter(a => a.roles.includes(profile.role))

  return (
    <div className="flex flex-col gap-0 pb-2">

      {/* ── HERO ── */}
      <div className="px-4 pt-5 pb-4" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
            style={{ background: profile.avatar_color || 'var(--lavanda)', color: '#08080F' }}>
            {getInitials(profile.name || '?')}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--cream)' }}>
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {roleLabel} · {now.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {/* Stats em linha — scroll horizontal se precisar */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { v: activeClients.length, l: 'Clientes', icon: '👥', c: '#4ade80' },
            ...(allProfiles.length > 0 ? [{ v: allProfiles.length, l: 'Equipa', icon: '🧑‍💼', c: '#9FA4DB' }] : []),
            { v: urgentTasks.length, l: 'Urgentes', icon: '⚠️', c: urgentTasks.length > 0 ? '#f87171' : '#5a5e8a' },
            { v: todayMeetings.length, l: 'Hoje', icon: '📅', c: todayMeetings.length > 0 ? '#6c63ff' : '#5a5e8a' },
            ...(pendingPosts.length > 0 ? [{ v: pendingPosts.length, l: 'Posts', icon: '🎨', c: '#8b5cf6' }] : []),
          ].map(s => (
            <div key={s.l} className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
              <span className="text-base leading-none">{s.icon}</span>
              <div>
                <div className="text-base font-bold leading-none" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[10px] mt-0.5 leading-none" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AÇÕES RÁPIDAS ── */}
      <div className="px-4 py-4">
        <p className="label-caps mb-3">Ações rápidas</p>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.slice(0, 8).map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-opacity active:opacity-70"
              style={{ background: 'var(--surface)', border: `1px solid ${a.color}25` }}>
              <span className="text-2xl leading-none">{a.icon}</span>
              <span className="text-[10px] font-semibold text-center leading-tight"
                style={{ color: 'var(--text-muted)' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── TAREFAS URGENTES ── */}
      {urgentTasks.length > 0 && (
        <section className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps" style={{ color: '#f87171' }}>⚠ Urgente · {urgentTasks.length}</p>
            <Link href="/kanban" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todas →</Link>
          </div>
          <div className="space-y-2">
            {urgentTasks.slice(0, 3).map(t => (
              <div key={t.id}
                onClick={() => router.push('/kanban')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70"
                style={{ background: 'var(--surface)', border: '1px solid #f8717125' }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#f87171' }} />
                <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{t.title}</p>
                {t.due_date && (
                  <span className="text-xs shrink-0" style={{ color: '#f87171' }}>
                    {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TAREFAS DE HOJE ── */}
      {todayTasks.length > 0 && (
        <section className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps">Para hoje · {todayTasks.length}</p>
            <Link href="/kanban" className="text-xs" style={{ color: 'var(--accent)' }}>Kanban →</Link>
          </div>
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map(t => (
              <div key={t.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[t.priority] || 'var(--text-muted)' }} />
                <p className="flex-1 text-sm truncate" style={{ color: 'var(--cream)' }}>{t.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── REUNIÕES ── */}
      {scheduledMeetings.length > 0 && (
        <section className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps">Próximas reuniões</p>
            <Link href="/meetings" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todas →</Link>
          </div>
          <div className="space-y-2">
            {scheduledMeetings.slice(0, 4).map(m => {
              const isToday = m.date.startsWith(todayStr)
              const isTomorrow = m.date.startsWith(tomorrowStr)
              return (
                <div key={m.id}
                  onClick={() => router.push('/meetings')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{
                      background: isToday ? '#6c63ff20' : 'var(--surface-2)',
                      border: `1px solid ${isToday ? '#6c63ff' : 'var(--border)'}`,
                    }}>
                    <span className="text-sm font-bold leading-none"
                      style={{ color: isToday ? '#6c63ff' : 'var(--cream)' }}>
                      {new Date(m.date + 'T12:00:00').getDate()}
                    </span>
                    <span className="text-[9px] leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: isToday ? '#6c63ff' : isTomorrow ? '#f59e0b' : 'var(--text-muted)' }}>
                      {isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : new Date(m.date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {(m as any).time && ` · ${(m as any).time}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── CLIENTES RECENTES ── */}
      {activeClients.length > 0 && (
        <section className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="label-caps">Clientes ativos · {activeClients.length}</p>
            <Link href="/leads" className="text-xs" style={{ color: 'var(--accent)' }}>Ver todos →</Link>
          </div>
          <div className="space-y-2">
            {activeClients.slice(0, 5).map(c => (
              <button key={c.id}
                onClick={() => router.push(`/leads/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:opacity-70"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name}
                    className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'var(--lavanda)20', color: 'var(--lavanda)' }}>
                    {getInitials(c.name)}
                  </div>
                )}
                <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{c.name}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: c.status === 'ativo' ? '#4ade80' : '#f59e0b' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.status === 'ativo' ? 'Ativo' : 'Onboarding'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
