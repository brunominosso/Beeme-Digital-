'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

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

const COMPANY_INFO_KEY = 'beeme_company_info'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

/* ── Secção editável de texto ── */
function EditableSection({
  title,
  value,
  placeholder,
  onSave,
}: {
  title: string
  value: string
  placeholder: string
  onSave: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    onSave(draft)
    setEditing(false)
  }

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="label-caps">{title}</p>
        {!editing ? (
          <button onClick={() => { setDraft(value); setEditing(true) }}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{ color: 'var(--accent)', background: 'var(--surface-2)' }}>
            ✎ Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
              Guardar
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={4}
          autoFocus
          className="w-full text-sm outline-none resize-none"
          style={{ background: 'transparent', color: 'var(--text)', lineHeight: '1.75' }}
        />
      ) : value ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{value}</p>
      ) : (
        <button onClick={() => { setDraft(''); setEditing(true) }}
          className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
          {placeholder}
        </button>
      )}
    </div>
  )
}

export default function AboutView({ profiles }: { profiles: Profile[] }) {
  // Persistent company info stored in localStorage (simples, sem BD extra)
  const load = (key: string) => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(`${COMPANY_INFO_KEY}_${key}`) || ''
  }
  const save = (key: string, val: string) => localStorage.setItem(`${COMPANY_INFO_KEY}_${key}`, val)

  const [mission, setMission]     = useState(() => load('mission'))
  const [vision, setVision]       = useState(() => load('vision'))
  const [values, setValues]       = useState(() => load('values'))
  const [story, setStory]         = useState(() => load('story'))

  // Profile edit
  const [editingProfile, setEditingProfile] = useState<string | null>(null)
  const [epName, setEpName]         = useState('')
  const [epRole, setEpRole]         = useState('')
  const [epColor, setEpColor]       = useState('')
  const [epResp, setEpResp]         = useState('')
  const [epSaving, setEpSaving]     = useState(false)
  const [localProfiles, setLocalProfiles] = useState(profiles)

  function openEdit(p: Profile) {
    setEditingProfile(p.id)
    setEpName(p.name || '')
    setEpRole(p.role)
    setEpColor(p.avatar_color)
    setEpResp(p.responsibilities || '')
  }

  async function saveProfile() {
    if (!editingProfile) return
    setEpSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      name: epName,
      role: epRole,
      avatar_color: epColor,
      responsibilities: epResp || null,
    }).eq('id', editingProfile)
    setLocalProfiles(prev => prev.map(p =>
      p.id === editingProfile
        ? { ...p, name: epName, role: epRole, avatar_color: epColor, responsibilities: epResp || null }
        : p
    ))
    setEpSaving(false)
    setEditingProfile(null)
  }

  const COLORS = ['#9FA4DB', '#B8BCEE', '#ec4899', '#f59e0b', '#10b981', '#4ade80', '#6c63ff', '#ef4444', '#a855f7']

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Hero */}
      <div className="rounded-2xl p-8 relative overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* decorative */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5 -translate-y-1/2 translate-x-1/2"
          style={{ background: 'var(--lavanda)' }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4"
            style={{ background: 'var(--lavanda)', color: '#08080F', fontFamily: 'var(--font-barlow)' }}>
            B
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--cream)', fontFamily: 'var(--font-barlow)', letterSpacing: '0.03em' }}>
            Beeme Digital
          </h1>
          <p className="text-base mt-1" style={{ color: 'var(--lavanda)' }}>Agência de Marketing Digital</p>
          <div className="flex items-center gap-4 mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>🌍 Brasil</span>
            <span>👥 {localProfiles.length} pessoas</span>
            <span>📅 Desde 2023</span>
          </div>
        </div>
      </div>

      {/* Missão / Visão / Valores */}
      <div className="grid grid-cols-3 gap-4">
        <EditableSection
          title="Missão"
          value={mission}
          placeholder="Clica para definir a missão da Beeme Digital..."
          onSave={v => { setMission(v); save('mission', v) }}
        />
        <EditableSection
          title="Visão"
          value={vision}
          placeholder="Clica para definir a visão da Beeme Digital..."
          onSave={v => { setVision(v); save('vision', v) }}
        />
        <EditableSection
          title="Valores"
          value={values}
          placeholder="Clica para definir os valores da Beeme Digital..."
          onSave={v => { setValues(v); save('values', v) }}
        />
      </div>

      {/* Nossa história */}
      <EditableSection
        title="Nossa história"
        value={story}
        placeholder="Clica para contar a história da Beeme Digital..."
        onSave={v => { setStory(v); save('story', v) }}
      />

      {/* Equipa */}
      <div>
        <h2 className="label-caps mb-4">A equipa</h2>
        <div className="grid grid-cols-3 gap-4">
          {localProfiles.map(p => {
            const roleColor = ROLE_COLORS[p.role] || 'var(--lavanda)'
            const roleLabel = ROLE_LABELS[p.role] || p.role
            return (
              <div key={p.id} className="rounded-xl p-5 group"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ background: p.avatar_color, color: '#08080F', fontFamily: 'var(--font-barlow)' }}>
                    {getInitials(p.name || '?')}
                  </div>
                  <button onClick={() => openEdit(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-lg"
                    style={{ color: 'var(--accent)', background: 'var(--surface-2)' }}>
                    ✎
                  </button>
                </div>
                <p className="font-semibold" style={{ color: 'var(--cream)', fontFamily: 'var(--font-barlow)', fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                  {p.name || 'Sem nome'}
                </p>
                <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium"
                  style={{ background: roleColor + '20', color: roleColor, border: `1px solid ${roleColor}30` }}>
                  {roleLabel}
                </span>
                {p.responsibilities && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {p.responsibilities}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit profile modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Editar perfil</h2>
              <button onClick={() => setEditingProfile(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Preview avatar */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
                style={{ background: epColor, color: '#08080F', fontFamily: 'var(--font-barlow)' }}>
                {getInitials(epName || '?')}
              </div>
              <div className="flex-1">
                <input type="text" placeholder="Nome *" value={epName} onChange={e => setEpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  autoFocus />
              </div>
            </div>

            {/* Cargo */}
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Cargo</p>
              <select value={epRole} onChange={e => setEpRole(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Cor do avatar */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Cor do avatar</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEpColor(c)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: epColor === c ? `3px solid white` : 'none',
                      outlineOffset: '2px',
                    }} />
                ))}
              </div>
            </div>

            {/* Responsabilidades */}
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Principais responsabilidades</p>
              <textarea value={epResp} onChange={e => setEpResp(e.target.value)}
                rows={3} placeholder="O que esta pessoa faz na Beeme Digital..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>

            <button onClick={saveProfile} disabled={!epName.trim() || epSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {epSaving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
