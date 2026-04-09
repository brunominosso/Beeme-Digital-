'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Meeting, Profile } from '@/types/database'

function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
const roleColor = '#f59e0b'

export default function HomeSocialMedia({ profile, myClients, upcomingMeetings, todayStr }: {
  profile: Profile
  myClients: Client[]
  upcomingMeetings: Meeting[]
  todayStr: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  const router = useRouter()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const scheduledMeetings = upcomingMeetings.filter(m => m.status === 'scheduled')
  const activeClients = myClients.filter(c => c.status === 'ativo')

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
        </div>
        <div className="flex gap-3 shrink-0">
          {[
            { v: activeClients.length, l: 'Clientes' },
            { v: scheduledMeetings.length, l: 'Reuniões' },
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
        <Link href="/conteudos?view=calendario"
          className="rounded-2xl p-6 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--surface)', border: `1px solid ${roleColor}30` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📅</span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--cream)' }}>Calendário de Postagens</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ver e gerir posts por data</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: roleColor + '20', color: roleColor }}>
            Abrir calendário →
          </span>
        </Link>

        <Link href="/conteudos?view=kanban"
          className="rounded-2xl p-6 hover:opacity-90 transition-opacity"
          style={{ background: 'var(--surface)', border: `1px solid #8b5cf630` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📋</span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--cream)' }}>Kanban de Produção</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Acompanhar workflow dos posts</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            Abrir kanban →
          </span>
        </Link>
      </div>

      {/* Clientes + Reuniões */}
      <div className="grid grid-cols-2 gap-6">

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
              const d = new Date(m.date)
              const isToday = m.date.startsWith(todayStr)
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-2)' }}>
                  <div className="w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0"
                    style={{ background: isToday ? roleColor + '20' : 'var(--surface)', border: `1px solid ${isToday ? roleColor : 'var(--border)'}` }}>
                    <span className="text-xs font-bold leading-none" style={{ color: isToday ? roleColor : 'white' }}>{d.getDate()}</span>
                    <span className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.toLocaleDateString('pt-PT', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--cream)' }}>{m.title}</p>
                    {isToday && <span className="text-xs font-bold" style={{ color: roleColor }}>Hoje</span>}
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
