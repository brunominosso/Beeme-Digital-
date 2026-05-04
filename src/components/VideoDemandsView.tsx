'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { VideoDemand, Client, Profile } from '@/types/database'

interface Props {
  demands: VideoDemand[]
  clients: Pick<Client, 'id' | 'name'>[]
  profiles: Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]
  userRole: string
  currentUserId: string
}

type StatusKey = 'pendente' | 'em_edicao' | 'entregue' | 'cancelado'

const STATUS: Record<StatusKey, { label: string; color: string; bg: string; border: string }> = {
  pendente:   { label: 'Pendente',    color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b40' },
  em_edicao:  { label: 'Em Edição',   color: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf640' },
  entregue:   { label: 'Entregue',    color: '#22c55e', bg: '#22c55e15', border: '#22c55e40' },
  cancelado:  { label: 'Cancelado',   color: '#6b7280', bg: '#6b728015', border: '#6b728040' },
}

function statusInfo(s: string) {
  return STATUS[s as StatusKey] ?? STATUS.pendente
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function VideoDemandsView({ demands: initialDemands, clients, profiles, userRole, currentUserId }: Props) {
  const router = useRouter()
  const [demands, setDemands] = useState<VideoDemand[]>(initialDemands)
  const [activeTab, setActiveTab] = useState<'ativas' | 'entregues'>('ativas')
  const [loading, setLoading] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ client_id: '', briefing: '', drive_material_link: '' })
  const [formError, setFormError] = useState('')

  // Deliver modal
  const [delivering, setDelivering] = useState<VideoDemand | null>(null)
  const [editedLink, setEditedLink] = useState('')
  const [editedNotas, setEditedNotas] = useState('')
  const [deliverError, setDeliverError] = useState('')

  // Detail modal
  const [viewing, setViewing] = useState<VideoDemand | null>(null)

  const canCreate = userRole === 'captacao' || userRole === 'admin'
  const canEdit   = userRole === 'gestor' || userRole === 'admin'

  const clientMap = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients])
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles])

  const visibleDemands = useMemo(() => {
    if (userRole === 'captacao') return demands.filter(d => d.created_by === currentUserId)
    return demands
  }, [demands, userRole, currentUserId])

  const activeDemands   = visibleDemands.filter(d => d.status !== 'entregue' && d.status !== 'cancelado')
  const deliveredDemands = visibleDemands.filter(d => d.status === 'entregue')

  // ── Create demand ──────────────────────────────────────────
  async function handleCreate() {
    setFormError('')
    if (!form.briefing.trim()) { setFormError('Briefing é obrigatório'); return }
    if (!form.drive_material_link.trim()) { setFormError('Link do Drive é obrigatório'); return }

    setLoading(true)
    const res = await fetch('/api/video-demands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setFormError(json.error ?? 'Erro ao criar demanda'); return }
    setDemands(prev => [json.demand, ...prev])
    setShowCreate(false)
    setForm({ client_id: '', briefing: '', drive_material_link: '' })
  }

  // ── Update status ──────────────────────────────────────────
  async function updateStatus(id: string, status: string) {
    setLoading(true)
    const res = await fetch('/api/video-demands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const json = await res.json()
    setLoading(false)
    if (res.ok) setDemands(prev => prev.map(d => d.id === id ? json.demand : d))
  }

  // ── Deliver ────────────────────────────────────────────────
  async function handleDeliver() {
    setDeliverError('')
    if (!editedLink.trim()) { setDeliverError('Link do vídeo editado é obrigatório'); return }

    setLoading(true)
    const res = await fetch('/api/video-demands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: delivering!.id,
        status: 'entregue',
        drive_edited_link: editedLink.trim(),
        notas: editedNotas.trim() || null,
      }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setDeliverError(json.error ?? 'Erro ao entregar'); return }
    setDemands(prev => prev.map(d => d.id === delivering!.id ? json.demand : d))
    setDelivering(null)
    setEditedLink('')
    setEditedNotas('')
  }

  function openDeliver(d: VideoDemand) {
    setDelivering(d)
    setEditedLink(d.drive_edited_link ?? '')
    setEditedNotas(d.notas ?? '')
    setDeliverError('')
  }

  const displayList = activeTab === 'ativas' ? activeDemands : deliveredDemands

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--cream)', margin: 0 }}>
            🎬 Demandas de Vídeo
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {userRole === 'captacao'
              ? 'Envie briefings e links de materiais para edição'
              : 'Demandas de edição de vídeo recebidas'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--lavanda)', color: '#08080F', fontWeight: 600, fontSize: 13,
            }}>
            + Nova Demanda
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([['ativas', `Em Aberto (${activeDemands.length})`], ['entregues', `Entregues (${deliveredDemands.length})`]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              color: activeTab === tab ? 'var(--lavanda)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--lavanda)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Empty state ── */}
      {displayList.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text-muted)', fontSize: 14,
        }}>
          {activeTab === 'ativas' ? 'Nenhuma demanda em aberto.' : 'Nenhuma demanda entregue ainda.'}
        </div>
      )}

      {/* ── Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayList.map(d => {
          const st = statusInfo(d.status)
          const clientName = d.client_id ? clientMap[d.client_id] : null
          const creator = d.created_by ? profileMap[d.created_by] : null

          return (
            <div
              key={d.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 20px',
              }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      color: st.color, background: st.bg, border: `1px solid ${st.border}`,
                    }}>
                      {st.label}
                    </span>
                    {clientName && (
                      <span style={{ fontSize: 12, color: 'var(--lavanda)', fontWeight: 500 }}>
                        {clientName}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatDate(d.created_at)}
                    </span>
                  </div>

                  {/* Briefing */}
                  <p style={{
                    fontSize: 13, color: 'var(--cream)', margin: '0 0 10px',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {d.briefing}
                  </p>

                  {/* Links */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <a
                      href={d.drive_material_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12, color: 'var(--lavanda)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        textDecoration: 'none',
                      }}>
                      📁 Materiais (Drive)
                    </a>
                    {d.drive_edited_link && (
                      <a
                        href={d.drive_edited_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12, color: '#22c55e',
                          display: 'flex', alignItems: 'center', gap: 4,
                          textDecoration: 'none',
                        }}>
                        ✅ Vídeo Editado (Drive)
                      </a>
                    )}
                  </div>

                  {/* Notas do editor */}
                  {d.notas && (
                    <p style={{
                      fontSize: 12, color: 'var(--text-muted)',
                      marginTop: 8, fontStyle: 'italic',
                    }}>
                      Nota: {d.notas}
                    </p>
                  )}

                  {/* Creator info */}
                  {creator && userRole !== 'captacao' && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      Enviado por {creator.name}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {canEdit && d.status !== 'entregue' && d.status !== 'cancelado' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {d.status === 'pendente' && (
                      <button
                        onClick={() => updateStatus(d.id, 'em_edicao')}
                        disabled={loading}
                        style={{
                          padding: '6px 12px', borderRadius: 6, border: '1px solid #8b5cf640',
                          background: '#8b5cf615', color: '#8b5cf6', cursor: 'pointer',
                          fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                        }}>
                        Iniciar Edição
                      </button>
                    )}
                    {d.status === 'em_edicao' && (
                      <button
                        onClick={() => openDeliver(d)}
                        disabled={loading}
                        style={{
                          padding: '6px 12px', borderRadius: 6, border: '1px solid #22c55e40',
                          background: '#22c55e15', color: '#22c55e', cursor: 'pointer',
                          fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                        }}>
                        Entregar
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(d.id, 'cancelado')}
                      disabled={loading}
                      style={{
                        padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                        fontSize: 12, whiteSpace: 'nowrap',
                      }}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(8,8,15,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 24, width: '100%', maxWidth: 520,
            }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--cream)', margin: '0 0 20px' }}>
              Nova Demanda de Vídeo
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Cliente */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Cliente (opcional)
                </label>
                <select
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--cream)', fontSize: 13,
                  }}>
                  <option value="">Sem cliente específico</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Briefing */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Briefing *
                </label>
                <textarea
                  value={form.briefing}
                  onChange={e => setForm(f => ({ ...f, briefing: e.target.value }))}
                  placeholder="Descreva o que precisa: tipo de vídeo, referências, estilo, duração desejada..."
                  rows={5}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--cream)', fontSize: 13, resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Drive link */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Link da pasta de materiais (Drive) *
                </label>
                <input
                  type="url"
                  value={form.drive_material_link}
                  onChange={e => setForm(f => ({ ...f, drive_material_link: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--cream)', fontSize: 13,
                  }}
                />
              </div>

              {formError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formError}</p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                  }}>
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: 'var(--lavanda)', color: '#08080F',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? 'Enviando...' : 'Enviar Demanda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Deliver Modal ── */}
      {delivering && (
        <div
          onClick={() => setDelivering(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(8,8,15,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
            }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--cream)', margin: '0 0 6px' }}>
              Entregar Vídeo Editado
            </h2>
            {delivering.client_id && clientMap[delivering.client_id] && (
              <p style={{ fontSize: 13, color: 'var(--lavanda)', margin: '0 0 20px' }}>
                {clientMap[delivering.client_id]}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Link do vídeo editado (Drive) *
                </label>
                <input
                  type="url"
                  value={editedLink}
                  onChange={e => setEditedLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--cream)', fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={editedNotas}
                  onChange={e => setEditedNotas(e.target.value)}
                  placeholder="Observações sobre a edição, variações criadas, etc."
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-2)',
                    color: 'var(--cream)', fontSize: 13, resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {deliverError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{deliverError}</p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setDelivering(null)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                  }}>
                  Cancelar
                </button>
                <button
                  onClick={handleDeliver}
                  disabled={loading}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#22c55e', color: '#fff',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? 'Entregando...' : '✅ Marcar como Entregue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
