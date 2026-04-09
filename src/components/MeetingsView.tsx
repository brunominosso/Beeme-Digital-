'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Meeting, Client, Profile } from '@/types/database'

type Tab = 'agendadas' | 'realizadas'

const ROLE_LABELS: Record<string, string> = {
  gestor: 'Gestor de Tráfego',
  social_media: 'Social Media',
  designer: 'Designer',
  editor: 'Editor',
  financeiro: 'Financeiro',
  admin: 'Admin',
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function MeetingsView({
  initialMeetings,
  clients,
  profiles,
}: {
  initialMeetings: Meeting[]
  clients: Pick<Client, 'id' | 'name'>[]
  profiles: Profile[]
}) {
  const router = useRouter()
  const [meetings, setMeetings] = useState(initialMeetings)
  const [tab, setTab] = useState<Tab>('agendadas')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Meeting | null>(null)

  // Form state
  const [fTitle, setFTitle] = useState('')
  const [fDate, setFDate] = useState('')
  const [fClient, setFClient] = useState('')
  const [fAttendees, setFAttendees] = useState<string[]>([])
  const [fNotes, setFNotes] = useState('')
  const [fStatus, setFStatus] = useState<'scheduled' | 'done'>('scheduled')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Edit notes state
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const scheduled = meetings.filter(m => m.status === 'scheduled').sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const done = meetings.filter(m => m.status === 'done').sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const visible = tab === 'agendadas' ? scheduled : done

  function toggleAttendee(id: string) {
    setFAttendees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function saveMeeting() {
    if (!fTitle.trim() || !fDate) return
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('meetings').insert({
      title: fTitle,
      date: fDate,
      client_id: fClient || null,
      attendees: fAttendees.length > 0 ? fAttendees : null,
      notes: fNotes || null,
      status: fStatus,
      created_by: user?.id,
    }).select().single()

    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }

    if (data) {
      setMeetings(prev => [data as Meeting, ...prev])
      setTab(fStatus === 'scheduled' ? 'agendadas' : 'realizadas')
      setShowForm(false)
      setFTitle(''); setFDate(''); setFClient(''); setFAttendees([]); setFNotes(''); setFStatus('scheduled')
    }
    setSaving(false)
  }

  async function markDone(meeting: Meeting) {
    const supabase = createClient()
    await supabase.from('meetings').update({ status: 'done' }).eq('id', meeting.id)
    setMeetings(prev => prev.map(m => m.id === meeting.id ? { ...m, status: 'done' } : m))
    if (selected?.id === meeting.id) setSelected({ ...meeting, status: 'done' })
  }

  async function saveNotes() {
    if (!selected) return
    setSavingNotes(true)
    const supabase = createClient()
    await supabase.from('meetings').update({ notes: notesDraft }).eq('id', selected.id)
    const updated = { ...selected, notes: notesDraft }
    setMeetings(prev => prev.map(m => m.id === selected.id ? updated : m))
    setSelected(updated)
    setSavingNotes(false); setEditingNotes(false)
  }

  function openMeeting(m: Meeting) {
    setSelected(m)
    setNotesDraft(m.notes || '')
    setEditingNotes(false)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  const now = new Date()

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Lista lateral */}
      <div className="w-96 flex flex-col border-r shrink-0" style={{ borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold" style={{ color: 'var(--cream)' }}>Reuniões</h1>
            <button onClick={() => setShowForm(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
              + Nova
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b -mb-px" style={{ borderColor: 'var(--border)' }}>
            {([
              { key: 'agendadas', label: 'Agendadas', count: scheduled.length },
              { key: 'realizadas', label: 'Realizadas', count: done.length },
            ] as { key: Tab; label: string; count: number }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 text-xs font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
                style={{
                  borderColor: tab === t.key ? 'var(--accent)' : 'transparent',
                  color: tab === t.key ? 'var(--lavanda-light)' : 'var(--text-muted)',
                }}>
                {t.label}
                {t.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <p className="text-3xl">{tab === 'agendadas' ? '📅' : '✅'}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {tab === 'agendadas' ? 'Sem reuniões agendadas' : 'Sem reuniões realizadas'}
              </p>
              <button onClick={() => setShowForm(true)}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                + Agendar reunião
              </button>
            </div>
          ) : (
            visible.map(m => {
              const d = new Date(m.date)
              const isToday = m.date.startsWith(now.toISOString().split('T')[0])
              const isPast = d < now && m.status === 'scheduled'
              const clientName = clients.find(c => c.id === m.client_id)?.name
              const attendeeProfiles = profiles.filter(p => m.attendees?.includes(p.id))
              const isSelected = selected?.id === m.id

              return (
                <button key={m.id} onClick={() => openMeeting(m)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: isSelected ? '#9FA4DB0f' : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--lavanda)' : '2px solid transparent',
                  }}>
                  {/* Date badge */}
                  <div className="w-11 shrink-0 rounded-lg flex flex-col items-center justify-center py-1.5"
                    style={{
                      background: isToday ? 'var(--lavanda)20' : 'var(--surface-2)',
                      border: `1px solid ${isToday ? 'var(--lavanda)' : 'var(--border)'}`,
                    }}>
                    <span className="text-xs font-bold leading-none"
                      style={{ color: isToday ? 'var(--lavanda-light)' : 'var(--text)' }}>
                      {d.getDate()}
                    </span>
                    <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {d.toLocaleDateString('pt-PT', { month: 'short' })}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: isPast ? 'var(--danger)' : 'var(--cream)' }}>
                      {m.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {clientName && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {clientName}
                        </span>
                      )}
                      {isToday && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'var(--lavanda)20', color: 'var(--lavanda)' }}>
                          Hoje
                        </span>
                      )}
                      {isPast && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: 'var(--danger)15', color: 'var(--danger)' }}>
                          Atrasada
                        </span>
                      )}
                    </div>
                    {attendeeProfiles.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {attendeeProfiles.slice(0, 4).map(p => (
                          <div key={p.id}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: p.avatar_color, color: '#08080F' }}
                            title={p.name || ''}>
                            {(p.name || '?')[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-4xl">📋</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Seleciona uma reunião para ver os detalhes</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>{selected.title}</h2>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      📅 {new Date(selected.date).toLocaleDateString('pt-PT', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      🕐 {new Date(selected.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selected.status === 'scheduled' && (
                    <button onClick={() => markDone(selected)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--success)20', color: 'var(--success)', border: '1px solid var(--success)40' }}>
                      ✓ Marcar realizada
                    </button>
                  )}
                  {selected.status === 'done' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'var(--success)20', color: 'var(--success)' }}>
                      ✓ Realizada
                    </span>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {clients.find(c => c.id === selected.client_id) && (
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="label-caps mb-1">Cliente</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--cream)' }}>
                      {clients.find(c => c.id === selected.client_id)?.name}
                    </p>
                  </div>
                )}
                {selected.attendees && selected.attendees.length > 0 && (
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="label-caps mb-2">Participantes</p>
                    <div className="flex gap-2 flex-wrap">
                      {profiles.filter(p => selected.attendees?.includes(p.id)).map(p => (
                        <div key={p.id} className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: p.avatar_color, color: '#08080F' }}>
                            {(p.name || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.name?.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ata */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="label-caps">Ata da reunião</p>
                {!editingNotes ? (
                  <button onClick={() => setEditingNotes(true)}
                    className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--accent)', background: 'var(--surface-2)' }}>
                    ✎ Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveNotes} disabled={savingNotes}
                      className="text-xs px-2.5 py-1 rounded-lg font-semibold text-white disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}>
                      {savingNotes ? '...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditingNotes(false)}
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {editingNotes ? (
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={12}
                  placeholder="Escreve aqui a ata — o que foi discutido, decisões tomadas, próximos passos..."
                  className="w-full text-sm outline-none resize-none"
                  style={{ background: 'transparent', color: 'var(--text)', lineHeight: '1.7' }}
                  autoFocus
                />
              ) : selected.notes ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {selected.notes}
                </div>
              ) : (
                <button onClick={() => setEditingNotes(true)}
                  className="text-sm italic w-full text-left py-4"
                  style={{ color: 'var(--text-muted)' }}>
                  Sem ata ainda — clica para adicionar...
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New meeting modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Nova Reunião</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Título *" value={fTitle} onChange={e => setFTitle(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />

            <input type="datetime-local" value={fDate} onChange={e => setFDate(e.target.value)}
              className={inputClass} style={inputStyle} />

            {/* Estado */}
            <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              <button onClick={() => setFStatus('scheduled')}
                className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{ background: fStatus === 'scheduled' ? 'var(--accent)' : 'transparent', color: fStatus === 'scheduled' ? 'white' : 'var(--text-muted)' }}>
                📅 Agendada
              </button>
              <button onClick={() => setFStatus('done')}
                className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{ background: fStatus === 'done' ? 'var(--success)' : 'transparent', color: fStatus === 'done' ? 'white' : 'var(--text-muted)' }}>
                ✓ Já realizada
              </button>
            </div>

            {/* Cliente */}
            <select value={fClient} onChange={e => setFClient(e.target.value)}
              className={inputClass} style={inputStyle}>
              <option value="">Sem cliente associado</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Participantes */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Participantes</p>
              <div className="flex flex-wrap gap-2">
                {profiles.map(p => {
                  const active = fAttendees.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => toggleAttendee(p.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: active ? p.avatar_color + '25' : 'var(--surface-2)',
                        border: `1px solid ${active ? p.avatar_color : 'var(--border)'}`,
                        color: active ? p.avatar_color : 'var(--text-muted)',
                      }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: active ? p.avatar_color : 'var(--border)', color: '#08080F' }}>
                        {(p.name || '?')[0].toUpperCase()}
                      </div>
                      {p.name?.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notas iniciais */}
            <textarea placeholder="Notas / agenda (opcional)" value={fNotes} onChange={e => setFNotes(e.target.value)}
              rows={3} className={inputClass} style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} />

            {saveError && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger)15', color: 'var(--danger)' }}>
                Erro: {saveError}
              </p>
            )}
            <button onClick={saveMeeting} disabled={!fTitle.trim() || !fDate || saving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'A criar...' : 'Criar reunião'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
