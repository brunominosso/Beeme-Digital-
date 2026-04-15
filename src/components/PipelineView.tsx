'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

// ── Etapas do pipeline ────────────────────────────────────────

type Etapa = {
  key: string
  label: string
  short: string
  role: 'social_media' | 'designer' | 'ambos'
}

const ETAPAS: Etapa[] = [
  { key: 'planejamento', label: 'Planejamento de Conteúdos', short: 'Planej.',  role: 'social_media' },
  { key: 'alteracoes',   label: 'Alterações',                short: 'Altera.',  role: 'social_media' },
  { key: 'captacao',     label: 'Captação Audiovisual',      short: 'Captação', role: 'social_media' },
  { key: 'edicao',       label: 'Edição Material',           short: 'Edição',   role: 'designer' },
  { key: 'design',       label: 'Design Cards',              short: 'Design',   role: 'designer' },
  { key: 'revisao',      label: 'Revisão Interna',           short: 'Revisão',  role: 'social_media' },
  { key: 'agendamento',  label: 'Agendamento',               short: 'Agenda.',  role: 'social_media' },
]

// ── Status ────────────────────────────────────────────────────

type StatusKey = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'

const STATUS: Record<StatusKey, { label: string; color: string; bg: string; icon: string }> = {
  pendente:     { label: 'Pendente',      color: '#5a5e8a', bg: '#16162a', icon: '○' },
  em_andamento: { label: 'Em andamento',  color: '#fbbf24', bg: '#fbbf2412', icon: '◑' },
  concluido:    { label: 'Concluído',     color: '#4ade80', bg: '#4ade8015', icon: '✓' },
  bloqueado:    { label: 'Bloqueado',     color: '#f87171', bg: '#f8717115', icon: '✕' },
}

const STATUS_CYCLE: StatusKey[] = ['pendente', 'em_andamento', 'concluido', 'bloqueado']

function nextStatus(current: StatusKey): StatusKey {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

// ── Helpers de data ───────────────────────────────────────────

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function daysUntil25(): number {
  const now = new Date()
  const deadline = new Date(now.getFullYear(), now.getMonth(), 25)
  if (now > deadline) {
    // Próximo mês dia 25
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 25)
    return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Componente ────────────────────────────────────────────────

interface Props {
  clients: Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]
  producao: ProducaoMensal[]
  profiles: Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]
  refMonthStr: string
  currentMonthStr: string
  userRole: string
  currentUserId: string
}

