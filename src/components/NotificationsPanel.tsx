'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  type: string
  title: string
  message: string | null
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  task_assigned:    '📋',
  post_approved:    '✅',
  post_adjustment:  '💬',
  post_due:         '⏰',
}

function fmtRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'agora'
  if (mins < 60)  return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function createNotification(params: {
  userId: string
  type: string
  title: string
  message?: string
  data?: Record<string, unknown>
}) {
  const supabase = createClient()
  supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    data: params.data ?? {},
  }).then(() => {/* fire and forget */})
}

export default function NotificationsPanel() {
  const [open, setOpen]               = useState(false)
  const [notifs, setNotifs]           = useState<Notification[]>([])
  const [loading, setLoading]         = useState(false)
  const panelRef                      = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    loadNotifications()

    // Real-time subscription
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const channel = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, payload => {
          setNotifs(prev => [payload.new as Notification, ...prev])
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function loadNotifications() {
    setLoading(true)
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifs(data.notifications ?? [])
    }
    setLoading(false)
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:opacity-80"
        style={{ background: open ? 'var(--surface-2)' : 'transparent' }}
        title="Notificações">
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--danger)', fontSize: '10px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>Notificações</h3>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ color: 'var(--accent)', background: 'var(--surface-2)' }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>A carregar...</div>
            ) : notifs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-2xl mb-2">🔕</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sem notificações</p>
              </div>
            ) : (
              notifs.map(n => (
                <button key={n.id} onClick={() => markRead(n.id)}
                  className="w-full flex gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity border-b"
                  style={{ borderColor: 'var(--border)', background: n.read ? 'transparent' : 'var(--accent)10' }}>
                  <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--cream)' }}>{n.title}</p>
                    {n.message && (
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{fmtRelative(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
