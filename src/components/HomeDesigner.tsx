'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Task, Profile } from '@/types/database'

const PRIORITY_COLOR: Record<string, string> = { urgent: 'var(--danger)', high: '#f59e0b', medium: '#ec4899', low: 'var(--text-muted)' }
const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' }
function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

const roleColor = '#ec4899'

export default function HomeDesigner({ profile, myClients, allTasks, todayStr }: {
  profile: Profile
  myClients: Client[]
  allTasks: Task[]
  todayStr: string
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
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { v: myClients.length, l: 'Clientes' },
            { v: todayTasks.length, l: 'Hoje' },
            { v: urgentTasks.length, l: 'Urgentes' },
          ].map(s => (
            <div key={s.l} className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xl font-bold" style={{ color: s.v > 0 ? roleColor : 'white' }}>{s.v}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Acesso principal */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/conteudos?view=kanban"
          className="rounded-2xl p-6 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--surface)', border: `1px solid ${roleColor}30` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🎨</span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--cream)' }}>Kanban de Produção</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Criar arte, editar, aprovar</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: roleColor + '20', color: roleColor }}>
            Abrir kanban →
          </span>
        </Link>

        <Link href="/conteudos?view=calendario"
          className="rounded-2xl p-6 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--surface)', border: `1px solid #f59e0b30` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📅</span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--cream)' }}>Calendário de Postagens</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ver posts agendados por data</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            Abrir calendário →
          </span>
        </Link>
      </div>

      {/* Tarefas de hoje + Clientes */}
      <div className="grid grid-cols-2 gap-6">

        {/* Tarefas de hoje */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Tarefas de hoje</h2>
            <Link href="/kanban" className="text-xs" style={{ color: roleColor }}>Ver kanban →</Link>
          </div>
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {todayTasks.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                Sem tarefas para hoje 🎉
              </div>
            ) : todayTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ background: 'var(--surface-2)' }}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[task.priority] }} />
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
