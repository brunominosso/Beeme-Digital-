'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client, Profile } from '@/types/database'

const PIPELINE_COLS = [
  { id: 'em_negociacao', label: 'Em negociação', color: '#6c63ff' },
  { id: 'onboarding', label: 'Onboarding', color: '#f59e0b' },
  { id: 'lead_perdido', label: 'Lead Perdido', color: '#ef4444' },
  { id: 'inativo', label: 'Cliente Inativo', color: '#7070a0' },
]

export default function LeadsView({
  initialClients,
  profiles,
}: {
  initialClients: Client[]
  profiles: Profile[]
}) {
  const router = useRouter()
  const [clients, setClients] = useState(initialClients)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newInstagram, setNewInstagram] = useState('')
  const [saving, setSaving] = useState(false)

  const pipelineClients = clients.filter(c => c.status !== 'ativo')
  const activeClients = clients.filter(c => c.status === 'ativo')

  async function moveClient(clientId: string, newStatus: string) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
    const supabase = createClient()
    await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
  }

  async function createClient_() {
    if (!newName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('clients').insert({
      name: newName, city: newCity || null, instagram: newInstagram || null,
      user_id: user!.id, status: 'em_negociacao', niche: '',
    }).select().single()
    if (data) setClients(prev => [data as Client, ...prev])
    setSaving(false); setShowNewForm(false)
    setNewName(''); setNewCity(''); setNewInstagram('')
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads & Clientes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pipelineClients.length} em pipeline · {activeClients.length} clientes ativos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: 'var(--accent)' }}>
            + Novo Cliente
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>PIPELINE</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-4">
          {PIPELINE_COLS.map(col => {
            const colClients = pipelineClients.filter(c => c.status === col.id)
            const isOver = dragOver === col.id
            return (
              <div key={col.id}
                className="rounded-xl min-h-48 flex flex-col shrink-0 w-64 md:w-auto"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isOver ? col.color : 'var(--border)'}`,
                  transition: 'border-color 0.15s',
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => {
                  e.preventDefault()
                  if (dragging) moveClient(dragging, col.id)
                  setDragging(null); setDragOver(null)
                }}
                >
                {/* Col header */}
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    {colClients.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 flex-1">
                  {colClients.map(c => (
                    <div key={c.id}
                      draggable
                      onDragStart={() => setDragging(c.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => router.push(`/leads/${c.id}`)}
                      className="rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        opacity: dragging === c.id ? 0.4 : 1,
                      }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: col.color + '40', border: `1px solid ${col.color}40`, color: col.color }}>
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          {c.city && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.city}</p>}
                        </div>
                      </div>
                      {/* Move to ativo button */}
                      {col.id === 'onboarding' && (
                        <button
                          onClick={e => { e.stopPropagation(); moveClient(c.id, 'ativo') }}
                          className="mt-2 w-full text-xs py-1 rounded font-medium transition-colors"
                          style={{ background: 'var(--success)20', color: 'var(--success)', border: '1px solid var(--success)40' }}>
                          ✓ Mover para Cliente Ativo
                        </button>
                      )}
                    </div>
                  ))}
                  {colClients.length === 0 && (
                    <div className="h-16 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      Arrasta aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active clients grid — também é zona de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver('ativo') }}
        onDragLeave={() => setDragOver(null)}
        onDrop={e => { e.preventDefault(); if (dragging) moveClient(dragging, 'ativo'); setDragging(null); setDragOver(null) }}
      >
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          NOSSOS CLIENTES ATIVOS — {activeClients.length}
          {dragOver === 'ativo' && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--success)20', color: 'var(--success)' }}>
              Soltar aqui para ativar
            </span>
          )}
        </h2>
        {!activeClients.length ? (
          <div className="rounded-xl p-12 text-center transition-colors"
            style={{
              background: dragOver === 'ativo' ? 'var(--success)10' : 'var(--surface)',
              border: `1px solid ${dragOver === 'ativo' ? 'var(--success)' : 'var(--border)'}`,
            }}>
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-white font-medium">Nenhum cliente ativo ainda</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Arrasta um card de Onboarding para aqui</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {activeClients.map(c => {
              const responsibles = profiles.filter(p => c.responsible_ids?.includes(p.id))
              return (
                <div key={c.id}
                  draggable
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => router.push(`/leads/${c.id}`)}
                  className="rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: dragging === c.id ? 0.4 : 1 }}>
                  {/* Logo area */}
                  <div className="h-28 flex items-center justify-center"
                    style={{ background: 'var(--surface-2)' }}>
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white"
                        style={{ background: 'var(--accent)' }}>
                        {getInitials(c.name)}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                    {c.city && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.city}</p>}
                    {responsibles.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {responsibles.slice(0, 3).map(r => (
                          <div key={r.id} title={r.name || ''}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: r.avatar_color }}>
                            {(r.name || '?')[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New client modal */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Novo cliente / lead</h2>
              <button onClick={() => setShowNewForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <input type="text" placeholder="Nome da empresa *" value={newName} onChange={e => setNewName(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />
            <input type="text" placeholder="Cidade" value={newCity} onChange={e => setNewCity(e.target.value)}
              className={inputClass} style={inputStyle} />
            <input type="text" placeholder="Instagram (sem @)" value={newInstagram} onChange={e => setNewInstagram(e.target.value)}
              className={inputClass} style={inputStyle} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Entra em Em negociação — podes completar o perfil depois</p>
            <button onClick={createClient_} disabled={!newName.trim() || saving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'A criar...' : 'Criar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
