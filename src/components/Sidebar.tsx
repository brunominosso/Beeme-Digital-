'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import NotificationsPanel from './NotificationsPanel'
import SearchModal from './SearchModal'

type NavItem = { href: string; label: string; icon: string; exact: boolean; adminOnly?: boolean; roles?: string[] }
type NavGroup = { section: string | null; items: NavItem[] }

const NAV: NavGroup[] = [
  { section: null, items: [
    { href: '/', label: 'Dashboard', icon: '⚡', exact: true },
  ]},
  { section: 'GESTÃO', items: [
    { href: '/leads',      label: 'Leads & Clientes', icon: '👥', exact: false, roles: ['admin','gestor','social_media','designer','editor','financeiro'] },
    { href: '/conteudos',  label: 'Conteúdos',        icon: '🎨', exact: false, roles: ['admin','social_media','designer','editor'] },
    { href: '/kanban',     label: 'Tarefas',           icon: '📋', exact: false, roles: ['admin','gestor','social_media','designer','editor'] },
    { href: '/pautas',     label: 'Pautas',              icon: '📆', exact: false, roles: ['admin','gestor','social_media','designer'] },
    { href: '/meetings',   label: 'Reuniões',           icon: '📅', exact: false, roles: ['admin','gestor','social_media'] },
    { href: '/goals',      label: 'Metas & OKR',        icon: '🎯', exact: false, roles: ['admin','gestor'] },
    { href: '/financial',  label: 'Financeiro',          icon: '💰', exact: false, roles: ['admin','financeiro'] },
  ]},
  { section: 'EMPRESA', items: [
    { href: '/about',    label: 'Quem Somos',         icon: '🏢', exact: false },
    { href: '/services', label: 'Produtos & Serviços', icon: '📦', exact: false, roles: ['admin','gestor','financeiro'] },
  ]},
  { section: 'ADMIN', items: [
    { href: '/admin', label: 'Equipa', icon: '👤', exact: false, adminOnly: true },
  ]},
]

interface Props {
  user: User
  role: string
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ user, role, isOpen = false, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  function handleNavClick() {
    onClose?.()
  }

  return (
    <aside
      className={[
        // Mobile: fixed drawer deslizante
        'fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r transition-transform duration-300',
        'md:static md:translate-x-0 md:w-56 md:z-auto md:transition-none md:shrink-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: 'var(--lavanda)', color: '#08080F' }}>
            B
          </div>
          <div>
            <p className="font-bold leading-none" style={{ fontFamily: 'var(--font-barlow)', fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--cream)' }}>
              Beeme Digital
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Gestão</p>
          </div>
        </div>
        {/* Botão fechar — só aparece no mobile */}
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Fechar menu"
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          <span className="text-base leading-none">🔍</span>
          <span className="flex-1 text-left">Buscar</span>
          <kbd
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--border)', color: 'var(--text-muted)', fontFamily: 'inherit' }}
          >
            ⌘K
          </kbd>
        </button>

        {NAV.filter(group => group.section !== 'ADMIN' || role === 'admin').map((group, i) => {
          const visibleItems = group.items.filter(item => {
            if (item.adminOnly && role !== 'admin') return false
            if (item.roles && !item.roles.includes(role)) return false
            return true
          })
          if (visibleItems.length === 0) return null
          return (
            <div key={i}>
              {group.section && (
                <p className="label-caps px-3 mb-1">{group.section}</p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const active = isActive(item.href, item.exact)
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={handleNavClick}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all"
                      style={{
                        background: active ? '#9FA4DB14' : 'transparent',
                        color: active ? 'var(--lavanda-light)' : 'var(--text-muted)',
                        borderLeft: active ? '2px solid var(--lavanda)' : '2px solid transparent',
                        marginLeft: '-2px',
                      }}>
                      <span className="text-base leading-none">{item.icon}</span>
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
        {/* Notifications row */}
        <div className="flex items-center justify-between px-5 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Notificações</span>
          <NotificationsPanel />
        </div>

        {/* User */}
        <div className="px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--lavanda)', color: '#08080F' }}>
            {(user.user_metadata?.name || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user.user_metadata?.name || 'Utilizador'}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
          <button onClick={handleLogout} title="Sair"
            className="text-xs shrink-0 transition-colors hover:text-white"
            style={{ color: 'var(--text-muted)' }}>
            ⏏
          </button>
        </div>
        </div>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </aside>
  )
}
