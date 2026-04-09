'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type NavItem = { href: string; label: string; icon: string; exact: boolean; adminOnly?: boolean; roles?: string[] }
type NavGroup = { section: string | null; items: NavItem[] }

// roles: quais roles veem este item. Se omitido = todos.
const NAV: NavGroup[] = [
  { section: null, items: [
    { href: '/', label: 'Dashboard', icon: '⚡', exact: true },
  ]},
  { section: 'GESTÃO', items: [
    { href: '/leads',      label: 'Leads & Clientes', icon: '👥', exact: false, roles: ['admin','gestor','social_media','designer','editor','financeiro'] },
    { href: '/conteudos',  label: 'Conteúdos',        icon: '🎨', exact: false, roles: ['admin','social_media','designer','editor'] },
    { href: '/kanban',     label: 'Tarefas',           icon: '📋', exact: false, roles: ['admin','gestor','social_media','designer','editor'] },
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

export default function Sidebar({ user, role }: { user: User; role: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-56 flex flex-col border-r shrink-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
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
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
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
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
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

      {/* User */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
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
    </aside>
  )
}
