'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
  role: string
  children: React.ReactNode
}

export default function DashboardShell({ user, role, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // fecha sidebar ao redimensionar para desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(8,8,15,0.7)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        user={user}
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar mobile */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Abrir menu"
          >
            <span className="w-5 h-0.5 rounded" style={{ background: 'currentColor' }} />
            <span className="w-5 h-0.5 rounded" style={{ background: 'currentColor' }} />
            <span className="w-5 h-0.5 rounded" style={{ background: 'currentColor' }} />
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--lavanda)', color: '#08080F' }}
            >
              B
            </div>
            <span
              className="font-bold text-sm"
              style={{ fontFamily: 'var(--font-barlow)', letterSpacing: '0.04em', color: 'var(--cream)' }}
            >
              Beeme Digital
            </span>
          </div>

          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--lavanda)', color: '#08080F' }}
          >
            {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
