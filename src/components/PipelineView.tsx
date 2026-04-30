'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

// ── Etapas do pipeline ────────────────────────────────────────

type Etapa = {
  key: string
  label: string
  short: string
  role: 'social_media' | 'designer' | 'ambos'
  pautaTipo?: string  // tipo de pauta correspondente para criar
}

const ETAPAS: Etapa[] = [
  { key: 'planejamento', label: 'Planejamento de Conteúdos', short: 'Planej.',   role: 'social_media', pautaTipo: 'planejamento'  },
  { key: 'captacao',     label: 'Captação Audiovisual',      short: 'Captação',  role: 'social_media', pautaTipo: 'captacao'      },
  { key: 'edicao',       label: 'Edição de Vídeo',           short: 'Edição',    role: 'designer',     pautaTipo: 'edicao_video'  },
  { key: 'design',       label: 'Design de Cards',           short: 'Design',    role: 'designer',     pautaTipo: 'edicao_cards'  },
  { key: 'aprovacao',    label: 'Aprovação do Cliente',      short: 'Aprovação', role: 'social_media'                             },
  { key: 'agendamento',  label: 'Agendamento',               short: 'Agenda.',   role: 'social_media', pautaTipo: 'agendamento'   },
]

// ── Status ────────────────────────────────────────────────────

type StatusKey = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado' | 'atrasado'

const STATUS: Record<StatusKey, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pendente:     { label: 'Pendente',      color: '#5a5e8a', bg: 'transparent',  border: 'var(--border)',  icon: '○' },
  em_andamento: { label: 'Em andamento',  color: '#fbbf24', bg: '#fbbf2410',    border: '#fbbf2440',      icon: '◑' },
  concluido:    { label: 'Concluído',     color: '#4ade80', bg: '#4ade8012',    border: '#4ade8050',      icon: '✓' },
  bloqueado:    { label: 'Bloqueado',     color: '#f87171', bg: '#f8717112',    border: '#f8717150',      icon: '✕' },
  atrasado:     { label: 'Atrasado',      color: '#ef4444', bg: '#ef444415',    border: '#ef4444',        icon: '🚨' },
}

// ── Helpers ───────────────────────────────────────────────────

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

function daysUntil25(): number {
  const now = new Date()
  const deadline = new Date(now.getFullYear(), now.getMonth(), 25)
  if (now > deadline) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 25)
    return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Componente ────────────────────────────────────────────────

interface PautaInfo {
  id: string
  client_id: string | null
  tipo: string
  status: string
  data: string
  assignee_id: string
}

interface Props {
  clients: Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]
  producao: ProducaoMensal[]
  profiles: Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]
  pautas: PautaInfo[]
  refMonthStr: string
  currentMonthStr: string
  userRole: string
  currentUserId: string
}

