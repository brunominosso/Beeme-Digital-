'use client'

import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor de Tráfego',
  social_media: 'Social Media',
  designer: 'Designer',
  editor: 'Editor de Vídeos',
  financeiro: 'Financeiro',
}

export default function PreviewBanner({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-2.5 text-sm"
      style={{ background: '#9FA4DB18', borderBottom: '1px solid #9FA4DB30' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--lavanda-light)' }}>👁 A visualizar como:</span>
        <span className="font-semibold" style={{ color: 'var(--cream)' }}>{name}</span>
        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#9FA4DB20', color: '#9FA4DB' }}>
          {ROLE_LABELS[role] || role}
        </span>
      </div>
      <Link href="/admin" className="text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-80 transition-opacity"
        style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        ← Voltar à Equipa
      </Link>
    </div>
  )
}