export default function PipelineView({
  clients,
  producao,
  profiles,
  refMonthStr,
  userRole,
  currentUserId,
}: Props) {
  const [records, setRecords] = useState<ProducaoMensal[]>(producao)
  const [viewMonth, setViewMonth] = useState(refMonthStr)
  const [saving, setSaving] = useState<string | null>(null) // "clientId-etapa"
  const [noteModal, setNoteModal] = useState<{ clientId: string; etapa: string; note: string } | null>(null)

  const canEdit = userRole === 'admin' || userRole === 'gestor' || userRole === 'social_media'

  // Index de records por clientId+etapa+mes para acesso rápido
  const recordIndex = useMemo(() => {
    const idx: Record<string, ProducaoMensal> = {}
    records.forEach(r => {
      if (r.mes === viewMonth) {
        idx[`${r.client_id}__${r.etapa}`] = r
      }
    })
    return idx
  }, [records, viewMonth])

  // KPIs
  const kpis = useMemo(() => {
    const monthRecords = records.filter(r => r.mes === viewMonth)
    const totalCells = clients.length * ETAPAS.length
    const concluidos = monthRecords.filter(r => r.status === 'concluido').length
    const emAndamento = monthRecords.filter(r => r.status === 'em_andamento').length
    const bloqueados = monthRecords.filter(r => r.status === 'bloqueado').length
    const pct = totalCells > 0 ? Math.round((concluidos / totalCells) * 100) : 0

    // Clientes 100% completos
    const clientesConcluidos = clients.filter(c =>
      ETAPAS.every(e => recordIndex[`${c.id}__${e.key}`]?.status === 'concluido')
    ).length

    return { totalCells, concluidos, emAndamento, bloqueados, pct, clientesConcluidos }
  }, [records, viewMonth, clients, recordIndex])

  const diasAte25 = daysUntil25()
  const isUrgent = diasAte25 <= 5

  async function toggleStatus(clientId: string, etapa: string) {
    if (!canEdit) return
    const key = `${clientId}__${etapa}`
    const current = (recordIndex[key]?.status ?? 'pendente') as StatusKey
    const next = nextStatus(current)
    const saveKey = `${clientId}-${etapa}`
    setSaving(saveKey)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const existing = recordIndex[key]
    if (existing) {
      await supabase.from('producao_mensal').update({
        status: next,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)

      setRecords(prev => prev.map(r =>
        r.id === existing.id ? { ...r, status: next, updated_by: user?.id ?? null } : r
      ))
    } else {
      const { data } = await supabase.from('producao_mensal').insert({
        client_id: clientId,
        mes: viewMonth,
        etapa,
        status: next,
        updated_by: user?.id,
      }).select().single()
      if (data) setRecords(prev => [...prev, data as ProducaoMensal])
    }

    setSaving(null)
  }

  async function saveNote() {
    if (!noteModal) return
    const { clientId, etapa, note } = noteModal
    const key = `${clientId}__${etapa}`
    const existing = recordIndex[key]
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (existing) {
      await supabase.from('producao_mensal').update({
        notas: note || null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      setRecords(prev => prev.map(r =>
        r.id === existing.id ? { ...r, notas: note || null } : r
      ))
    } else {
      const { data } = await supabase.from('producao_mensal').insert({
        client_id: clientId,
        mes: viewMonth,
        etapa,
        status: 'pendente',
        notas: note || null,
        updated_by: user?.id,
      }).select().single()
      if (data) setRecords(prev => [...prev, data as ProducaoMensal])
    }
    setNoteModal(null)
  }

  // Navegar meses
  function shiftMonth(delta: number) {
    const d = new Date(viewMonth + 'T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setViewMonth(d.toISOString().split('T')[0])
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── KPI Header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        {/* Título + navegação */}
        <div className="px-6 pt-4 pb-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: 'var(--cream)' }}>Pipeline de Produção</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>‹</button>
            <span className="text-sm font-semibold capitalize px-1"
              style={{ color: 'var(--cream)', minWidth: 140, textAlign: 'center' }}>
              {monthLabel(viewMonth)}
            </span>
            <button onClick={() => shiftMonth(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>›</button>
          </div>
        </div>

        {/* Dashboard row */}
        <div className="px-6 pb-4 flex items-center gap-4 overflow-x-auto">

          {/* Grande círculo geral */}
          <div className="shrink-0 flex flex-col items-center justify-center gap-1 px-3">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={kpis.pct === 100 ? '#4ade80' : '#9FA4DB'}
                  strokeWidth="3.5"
                  strokeDasharray={`${kpis.pct} ${100 - kpis.pct}`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-bold"
                style={{ color: 'var(--cream)', fontSize: '1rem', fontFamily: 'var(--font-barlow)' }}>
                {kpis.pct}%
              </span>
            </div>
            <span className="label-caps text-center">Geral</span>
          </div>

          {/* Divisor */}
          <div className="w-px h-16 shrink-0" style={{ background: 'var(--border)' }} />

          {/* Magic Number (prazo) */}
          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{
              fontSize: '1.6rem', fontFamily: 'var(--font-barlow)',
              color: isUrgent ? '#f87171' : 'var(--cream)',
            }}>
              {diasAte25}/25
            </p>
            <p className="label-caps mt-0.5" style={{ color: isUrgent ? '#f87171' : 'var(--text-muted)' }}>
              {isUrgent ? '⚠ urgente' : 'dias p/ dia 25'}
            </p>
          </div>

          {/* Total */}
          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: 'var(--cream)' }}>
              {kpis.totalCells}
            </p>
            <p className="label-caps mt-0.5">Total</p>
          </div>

          {/* Feitos */}
          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#4ade80' }}>
              {kpis.concluidos}
            </p>
            <p className="label-caps mt-0.5">Feitos</p>
          </div>

          {/* Pendentes */}
          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#fbbf24' }}>
              {kpis.totalCells - kpis.concluidos}
            </p>
            <p className="label-caps mt-0.5">Pendentes</p>
          </div>

          {/* Divisor */}
          <div className="w-px h-16 shrink-0" style={{ background: 'var(--border)' }} />

          {/* Círculos por etapa */}
          {ETAPAS.map(e => {
            const concluidos = clients.filter(
              c => recordIndex[`${c.id}__${e.key}`]?.status === 'concluido'
            ).length
            const pct = clients.length > 0 ? Math.round((concluidos / clients.length) * 100) : 0
            const color = pct === 100 ? '#4ade80' : pct >= 50 ? '#9FA4DB' : pct > 0 ? '#fbbf24' : 'var(--text-dim)'

            return (
              <div key={e.key} className="shrink-0 flex flex-col items-center gap-1 px-2">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-2)" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={color} strokeWidth="4"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                    style={{ color, fontFamily: 'var(--font-barlow)' }}>
                    {pct}%
                  </span>
                </div>
                <span className="label-caps text-center" style={{ fontSize: '0.55rem', maxWidth: 56 }}>
                  {e.short}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Matriz ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-4xl">📋</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum cliente ativo</p>
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Coluna clientes */}
                <th className="px-4 py-3 text-left border-b border-r"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    minWidth: 160,
                    position: 'sticky',
                    left: 0,
                    zIndex: 20,
                  }}>
                  <span className="label-caps">Cliente</span>
                </th>

                {/* Colunas de etapas */}
                {ETAPAS.map(e => (
                  <th key={e.key} className="px-2 py-3 text-center border-b border-r"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 110 }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--cream)' }}>{e.short}</p>
                    <p className="text-xs mt-0.5" style={{
                      color: e.role === 'designer' ? '#2dd4bf' : 'var(--text-dim)',
                      fontSize: '0.6rem',
                    }}>
                      {e.role === 'designer' ? 'Designer' : 'Social Media'}
                    </p>
                  </th>
                ))}

                {/* Coluna progresso do cliente */}
                <th className="px-3 py-3 text-center border-b"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 80 }}>
                  <span className="label-caps">Total</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client, ci) => {
                // Progresso deste cliente
                const clientConcluidos = ETAPAS.filter(
                  e => recordIndex[`${client.id}__${e.key}`]?.status === 'concluido'
                ).length
                const clientPct = Math.round((clientConcluidos / ETAPAS.length) * 100)
                const isComplete = clientConcluidos === ETAPAS.length

                return (
                  <tr key={client.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isComplete ? '#4ade8006' : ci % 2 === 0 ? 'transparent' : 'var(--surface)08',
                    }}>

                    {/* Nome do cliente */}
                    <td className="px-4 py-3 border-r"
                      style={{
                        borderColor: 'var(--border)',
                        position: 'sticky',
                        left: 0,
                        background: isComplete ? '#4ade8008' : 'var(--surface)',
                        zIndex: 5,
                      }}>
                      <div className="flex items-center gap-2">
                        {isComplete && (
                          <span className="text-xs" style={{ color: '#4ade80' }}>✓</span>
                        )}
                        <span className="text-sm font-medium truncate max-w-[130px]"
                          style={{ color: isComplete ? '#4ade80' : 'var(--cream)' }}>
                          {client.name}
                        </span>
                      </div>
                    </td>

                    {/* Células de etapa */}
                    {ETAPAS.map(e => {
                      const key = `${client.id}__${e.key}`
                      const record = recordIndex[key]
                      const st = (record?.status ?? 'pendente') as StatusKey
                      const cfg = STATUS[st]
                      const isSaving = saving === `${client.id}-${e.key}`

                      return (
                        <td key={e.key} className="px-2 py-2 text-center border-r"
                          style={{ borderColor: 'var(--border)' }}>
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => toggleStatus(client.id, e.key)}
                              disabled={!canEdit || isSaving}
                              title={`${cfg.label} — clica para avançar`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all disabled:opacity-50"
                              style={{
                                background: cfg.bg,
                                border: `1.5px solid ${st === 'pendente' ? 'var(--border)' : cfg.color + '60'}`,
                                color: cfg.color,
                                cursor: canEdit ? 'pointer' : 'default',
                              }}>
                              {isSaving ? '·' : cfg.icon}
                            </button>
                            {record?.notas && (
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fbbf24' }}
                                title={record.notas} />
                            )}
                            {canEdit && (
                              <button
                                onClick={() => setNoteModal({
                                  clientId: client.id,
                                  etapa: e.key,
                                  note: record?.notas ?? '',
                                })}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>
                                nota
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    })}

                    {/* Progresso do cliente */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-bold"
                          style={{ color: isComplete ? '#4ade80' : 'var(--cream)', fontFamily: 'var(--font-barlow)' }}>
                          {clientPct}%
                        </span>
                        <div className="w-12 h-1 rounded-full overflow-hidden"
                          style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${clientPct}%`,
                              background: isComplete ? '#4ade80' : clientPct > 50 ? '#fbbf24' : '#9FA4DB',
                            }} />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>
                          {clientConcluidos}/{ETAPAS.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Legenda ─────────────────────────────────────────── */}
      <div className="px-6 py-3 border-t shrink-0 flex items-center gap-4 flex-wrap"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <span className="label-caps">Status:</span>
        {Object.entries(STATUS).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}40`, color: cfg.color }}>
              {cfg.icon}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
          Clica numa célula para avançar o status
        </span>
      </div>

      {/* ── Modal de nota ───────────────────────────────────── */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-sm rounded-xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>
                Nota — {ETAPAS.find(e => e.key === noteModal.etapa)?.label}
              </h3>
              <button onClick={() => setNoteModal(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {clients.find(c => c.id === noteModal.clientId)?.name}
              </p>
              <textarea
                value={noteModal.note}
                onChange={e => setNoteModal({ ...noteModal, note: e.target.value })}
                rows={4}
                placeholder="Ex: aguardando material do cliente, captação marcada para quinta..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', lineHeight: 1.6 }}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={saveNote}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#08080F' }}>
                  Guardar
                </button>
                <button onClick={() => setNoteModal(null)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