export default function PipelineView({
  clients,
  producao,
  profiles,
  pautas,
  refMonthStr,
}: Props) {
  const router = useRouter()
  const [records, setRecords] = useState<ProducaoMensal[]>(producao)
  const [viewMonth, setViewMonth] = useState(refMonthStr)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => { setRecords(producao) }, [producao])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    router.refresh()
    setLastRefresh(new Date())
    setTimeout(() => setRefreshing(false), 1200)
  }, [router])

  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Index producao_mensal por clientId+etapa
  const recordIndex = useMemo(() => {
    const idx: Record<string, ProducaoMensal> = {}
    records.forEach(r => {
      if (r.mes === viewMonth) idx[`${r.client_id}__${r.etapa}`] = r
    })
    return idx
  }, [records, viewMonth])

  // Index de pautas por clientId+etapaTipo → pauta mais relevante
  const pautaIndex = useMemo(() => {
    const ETAPA_TIPO: Record<string, string> = {
      planejamento: 'planejamento',
      captacao:     'captacao',
      edicao:       'edicao_video',
      design:       'edicao_cards',
      agendamento:  'agendamento',
    }
    const rank: Record<string, number> = { concluido: 3, em_andamento: 2, pendente: 1 }
    const idx: Record<string, PautaInfo> = {}
    for (const pauta of pautas) {
      if (!pauta.client_id || pauta.status === 'cancelado') continue
      // Encontra qual etapa do pipeline este tipo de pauta corresponde
      const etapa = Object.entries(ETAPA_TIPO).find(([, tipo]) => tipo === pauta.tipo)?.[0]
      if (!etapa) continue
      const key = `${pauta.client_id}__${etapa}`
      const existing = idx[key]
      if (!existing || (rank[pauta.status] ?? 0) > (rank[existing.status] ?? 0)) {
        idx[key] = pauta
      }
    }
    return idx
  }, [pautas])

  // Index profiles por id
  const profileById = useMemo(() => {
    const m: Record<string, typeof profiles[0]> = {}
    profiles.forEach(p => { m[p.id] = p })
    return m
  }, [profiles])

  // KPIs
  const kpis = useMemo(() => {
    const clientIds = new Set(clients.map(c => c.id))
    const etapaKeys = new Set(ETAPAS.map(e => e.key))
    const monthRecords = records.filter(r => r.mes === viewMonth && clientIds.has(r.client_id) && etapaKeys.has(r.etapa))
    const totalCells = clients.length * ETAPAS.length
    const concluidos = monthRecords.filter(r => r.status === 'concluido').length
    const emAndamento = monthRecords.filter(r => r.status === 'em_andamento').length
    const bloqueados = monthRecords.filter(r => r.status === 'bloqueado').length
    const atrasados = monthRecords.filter(r => r.status === 'atrasado').length
    const pct = totalCells > 0 ? Math.round((concluidos / totalCells) * 100) : 0
    const clientesConcluidos = clients.filter(c =>
      ETAPAS.every(e => recordIndex[`${c.id}__${e.key}`]?.status === 'concluido')
    ).length
    return { totalCells, concluidos, emAndamento, bloqueados, atrasados, pct, clientesConcluidos }
  }, [records, viewMonth, clients, recordIndex])

  const diasAte25 = daysUntil25()
  const isUrgent = diasAte25 <= 5

  function shiftMonth(delta: number) {
    const d = new Date(viewMonth + 'T12:00:00')
    d.setMonth(d.getMonth() + delta)
    setViewMonth(d.toISOString().split('T')[0])
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── KPI Header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

        <div className="px-6 pt-4 pb-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: 'var(--cream)' }}>Pipeline de Produção</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Status atualizado automaticamente a partir das pautas
            </p>
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
            <button onClick={refresh} disabled={refreshing}
              title={`Atualizado: ${lastRefresh.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {refreshing ? '⏳' : '↻'}
            </button>
            <Link href="/pautas"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
              Ver Pautas →
            </Link>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="px-6 pb-4 flex items-center gap-4 overflow-x-auto">

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

          <div className="w-px h-16 shrink-0" style={{ background: 'var(--border)' }} />

          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{
              fontSize: '1.6rem', fontFamily: 'var(--font-barlow)',
              color: isUrgent ? '#f87171' : 'var(--cream)',
            }}>
              {isUrgent ? '⚠' : '📅'} {diasAte25}d
            </p>
            <p className="label-caps mt-0.5" style={{ color: isUrgent ? '#f87171' : 'var(--text-muted)' }}>
              {isUrgent ? 'urgente · obj. dia 25' : 'até o dia 25'}
            </p>
          </div>

          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#4ade80' }}>
              {kpis.concluidos}
            </p>
            <p className="label-caps mt-0.5">Feitos</p>
          </div>

          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#fbbf24' }}>
              {kpis.emAndamento}
            </p>
            <p className="label-caps mt-0.5">Em curso</p>
          </div>

          <div className="shrink-0 text-center px-3">
            <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: 'var(--text-muted)' }}>
              {kpis.totalCells - kpis.concluidos - kpis.emAndamento - kpis.bloqueados}
            </p>
            <p className="label-caps mt-0.5">Sem pauta</p>
          </div>

          {kpis.atrasados > 0 && (
            <div className="shrink-0 text-center px-3 rounded-lg py-1"
              style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
              <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#ef4444' }}>
                🚨 {kpis.atrasados}
              </p>
              <p className="label-caps mt-0.5" style={{ color: '#ef4444' }}>Atrasados</p>
            </div>
          )}

          {kpis.bloqueados > 0 && (
            <div className="shrink-0 text-center px-3">
              <p className="font-bold" style={{ fontSize: '1.6rem', fontFamily: 'var(--font-barlow)', color: '#f87171' }}>
                {kpis.bloqueados}
              </p>
              <p className="label-caps mt-0.5" style={{ color: '#f87171' }}>Bloqueados</p>
            </div>
          )}

          <div className="w-px h-16 shrink-0" style={{ background: 'var(--border)' }} />

          {/* Círculos por etapa */}
          {ETAPAS.map(e => {
            const concluidos = clients.filter(
              c => recordIndex[`${c.id}__${e.key}`]?.status === 'concluido'
            ).length
            const emAndamento = clients.filter(
              c => recordIndex[`${c.id}__${e.key}`]?.status === 'em_andamento'
            ).length
            const pct = clients.length > 0 ? Math.round((concluidos / clients.length) * 100) : 0
            const color = pct === 100 ? '#4ade80' : pct >= 50 ? '#9FA4DB' : emAndamento > 0 ? '#fbbf24' : 'var(--text-dim)'

            return (
              <div key={e.key} className="shrink-0 flex flex-col items-center gap-1 px-2">
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-2)" strokeWidth="4" />
                    {emAndamento > 0 && (
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke="#fbbf2440"
                        strokeWidth="4"
                        strokeDasharray={`${Math.round((emAndamento / clients.length) * 100)} ${100 - Math.round((emAndamento / clients.length) * 100)}`}
                        strokeLinecap="round" />
                    )}
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
          <table className="w-full border-collapse" style={{ minWidth: 760 }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <th className="px-4 py-3 text-left border-b border-r"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    minWidth: 160,
                    position: 'sticky', left: 0, zIndex: 20,
                  }}>
                  <span className="label-caps">Cliente</span>
                </th>

                {ETAPAS.map(e => (
                  <th key={e.key} className="px-2 py-3 text-center border-b border-r"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 120 }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--cream)' }}>
                      {e.short}
                    </p>
                    <p className="text-xs mt-0.5" style={{
                      color: e.role === 'designer' ? '#2dd4bf80' : '#9FA4DB80',
                      fontSize: '0.6rem',
                    }}>
                      {e.role === 'designer' ? 'Designer' : 'Social Media'}
                    </p>
                  </th>
                ))}

                <th className="px-3 py-3 text-center border-b"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 80 }}>
                  <span className="label-caps">Total</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client, ci) => {
                const clientConcluidos = ETAPAS.filter(
                  e => recordIndex[`${client.id}__${e.key}`]?.status === 'concluido'
                ).length
                const clientPct = Math.round((clientConcluidos / ETAPAS.length) * 100)
                const isComplete = clientConcluidos === ETAPAS.length

                return (
                  <tr key={client.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isComplete ? '#4ade8006' : ci % 2 === 0 ? 'transparent' : '#ffffff03',
                    }}>

                    {/* Nome do cliente */}
                    <td className="px-4 py-2 border-r"
                      style={{
                        borderColor: 'var(--border)',
                        position: 'sticky', left: 0, zIndex: 5,
                        background: isComplete ? '#4ade8008' : 'var(--surface)',
                      }}>
                      <div className="flex items-center gap-2">
                        {isComplete && <span className="text-xs" style={{ color: '#4ade80' }}>✓</span>}
                        <span className="text-sm font-medium truncate max-w-[130px]"
                          style={{ color: isComplete ? '#4ade80' : 'var(--cream)' }}>
                          {client.name}
                        </span>
                      </div>
                    </td>

                    {/* Células de etapa */}
                    {ETAPAS.map(e => {
                      const recKey = `${client.id}__${e.key}`
                      const record = recordIndex[recKey]
                      const st = (record?.status ?? 'pendente') as StatusKey
                      const cfg = STATUS[st]

                      // Pauta correspondente a esta etapa/cliente
                      const pauta = pautaIndex[recKey]
                      const assignee = pauta ? profileById[pauta.assignee_id] : null

                      const isPendente = st === 'pendente'

                      return (
                        <td key={e.key} className="px-2 py-2 text-center border-r"
                          style={{ borderColor: 'var(--border)' }}>

                          {isPendente && e.pautaTipo ? (
                            // Célula vazia — link para criar pauta
                            <Link href="/pautas"
                              title={`Criar pauta de ${e.label} para ${client.name}`}
                              className="group mx-auto flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all hover:border-[#9FA4DB60]"
                              style={{
                                minHeight: 56, padding: '6px 8px',
                                border: '1.5px dashed var(--border)',
                                color: 'var(--text-dim)',
                              }}>
                              <span className="text-xs opacity-30 group-hover:opacity-70 transition-opacity">+</span>
                              <span style={{ fontSize: '0.58rem', opacity: 0 }}
                                className="group-hover:opacity-40 transition-opacity leading-tight text-center">
                                {e.short}
                              </span>
                            </Link>
                          ) : (
                            // Célula com status
                            <div
                              title={record?.notas ?? cfg.label}
                              className={`mx-auto flex flex-col items-center gap-1 rounded-lg transition-all${st === 'atrasado' ? ' animate-pulse' : ''}`}
                              style={{
                                minHeight: 56, padding: '6px 8px',
                                background: cfg.bg,
                                border: `1.5px solid ${cfg.border}`,
                                color: cfg.color,
                                boxShadow: st === 'atrasado' ? '0 0 8px #ef444460' : undefined,
                              }}>
                              {/* Ícone + status */}
                              <span className="text-sm font-bold leading-none">{cfg.icon}</span>

                              {/* Data da pauta */}
                              {pauta && (
                                <span className="leading-none"
                                  style={{ fontSize: '0.6rem', color: cfg.color, opacity: 0.8 }}>
                                  {shortDate(pauta.data)}
                                </span>
                              )}

                              {/* Avatar do responsável */}
                              {assignee && (
                                <div
                                  title={assignee.name}
                                  className="w-4 h-4 rounded-full flex items-center justify-center font-bold"
                                  style={{
                                    background: assignee.avatar_color,
                                    color: '#08080F',
                                    fontSize: '0.45rem',
                                  }}>
                                  {(assignee.name || '?')[0]}
                                </div>
                              )}
                            </div>
                          )}
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
                        <div className="w-12 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'var(--surface-2)' }}>
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
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
              {cfg.icon}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded flex items-center justify-center text-xs"
            style={{ border: '1px dashed var(--border)', color: 'var(--text-dim)' }}>+</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sem pauta — clique para agendar</span>
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
          Passa o cursor sobre uma célula para ver o detalhe
        </span>
      </div>
    </div>
  )
}
