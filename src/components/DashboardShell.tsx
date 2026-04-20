'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import NotificationsPanel from './NotificationsPanel'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User
  role: string
  children: React.ReactNode
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/leads': 'Leads & Clientes',
  '/conteudos': 'Conteúdos',
  '/kanban': 'Tarefas',
  '/pipeline': 'Pipeline de Produção',
  '/pautas': 'Pautas',
  '/meetings': 'Reuniões',
  '/goals': 'Metas & OKR',
  '/financial': 'Financeiro',
  '/about': 'Quem Somos',
  '/services': 'Serviços',
  '/admin': 'Equipa',
}

function getPageTitle(pathname: string) {
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (key === '/' ? pathname === '/' : pathname.startsWith(key)) return title
  }
  return 'Beeme Digital'
}

function getBottomTabs(role: string) {
  const all = [
    { href: '/',          icon: '⚡', label: 'Início',    exact: true,  roles: null },
    { href: '/leads',     icon: '👥', label: 'Clientes',  exact: false, roles: ['admin','gestor','social_media','designer','editor','financeiro'] },
    { href: '/conteudos', icon: '🎨', label: 'Conteúdos', exact: false, roles: ['admin','social_media','designer','editor'] },
    { href: '/kanban',    icon: '📋', label: 'Tarefas',   exact: false, roles: ['admin','gestor','social_media','designer','editor'] },
    { href: '/financial', icon: '💰', label: 'Financeiro',exact: false, roles: ['admin','financeiro'] },
    { href: '/meetings',  icon: '📅', label: 'Reuniões',  exact: false, roles: ['admin','gestor','social_media'] },
  ]
  return all.filter(t => !t.roles || t.roles.includes(role)).slice(0, 4)
}

export default function DashboardShell({ user, role, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)
  const tabs = getBottomTabs(role)
  const initials = (user.user_metadata?.name || user.email || '?')[0].toUpperCase()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--background)', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: '52px', flexShrink: 0,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--lavanda)', color: '#08080F',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>B</div>
            <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', color: 'var(--cream)' }}>
              {pageTitle}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationsPanel />
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--lavanda)', color: '#08080F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>
              {initials}
            </button>
          </div>
        </header>

        {/* Conteúdo */}
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
          {children}
        </main>

        {/* Bottom nav */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          display: 'flex', alignItems: 'stretch',
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          height: '60px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {tabs.map(tab => {
            const active = isActive(tab.href, tab.exact)
            return (
              <Link key={tab.href} href={tab.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                color: active ? 'var(--lavanda)' : 'var(--text-muted)',
                textDecoration: 'none', position: 'relative',
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>{tab.label}</span>
                {active && (
                  <span style={{
                    position: 'absolute', bottom: 0,
                    width: 24, height: 3, borderRadius: '2px 2px 0 0',
                    background: 'var(--lavanda)',
                  }} />
                )}
              </Link>
            )
          })}
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              color: menuOpen ? 'var(--lavanda)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
            <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>Menu</span>
          </button>
        </nav>

        {/* Drawer overlay */}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 40,
                background: 'rgba(8,8,15,0.8)', backdropFilter: 'blur(4px)',
              }}
            />
            <div style={{
              position: 'fixed', inset: '0 0 0 auto', zIndex: 50,
              width: '280px', display: 'flex', flexDirection: 'column',
              background: 'var(--surface)', borderLeft: '1px solid var(--border)',
              animation: 'slideInRight 0.25s cubic-bezier(0.32,0.72,0,1)',
            }}>
              <Sidebar user={user} role={role} isOpen={true} onClose={() => setMenuOpen(false)} />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <Sidebar user={user} role={role} isOpen={false} onClose={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
