'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

type Utilization = { tasks: number; urgent: number; posts: number }

const ROLE_LABELS: Record<string, string> = {
  admin:        'Admin',
  gestor:       'Gestor de Tráfego',
  social_media: 'Social Media',
  designer:     'Designer',
  editor:       'Editor de Vídeos',
  financeiro:   'Financeiro',
}

const ROLE_COLORS: Record<string, string> = {
  admin:        '#9FA4DB',
  gestor:       '#6c63ff',
  social_media: '#f59e0b',
  designer:     '#ec4899',
  editor:       '#10b981',
  financeiro:   '#4ade80',
}

const AVATAR_COLORS = ['#9FA4DB','#B8BCEE','#ec4899','#f59e0b','#10b981','#4ade80','#6c63ff','#ef4444','#a855f7']

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function AdminView({ profiles }: { profiles: Profile[] }) {
  const [showInvite, setShowInvite]   = useState(false)
  const [utilization, setUtilization] = useState<Record<string, Utilization>>({})

  useEffect(() => {
    async function fetchUtilization() {
      const supabase = createClient()
      const [{ data: tasks }, { data: posts }] = await Promise.all([
        supabase.from('tasks').select('assignee_id, priority').neq('status', 'done'),
        supabase.from('posts').select('assignee_ids, status').not('status', 'in', '("publicado","sm_aprovado","sm_postado")'),
      ])
      const map: Record<string, Utilization> = {}
      for (const t of tasks ?? []) {
        if (!t.assignee_id) continue
        if (!map[t.assignee_id]) map[t.assignee_id] = { tasks: 0, urgent: 0, posts: 0 }
        map[t.assignee_id].tasks++
        if (t.priority === 'urgent') map[t.assignee_id].urgent++
      }
      for (const p of posts ?? []) {
        for (const id of (p.assignee_ids ?? [])) {
          if (!map[id]) map[id] = { tasks: 0, urgent: 0, posts: 0 }
          map[id].posts++
        }
      }
      setUtilization(map)
    }
    fetchUtilization()
  }, [])
  const [iEmail, setIEmail]         = useState('')
  const [iName, setIName]           = useState('')
  const [iRole, setIRole]           = useState('gestor')
  const [iColor, setIColor]         = useState('#9FA4DB')
  const [sending, setSending]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [error, setError]           = useState('')

  async function sendInvite() {
    if (!iEmail || !iName) return
    setSending(true); setError('')
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: iEmail, name: iName, role: iRole, avatar_color: iColor }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSending(false); return }
    setSent(true); setSending(false)
    setTimeout(() => {
      setSent(false); setShowInvite(false)
      setIEmail(''); setIName(''); setIRole('gestor'); setIColor('#9FA4DB')
    }, 2000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Gestão de Utilizadores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {profiles.length} membros da equipa
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
          style={{ background: 'var(--accent)' }}>
          + Convidar pessoa
        </button>
      </div>

      {/* Como funciona */}
      <div className="rounded-xl p-5 flex items-start gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--lavanda)30' }}>
        <span className="text-2xl shrink-0">💡</span>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--lavanda-light)' }}>Como funciona o sistema de convites</p>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Clicas em <strong className="text-white">+ Convidar pessoa</strong>, defines o nome, cargo e cor do avatar.
            A pessoa recebe um email com um link para criar a senha. Quando entra pela primeira vez,
            o perfil é criado automaticamente com o cargo que definiste — e o home dela já aparece personalizado.
          </p>
        </div>
      </div>

      {/* Equipa atual */}
      <div>
        <h2 className="label-caps mb-4">Equipa atual</h2>
        <div className="space-y-2">
          {profiles.map(p => {
            const roleColor = ROLE_COLORS[p.role] || 'var(--lavanda)'
            const roleLabel = ROLE_LABELS[p.role] || p.role
            return (
              <div key={p.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: p.avatar_color, color: '#08080F' }}>
                  {getInitials(p.name || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: 'var(--cream)' }}>{p.name || 'Sem nome'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {p.id.slice(0, 8)}...</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                  style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}30` }}>
                  {roleLabel}
                </span>
                {(() => {
                  const u = utilization[p.id]
                  if (!u) return null
                  const overloaded = u.tasks > 10 || u.urgent > 3
                  return (
                    <div className="flex items-center gap-2 shrink-0">
                      {u.tasks > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {u.tasks} tarefas
                        </span>
                      )}
                      {u.posts > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {u.posts} posts
                        </span>
                      )}
                      {overloaded && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                          ⚠ Sobrecarregado
                        </span>
                      )}
                    </div>
                  )
                })()}
                <Link href={`/admin/preview/${p.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  👁 Ver dash
                </Link>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dashboard por role — preview */}
      <div>
        <h2 className="label-caps mb-4">Dashboards por cargo</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { role: 'gestor', icon: '📊', desc: 'Clientes, pipeline, reuniões, tarefas' },
            { role: 'social_media', icon: '📱', desc: 'Conteúdos, clientes, calendário' },
            { role: 'designer', icon: '🎨', desc: 'Projetos criativos, clientes, tarefas' },
            { role: 'editor', icon: '🎬', desc: 'Vídeos, roteiros, clientes, tarefas' },
            { role: 'financeiro', icon: '💰', desc: 'Faturas, despesas, relatórios' },
            { role: 'admin', icon: '⚡', desc: 'Visão geral total + gestão de equipa' },
          ].map(item => {
            const color = ROLE_COLORS[item.role]
            return (
              <div key={item.role} className="rounded-xl p-4"
                style={{ background: 'var(--surface)', border: `1px solid ${color}25` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-semibold text-sm" style={{ color }}>{ROLE_LABELS[item.role]}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal convite */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Convidar novo membro</h2>
              <button onClick={() => setShowInvite(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {sent ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-semibold" style={{ color: 'var(--success)' }}>Convite enviado!</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{iName} vai receber um email para criar a senha</p>
              </div>
            ) : (
              <>
                {/* Preview */}
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={{ background: iColor, color: '#08080F', fontFamily: 'var(--font-barlow)' }}>
                    {getInitials(iName || '?')}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--cream)' }}>{iName || 'Nome...'}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: (ROLE_COLORS[iRole] || '#9FA4DB') + '20', color: ROLE_COLORS[iRole] || '#9FA4DB' }}>
                      {ROLE_LABELS[iRole]}
                    </span>
                  </div>
                </div>

                <input type="text" placeholder="Nome completo *" value={iName} onChange={e => setIName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus />

                <input type="email" placeholder="Email *" value={iEmail} onChange={e => setIEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />

                {/* Cargo */}
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Cargo</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => (
                      <button key={k} onClick={() => setIRole(k)}
                        className="py-2 px-3 rounded-lg text-xs font-medium transition-all text-left"
                        style={{
                          background: iRole === k ? (ROLE_COLORS[k] + '25') : 'var(--surface-2)',
                          border: `1px solid ${iRole === k ? ROLE_COLORS[k] : 'var(--border)'}`,
                          color: iRole === k ? ROLE_COLORS[k] : 'var(--text-muted)',
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor */}
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Cor do avatar</p>
                  <div className="flex gap-2 flex-wrap">
                    {AVATAR_COLORS.map(c => (
                      <button key={c} onClick={() => setIColor(c)}
                        className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, outline: iColor === c ? '3px solid white' : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger)15', color: 'var(--danger)' }}>
                    Erro: {error}
                  </p>
                )}

                <button onClick={sendInvite} disabled={!iEmail || !iName || sending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}>
                  {sending ? 'A enviar convite...' : '📧 Enviar convite por email'}
                </button>

                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  A pessoa vai receber um email com um link para criar a senha e aceder ao sistema
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
