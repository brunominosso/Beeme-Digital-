'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Meeting, Profile, Post } from '@/types/database'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

const roleColor = '#f59e0b'

function PostActionCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    criar_copy:     { label: 'Criar copy',     color: '#8b5cf6' },
    fazer_captacao: { label: 'Fazer captação', color: '#f59e0b' },
    em_aprovacao:   { label: 'Em aprovação',   color: '#eab308' },
    em_andamento:   { label: 'Em andamento',   color: '#3b82f6' },
    nao_iniciado:   { label: 'Não iniciado',   color: '#6b7280' },
  }
  const sc = statusConfig[post.status] || { label: post.status, color: '#6b7280' }

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl p-4 hover:opacity-90 transition-opacity"
      style={{ background: 'var(--surface-2)', border: `1px solid ${sc.color}30` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold leading-snug flex-1" style={{ color: 'var(--cream)' }}>{post.title}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
          style={{ background: sc.color + '20', color: sc.color }}>
          {sc.label}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {post.platform && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {post.platform}
          </span>
        )}
        {post.format && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {post.format}
          </span>
        )}
        {post.due_date && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Entrega: {fmtDate(post.due_date)}
          </span>
        )}
      </div>
    </button>
  )
}

function PublishCard({ post, todayStr, weekEndStr }: { post: Post; todayStr: string; weekEndStr: string }) {
  const publishDate = post.publish_date || post.due_date
  if (!publishDate) return null

  const isToday = publishDate.startsWith(todayStr)
  const daysLeft = Math.ceil((new Date(publishDate + 'T12:00:00').getTime() - new Date(todayStr + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24))
  const urgency = isToday ? 'danger' : daysLeft <= 2 ? 'warn' : 'normal'
  const urgencyColors = { danger: '#ef4444', warn: '#f59e0b', normal: '#22c55e' }

  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'var(--surface-2)', border: `1px solid ${urgencyColors[urgency]}30` }}>
      <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0"
        style={{ background: urgencyColors[urgency] + '20', border: `1px solid ${urgencyColors[urgency]}50` }}>
        <span className="text-xs font-bold leading-none" style={{ color: urgencyColors[urgency] }}>
          {new Date(publishDate + 'T12:00:00').getDate()}
        </span>
        <span className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(publishDate + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'short' })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{post.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {post.platform && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.platform}</span>}
          <span className="text-xs font-medium" style={{ color: urgencyColors[urgency] }}>
            {isToday ? 'Hoje!' : `em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
        style={{ background: '#22c55e20', color: '#22c55e' }}>
        {post.status === 'publicado' ? 'Publicado' : 'Agendado'}
      </span>
    </div>
  )
}

export default function HomeSocialMedia({ profile, myClients, upcomingMeetings, todayStr, tomorrowStr, weekEndStr, myPosts = [] }: {
  profile: Profile
  myClients: Client[]
  upcomingMeetings: Meeting[]
  todayStr: string
  tomorrowStr?: string
  weekEndStr?: string
  myPosts?: Post[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  const router = useRouter()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const activeClients = myClients.filter(c => c.status === 'ativo')

  // Posts que precisam de ação do social media
  const postsParaCopy = myPosts.filter(p => p.status === 'criar_copy')
  const postsParaCaptacao = myPosts.filter(p => p.status === 'fazer_captacao')
  const postsEmAprovacao = myPosts.filter(p => p.status === 'em_aprovacao')
  const totalAcao = postsParaCopy.length + postsParaCaptacao.length

  // Posts publicando esta semana
  const postsEstaSemana = myPosts.filter(p => {
    const date = p.publish_date || p.due_date
    if (!date) return false
    return date >= todayStr && date <= (weekEndStr || todayStr)
  }).sort((a, b) => {
    const da = a.publish_date || a.due_date || ''
    const db = b.publish_date || b.due_date || ''
    return da.localeCompare(db)
  })

  const todayMeeting = scheduledMeetings.filter(m => m.date.startsWith(todayStr))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Hero */}
      <div className="rounded-2xl p-6 flex items-start gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
          style={{ background: profile.avatar_color || roleColor, color: '#08080F' }}>
          {getInitials(profile.name || '?')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>{greeting}, {profile.name?.split(' ')[0]}</h1>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}40` }}>
              Social Media
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {totalAcao > 0 && (
            <p className="text-sm mt-2 font-medium" style={{ color: '#8b5cf6' }}>
              {totalAcao} post{totalAcao > 1 ? 's' : ''} à espera de ti
            </p>
          )}
          {todayMeeting.length > 0 && (
            <p className="text-sm mt-1 font-medium" style={{ color: roleColor }}>
              Reunião hoje: {todayMeeting[0].title}
            </p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { v: postsParaCopy.length, l: 'Criar copy', c: '#8b5cf6' },
            { v: postsParaCaptacao.length, l: 'Captação', c: roleColor },
            { v: postsEstaSemana.length, l: 'Esta semana', c: '#22c55e' },
            { v: scheduledMeetings.length, l: 'Reuniões', c: scheduledMeetings.length > 0 ? roleColor : 'white' },
          ].map(s => (
            <div key={s.l} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-bold" style={{ color: s.v > 0 ? s.c : 'white' }}>{s.v}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ação principal */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/conteudos?view=calendario"
          className="rounded-2xl p-5 hover:opacity-90 transition-opacity flex items-center gap-4"
          style={{ background: 'var(--surface)', border: `1px solid ${roleColor}30` }}>
          <span className="text-3xl shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Calendário de Postagens</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ver e gerir posts por data</p>
          </div>
          {postsEstaSemana.length > 0 && (
            <span className="text-sm font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: '#22c55e20', color: '#22c55e' }}>
              {postsEstaSemana.length}
            </span>
          )}
        </Link>

        <Link href="/conteudos?view=kanban"
          className="rounded-2xl p-5 hover:opacity-90 transition-opacity flex items-center gap-4"
          style={{ background: 'var(--surface)', border: `1px solid #8b5cf630` }}>
          <span className="text-3xl shrink-0">📋</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Kanban de Produção</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Acompanhar workflow dos posts</p>
          </div>
          {totalAcao > 0 && (
            <span className="text-sm font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
              {totalAcao}
            </span>
          )}
        </Link>
      </div>

      {/* Posts para criar copy */}
      {postsParaCopy.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>CRIAR COPY ({postsParaCopy.length})</h2>
            </div>
            <Link href="/conteudos?view=kanban" className="text-xs" style={{ color: '#8b5cf6' }}>Ver no kanban →</Link>
          </div>
          <div className="space-y-2">
            {postsParaCopy.map(p => (
              <PostActionCard key={p.id} post={p} onClick={() => router.push('/conteudos?view=kanban')} />
            ))}
          </div>
        </div>
      )}

      {/* Posts para captação */}
      {postsParaCaptacao.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: roleColor }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>FAZER CAPTAÇÃO ({postsParaCaptacao.length})</h2>
            </div>
            <Link href="/conteudos?view=kanban" className="text-xs" style={{ color: roleColor }}>Ver no kanban →</Link>
          </div>
          <div className="space-y-2">
            {postsParaCaptacao.map(p => (
              <PostActionCard key={p.id} post={p} onClick={() => router.push('/conteudos?view=kanban')} />
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {totalAcao === 0 && (
        <div className="rounded-xl p-8 flex items-center gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-4xl">🎉</span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Sem posts à espera</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Nenhum post em "Criar copy" ou "Fazer captação" atribuído a ti de momento.</p>
          </div>
        </div>
      )}

      {/* Em aprovação */}
      {postsEmAprovacao.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>EM APROVAÇÃO ({postsEmAprovacao.length})</h2>
          </div>
          <div className="space-y-2">
            {postsEmAprovacao.map(p => (
              <PostActionCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}

      {/* Publicando esta semana */}
      {postsEstaSemana.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>PUBLICANDO ESTA SEMANA ({postsEstaSemana.length})</h2>
            </div>
            <Link href="/conteudos?view=calendario" className="text-xs" style={{ color: '#22c55e' }}>Ver calendário →</Link>
          </div>
          <div className="space-y-2">
            {postsEstaSemana.map(p => (
              <PublishCard key={p.id} post={p} todayStr={todayStr} weekEndStr={weekEndStr || todayStr} />
            ))}
          </div>
        </div>
      )}

      {/* Clientes + Reuniões */}
      <div className="grid grid-cols-2 gap-6">

        {/* Clientes */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Meus clientes</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{activeClients.length} ativos</p>
            </div>
            <Link href="/leads" className="text-xs" style={{ color: roleColor }}>Ver todos →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {myClients.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem clientes atribuídos
              </div>
            ) : myClients.slice(0, 8).map(c => (
              <button key={c.id} onClick={() => router.push(`/leads/${c.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:opacity-80 text-left"
                style={{ background: 'var(--surface-2)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: roleColor + '30', color: roleColor }}>
                  {getInitials(c.name)}
                </div>
                <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--cream)' }}>{c.name}</p>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: c.status === 'ativo' ? 'var(--success)' : '#f59e0b' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Reuniões */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Próximas reuniões</h2>
            <Link href="/meetings" className="text-xs" style={{ color: roleColor }}>Ver todas →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {scheduledMeetings.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem reuniões agendadas
              </div>
            ) : scheduledMeetings.slice(0, 5).map(m => {
              const isToday = m.date.startsWith(todayStr)
              const isTomorrow = tomorrowStr && m.date.startsWith(tomorrowStr)
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0"
                    style={{ background: isToday ? roleColor + '20' : 'var(--surface)', border: `1px solid ${isToday ? roleColor : 'var(--border)'}` }}>
                    <span className="text-xs font-bold leading-none" style={{ color: isToday ? roleColor : 'white' }}>{new Date(m.date).getDate()}</span>
                    <span className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(m.date).toLocaleDateString('pt-PT', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--cream)' }}>{m.title}</p>
                    <p className="text-xs font-medium" style={{ color: isToday ? roleColor : isTomorrow ? '#f59e0b' : 'var(--text-muted)' }}>
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
