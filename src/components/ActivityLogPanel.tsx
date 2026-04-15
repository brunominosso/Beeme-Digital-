'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type ActivityEntry = {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  details: Record<string, unknown>
  created_at: string
  profiles?: { name: string | null } | null
}

const ACTION_ICONS: Record<string, string> = {
  created:               '✨',
  updated:               '✏️',
  status_changed:        '🔄',
  approved:              '✅',
  adjustment_requested:  '💬',
  deleted:               '🗑️',
}

const ACTION_LABELS: Record<string, string> = {
  created:               'criado',
  updated:               'atualizado',
  status_changed:        'status alterado',
  approved:              'aprovado',
  adjustment_requested:  'ajuste solicitado',
  deleted:               'removido',
}

const ENTITY_LABELS: Record<string, string> = {
  post:    'Post',
  task:    'Tarefa',
  client:  'Cliente',
  invoice: 'Fatura',
}

function fmtRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'agora mesmo'
  if (mins < 60)  return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function logActivity(params: {
  entityType: string
  entityId: string
  action: string
  details?: Record<string, unknown>
}) {
  const supabase = createClient()
  supabase.auth.getUser().then(({ data: { user } }) => {
    supabase.from('activity_log').insert({
      user_id:     user?.id ?? null,
      entity_type: params.entityType,
      entity_id:   params.entityId,
      action:      params.action,
      details:     params.details ?? {},
    }).then(() => {/* fire and forget */})
  })
}

export default function ActivityLogPanel({ clientId }: { clientId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      // Fetch posts and tasks for this client to get their IDs
      const [{ data: posts }, { data: tasks }] = await Promise.all([
        supabase.from('posts').select('id').eq('client_id', clientId),
        supabase.from('tasks').select('id').eq('client_id', clientId),
      ])

      const entityIds = [
        clientId,
        ...(posts ?? []).map(p => p.id),
        ...(tasks ?? []).map(t => t.id),
      ]

      const { data } = await supabase
        .from('activity_log')
        .select('*, profiles(name)')
        .in('entity_id', entityIds)
        .order('created_at', { ascending: false })
        .limit(50)

      setEntries((data as ActivityEntry[]) ?? [])
      setLoading(false)
    }
    load()
  }, [clientId])

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full shrink-0" style={{ background: 'var(--surface-2)' }} />
            <div className="flex-1 space-y-1">
              <div className="h-3 rounded w-3/4" style={{ background: 'var(--surface-2)' }} />
              <div className="h-2 rounded w-1/3" style={{ background: 'var(--surface-2)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-2xl mb-2">📋</p>
        <p className="text-sm">Nenhuma atividade registada ainda</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map(e => {
        const icon   = ACTION_ICONS[e.action]   ?? '•'
        const action = ACTION_LABELS[e.action]  ?? e.action
        const entity = ENTITY_LABELS[e.entity_type] ?? e.entity_type
        const who    = e.profiles?.name ?? 'Sistema'
        const title  = (e.details as any)?.title as string | undefined

        return (
          <div key={e.id} className="flex gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: 'var(--surface-2)' }}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug" style={{ color: 'var(--cream)' }}>
                <span className="font-medium">{who}</span>
                {' '}{action}{' '}{entity}
                {title && <span style={{ color: 'var(--text-muted)' }}> — {title}</span>}
              </p>
              {e.details && Object.keys(e.details).length > 0 && (e.details as any).status_from && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {(e.details as any).status_from} → {(e.details as any).status_to}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {fmtRelative(e.created_at)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
