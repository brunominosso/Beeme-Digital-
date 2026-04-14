'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
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

// 4 tabs principais + botão Menu
function getBottomTabs(role: string) {
  const all = [
    { href: '/',           icon: '⚡', label: 'Início',     exact: true,  roles: null },
    { href: '/leads',      icon: '👥', label: 'Leads',      exact: false, roles: ['admin','gestor','social_media','designer','editor','financeiro'] },
    { href: '/conteudos',  icon: '🎨', label: 'Conteúdos',  exact: false, roles: ['admin','social_media','designer','editor'] },
    { href: '/kanban',     icon: '📋', label: 'Tarefas',    exact: false, roles: ['admin','gestor','social_media','designer','editor'] },
    { href: '/financial',  icon: '💰', label: 'Financeiro', exact: false, roles: ['admin','financeiro'] },
    { href: '/meetings',   icon: '📅', label: 'Reuniões',   exact: false, roles: ['admin','gestor','social_media'] },
  ]
  return all
    .filter(t => !t.roles || t.roles.includes(role))
    .slice(0, 4)
}

export default function DashboardShell({ user, role, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)
  const tabs = getBottomTabs(role)
  const initials = (user.user_metadata?.name || user.email || '?')[0].toUpperCase()

  useEffect(() => {
    if (window.innerWidth >= 768) setMenuOpen(false)
  }, [pathname])

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── DESKTOP: sidebar lateral ── */}
      <Sidebar
        user={user}
        role={role}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      {/* ── Overlay menu mobile ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(8,8,15,0.75)', backdropFilter: 'blur(3px)' }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar — só mobile */}
        <header
          className="md:hidden flex items-center justify-between px-4 shrink-0"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            height: '52px',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: 'var(--lavanda)', color: '#08080F' }}
            >
              B
            </div>
            <span
              className="font-bold text-sm"
              style={{ fontFamily: 'var(--font-barlow)', letterSpacing: '0.06em', color: 'var(--cream)' }}
            >
              {pageTitle}
            </span>
          </div>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--lavanda)', color: '#08080F' }}
          >
            {initials}
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* ── Bottom navigation — só mobile ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            height: '60px',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {tabs.map(tab => {
            const active = isActive(tab.href, tab.exact)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                style={{ color: active ? 'var(--lavanda)' : 'var(--text-muted)' }}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                {active && (
                  <span
                    className="absolute bottom-0 rounded-t-full"
                    style={{
                      width: '24px',
                      height: '3px',
                      background: 'var(--lavanda)',
                    }}
                  />
                )}
              </Link>
            )
          })}

          {/* Botão Menu */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: menuOpen ? 'var(--lavanda)' : 'var(--text-muted)' }}
          >
            <span className="text-xl leading-none">☰</span>
            <span className="text-[10px] font-medium leading-none">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
