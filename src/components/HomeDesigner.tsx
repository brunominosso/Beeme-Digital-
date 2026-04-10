'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Task, Profile, Post } from '@/types/database'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--danger)', high: '#f59e0b', medium: 'var(--accent)', low: 'var(--text-muted)',
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa',
}

const roleColor = '#ec4899'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function PostCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const hasFiles = post.files && post.files.length > 0
  const clientColor = '#ec4899'

  const statusConfig: Record<string, { label: string; color: string }> = {
    criar_arte:   { label: 'Criar arte',   color: '#f97316' },
    editar_video: { label: 'Editar vídeo', color: '#ec4899' },
    em_aprovacao: { label: 'Em aprovação', color: '#eab308' },
    nao_iniciado: { label: 'Não iniciado', color: '#6b7280' },
    em_andamento: { label: 'Em andamento', color: '#3b82f6' },
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
        {hasFiles && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#22c55e20', color: '#22c55e' }}>
            {post.files!.length} ficheiro{post.files!.length > 1 ? 's' : ''} ✓
          </span>
        )}
      </div>
    </button>
  )
}

export default function HomeDesigner({ profile, myClients, allTasks, todayStr, myPosts = [] }: {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  todayStr: string
  myPosts?: Post[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  const router = useRouter()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  function isRecurringOnDay(task: Task, dow: number) {
    if (!task.recurrence) return false
    return task.recurrence.replace('weekly:', '').split(',').map(Number).includes(dow)
  }
  const todayDow = new Date(todayStr + 'T12:00:00').getDay()
  const todayTasks = allTasks.filter(t => t.status !== 'done' && (t.due_date?.startsWith(todayStr) || isRecurringOnDay(t, todayDow)))
  const urgentTasks = allTasks.filter(t => t.status !== 'done' && t.priority === 'urgent')

  // Posts que precisam da ação do designer
  const postsParaCriar = myPosts.filter(p => p.status === 'criar_arte')
  const postsParaEditar = myPosts.filter(p => p.status === 'editar_video')
  const postsEmAprovacao = myPosts.filter(p => p.status === 'em_aprovacao')
  const totalAcao = postsParaCriar.length + postsParaEditar.length

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
              Designer
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {totalAcao > 0 && (
            <p className="text-sm mt-2 font-medium" style={{ color: '#f97316' }}>
              Tens {totalAcao} post{totalAcao > 1 ? 's' : ''} à espera de ti
            </p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { v: postsParaCriar.length, l: 'Criar arte', c: '#f97316' },
            { v: postsParaEditar.length, l: 'Editar vídeo', c: roleColor },
            { v: postsEmAprovacao.length, l: 'Em aprovação', c: '#eab308' },
            { v: myClients.length, l: 'Clientes', c: 'white' },
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
        <Link href="/conteudos?view=kanban"
          className="rounded-2xl p-5 hover:opacity-90 transition-opacity flex items-center gap-4"
          style={{ background: 'var(--surface)', border: `1px solid ${roleColor}30` }}>
          <span className="text-3xl shrink-0">🎨</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Kanban de Produção</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Criar arte · Editar vídeo · Aprovar</p>
          </div>
          {totalAcao > 0 && (
            <span className="text-sm font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: '#f9731620', color: '#f97316' }}>
              {totalAcao}
            </span>
          )}
        </Link>

        <Link href="/conteudos?view=calendario"
          className="rounded-2xl p-5 hover:opacity-90 transition-opacity flex items-center gap-4"
          style={{ background: 'var(--surface)', border: `1px solid #f59e0b30` }}>
          <span className="text-3xl shrink-0">📅</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Calendário</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ver posts agendados por data</p>
          </div>
        </Link>
      </div>

      {/* Posts para criar arte */}
      {postsParaCriar.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>CRIAR ARTE ({postsParaCriar.length})</h2>
            </div>
            <Link href="/conteudos?view=kanban" className="text-xs" style={{ color: '#f97316' }}>Ver no kanban →</Link>
          </div>
          <div className="space-y-2">
            {postsParaCriar.map(p => (
              <PostCard key={p.id} post={p} onClick={() => router.push('/conteudos?view=kanban')} />
            ))}
          </div>
        </div>
      )}

      {/* Posts para editar vídeo */}
      {postsParaEditar.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: roleColor }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>EDITAR VÍDEO ({postsParaEditar.length})</h2>
            </div>
            <Link href="/conteudos?view=kanban" className="text-xs" style={{ color: roleColor }}>Ver no kanban →</Link>
          </div>
          <div className="space-y-2">
            {postsParaEditar.map(p => (
              <PostCard key={p.id} post={p} onClick={() => router.push('/conteudos?view=kanban')} />
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio — sem posts para produzir */}
      {totalAcao === 0 && (
        <div className="rounded-xl p-8 flex items-center gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <span className="text-4xl">🎉</span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--cream)' }}>Sem posts à espera</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Nenhum post em "Criar arte" ou "Editar vídeo" atribuído a ti de momento.</p>
          </div>
        </div>
      )}

      {/* Em aprovação */}
      {postsEmAprovacao.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>EM APROVAÇÃO ({postsEmAprovacao.length})</h2>
            </div>
          </div>
          <div className="space-y-2">
            {postsEmAprovacao.map(p => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}

      {/* Tarefas de hoje + Clientes */}
      <div className="grid grid-cols-2 gap-6">

        {/* Tarefas de hoje */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Tarefas de hoje</h2>
            <div className="flex items-center gap-3">
              {urgentTasks.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#ef444420', color: 'var(--danger)' }}>
                  {urgentTasks.length} urgente{urgentTasks.length > 1 ? 's' : ''}
                </span>
              )}
              <Link href="/kanban" className="text-xs" style={{ color: roleColor }}>Kanban →</Link>
            </div>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {todayTasks.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem tarefas para hoje 🎉
              </div>
            ) : todayTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--surface-2)' }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[task.priority] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--cream)' }}>{task.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{PRIORITY_LABEL[task.priority]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Meus clientes</h2>
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
      </div>

    </div>
  )
}
