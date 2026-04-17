'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Pauta, Client, Profile, ProducaoMensal } from '@/types/database'

// ── Mapeamento pauta → etapa do pipeline ─────────────────────
const PAUTA_TO_PIPELINE: Record<string, string> = {
  planejamento:  'planejamento',
  captacao:      'captacao',
  edicao_video:  'edicao',
  edicao_cards:  'design',
  agendamento:   'agendamento',
}

// ── Tipos ────────────────────────────────────────────────────

type TipoConfig = {
  label: string
  color: string   // bg color (semi-transparent)
  border: string  // border color
  dot: string     // solid dot color
  roles: string[] // quais roles podem ter este tipo
}

const TIPOS: Record<string, TipoConfig> = {
  // ── Social Media ──────────────────────────────────────────
  reuniao_onboarding:  { label: 'Reunião Onboarding',    color: '#4ade8018', border: '#4ade8040', dot: '#4ade80', roles: ['social_media'] },
  reuniao_mensal:      { label: 'Reunião Mensal',         color: '#34d39918', border: '#34d39940', dot: '#34d399', roles: ['social_media'] },
  mapa_mental:         { label: 'Criação Mapa Mental',    color: '#a78bfa18', border: '#a78bfa40', dot: '#a78bfa', roles: ['social_media'] },
  planejamento:        { label: 'Planejamento Mensal',    color: '#9FA4DB18', border: '#9FA4DB40', dot: '#9FA4DB', roles: ['social_media'] },
  roteiro:             { label: 'Roteiro / Briefing',     color: '#60a5fa18', border: '#60a5fa40', dot: '#60a5fa', roles: ['social_media'] },
  captacao:            { label: 'Captação Externa',       color: '#fb923c18', border: '#fb923c40', dot: '#fb923c', roles: ['social_media'] },
  aprovacao:           { label: 'Revisão / Aprovação',    color: '#f4727218', border: '#f4727240', dot: '#f47272', roles: ['social_media'] },
  reuniao_alinhamento: { label: 'Reunião de Alinhamento', color: '#fbbf2418', border: '#fbbf2440', dot: '#fbbf24', roles: ['social_media'] },
  // ── Designer ──────────────────────────────────────────────
  edicao_cards:        { label: 'Edição de Cards',        color: '#2dd4bf18', border: '#2dd4bf40', dot: '#2dd4bf', roles: ['designer'] },
  edicao_video:        { label: 'Edição de Vídeos',       color: '#e879f918', border: '#e879f940', dot: '#e879f9', roles: ['designer'] },
  criacao_logo:        { label: 'Criação de Logomarca',   color: '#f59e0b18', border: '#f59e0b40', dot: '#f59e0b', roles: ['designer'] },
  // ── Ambos ─────────────────────────────────────────────────
  outro:               { label: 'Outro',                  color: '#94a3b818', border: '#94a3b840', dot: '#94a3b8', roles: ['social_media', 'designer'] },
}

const TURNOS = [
  { key: 'manha',    label: 'Manhã' },
  { key: 'tarde',    label: 'Tarde' },
  { key: 'dia_todo', label: 'Dia todo' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendente:     { label: 'Pendente',      color: '#9FA4DB', bg: '#9FA4DB18' },
  em_andamento: { label: 'Em andamento',  color: '#fbbf24', bg: '#fbbf2418' },
  concluido:    { label: 'Concluído',     color: '#4ade80', bg: '#4ade8018' },
  cancelado:    { label: 'Cancelado',     color: '#f87171', bg: '#f8717118' },
}

// ── Helpers ──────────────────────────────────────────────────

function getWeekDays(referenceDate: Date): Date[] {
  const d = new Date(referenceDate)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(d)
    date.setDate(d.getDate() + i)
    return date
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatWeekRange(days: Date[]): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const start = days[0].toLocaleDateString('pt-PT', opts)
  const end = days[4].toLocaleDateString('pt-PT', { ...opts, year: 'numeric' })
  return `${start} – ${end}`
}

// ── Componente principal ──────────────────────────────────────

// Etapas do pipeline com o tipo de pauta correspondente para criar
// auto: true → gerido automaticamente, não aparece no banner de pendências
const PIPELINE_ETAPAS: { key: string; label: string; pautaTipo: string; dot: string }[] = [
  { key: 'planejamento', label: 'Planejamento', pautaTipo: 'planejamento', dot: '#9FA4DB' },
  { key: 'captacao',     label: 'Captação',      pautaTipo: 'captacao',     dot: '#fb923c' },
  { key: 'edicao',       label: 'Edição',        pautaTipo: 'edicao_video', dot: '#e879f9' },
  { key: 'design',       label: 'Design',         pautaTipo: 'edicao_cards', dot: '#2dd4bf' },
  { key: 'agendamento',  label: 'Agendamento',   pautaTipo: 'agendamento',  dot: '#fbbf24' },
]

interface Props {
  initialPautas: Pauta[]
  clients: Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]
  profiles: Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]
  producao?: ProducaoMensal[]
  refMonthStr?: string
  userRole: string
  currentUserId: string
}

export default function PautasView({ initialPautas, clients, profiles, producao: initialProducao = [], refMonthStr, userRole, currentUserId }: Props) {
  const router = useRouter()
  const [pautas, setPautas] = useState<Pauta[]>(initialPautas)
  const [producao, setProducao] = useState<ProducaoMensal[]>(initialProducao)

  const refresh = useCallback(() => router.refresh(), [router])

  // Auto-refresh a cada 60 segundos para ver pautas criadas por outros utilizadores
  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Sincroniza estado local com dados frescos do servidor após cada refresh
  useEffect(() => { setPautas(initialPautas) }, [initialPautas])
  useEffect(() => { setProducao(initialProducao) }, [initialProducao])
  const [weekRef, setWeekRef] = useState<Date>(new Date())
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Pauta | null>(null)
  const [filterRole, setFilterRole] = useState<'todos' | 'social_media' | 'designer'>('todos')

  // Form state
  const [fAssignee, setFAssignee] = useState('')
  const [fClient, setFClient] = useState('')
  const [fTipo, setFTipo] = useState('reuniao_onboarding')
  const [fData, setFData] = useState('')
  const [fTurno, setFTurno] = useState('manha')
  const [fNotas, setFNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Edit state
  const [editStatus, setEditStatus] = useState('')
  const [editNotas, setEditNotas] = useState('')
  const [editTipo, setEditTipo] = useState('')
  const [editData, setEditData] = useState('')
  const [editTurno, setEditTurno] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [editingSave, setEditingSave] = useState(false)

  // Painel de pendências
  const [expandedPendClient, setExpandedPendClient] = useState<string | null>(null)

  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)

  // Pendências do pipeline por cliente
  // Mostra etapas que ainda não estão concluídas (exclui etapas automáticas)
  const pendencias = useMemo(() => {
    return clients
      .map(c => {
        const faltam = PIPELINE_ETAPAS.filter(e => {
          if (e.auto) return false
          const rec = producao.find(r => r.client_id === c.id && r.etapa === e.key)
          if (rec?.status === 'concluido') return false
          // Se já existe pauta activa (pendente ou em andamento) para este tipo, não mostrar
          const hasActivePauta = pautas.some(p =>
            p.client_id === c.id &&
            p.tipo === e.pautaTipo &&
            (p.status === 'pendente' || p.status === 'em_andamento')
          )
          return !hasActivePauta
        })
        return { client: c, faltam }
      })
      .filter(x => x.faltam.length > 0)
  }, [clients, producao, pautas])

  const canCreate = userRole === 'admin' || userRole === 'social_media'
  const canEdit = canCreate  // alias para uso existente no formulário de criação
  const canEditDetail = (p: Pauta | null) =>
    canCreate || (userRole === 'designer' && p?.assignee_id === currentUserId)

  const weekDays = useMemo(() => getWeekDays(weekRef), [weekRef])

  // Colaboradores relevantes (SM + Designer)
  const team = useMemo(() =>
    profiles.filter(p => p.role === 'social_media' || p.role === 'designer'),
    [profiles]
  )

  const filteredTeam = useMemo(() => {
    if (filterRole === 'todos') return team
    return team.filter(p => p.role === filterRole)
  }, [team, filterRole])

  // Index de pautas por data+assignee+turno para render rápido
  const pautaIndex = useMemo(() => {
    const idx: Record<string, Pauta[]> = {}
    pautas.forEach(p => {
      const key = `${p.data}__${p.assignee_id}__${p.turno}`
      if (!idx[key]) idx[key] = []
      idx[key].push(p)
    })
    return idx
  }, [pautas])

  function prevWeek() {
    const d = new Date(weekRef)
    d.setDate(d.getDate() - 7)
    setWeekRef(d)
  }

  function nextWeek() {
    const d = new Date(weekRef)
    d.setDate(d.getDate() + 7)
    setWeekRef(d)
  }

  function goToday() {
    setWeekRef(new Date())
  }

  function openCreate(data?: string, assigneeId?: string, turno?: string) {
    if (!canEdit) return
    setFData(data ?? toDateStr(new Date()))
    setFAssignee(assigneeId ?? (team[0]?.id ?? ''))
    setFTurno(turno ?? 'manha')
    setFClient('')
    setFTipo('roteiro')
    setFNotas('')
    setSaveError('')
    setShowForm(true)
  }

  async function savePauta() {
    if (!fAssignee || !fData || !fTipo) return
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('pautas').insert({
      assignee_id: fAssignee,
      client_id: fClient || null,
      tipo: fTipo,
      data: fData,
      turno: fTurno,
      notas: fNotas || null,
      status: 'pendente',
      created_by: user?.id,
    }).select().single()

    if (error) { setSaveError(error.message); setSaving(false); return }
    if (data) {
      setPautas(prev => [...prev, data as Pauta])
      setShowForm(false)
    }
    setSaving(false)
  }

  async function movePauta(pautaId: string, newData: string, newAssigneeId: string, newTurno: string) {
    const pauta = pautas.find(p => p.id === pautaId)
    if (!pauta || (pauta.data === newData && pauta.assignee_id === newAssigneeId && pauta.turno === newTurno)) return
    setPautas(prev => prev.map(p => p.id === pautaId ? { ...p, data: newData, assignee_id: newAssigneeId, turno: newTurno } : p))
    const supabase = createClient()
    await supabase.from('pautas').update({ data: newData, assignee_id: newAssigneeId, turno: newTurno, updated_at: new Date().toISOString() }).eq('id', pautaId)
  }

  function openDetail(pauta: Pauta) {
    setSelected(pauta)
    setEditStatus(pauta.status)
    setEditNotas(pauta.notas ?? '')
    setEditTipo(pauta.tipo)
    setEditData(pauta.data)
    setEditTurno(pauta.turno)
    setEditClientId(pauta.client_id ?? '')
    setEditAssigneeId(pauta.assignee_id)
  }

  async function saveDetail() {
    if (!selected) return
    setEditingSave(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('pautas').update({
      status: editStatus,
      notas: editNotas || null,
      tipo: editTipo,
      data: editData,
      turno: editTurno,
      client_id: editClientId || null,
      assignee_id: editAssigneeId,
      updated_at: new Date().toISOString(),
    }).eq('id', selected.id)

    // ── Sync automático com o pipeline ──────────────────────
    // Quando marcada como concluída, atualiza a etapa correspondente no pipeline
    if (editStatus === 'concluido' && selected.client_id) {
      const etapa = PAUTA_TO_PIPELINE[selected.tipo]
      if (etapa) {
        // Mês de referência = próximo mês a partir da data da pauta
        const pautaDate = new Date(selected.data + 'T12:00:00')
        const refMonth = new Date(pautaDate.getFullYear(), pautaDate.getMonth() + 1, 1)
        const pautaRefMonth = refMonth.toISOString().split('T')[0]
        const novasNotas = `Auto: pauta "${TIPOS[selected.tipo]?.label ?? selected.tipo}" concluída`

        const { data: upserted } = await supabase.from('producao_mensal').upsert({
          client_id: selected.client_id,
          mes: pautaRefMonth,
          etapa,
          status: 'concluido',
          updated_by: user?.id,
          notas: novasNotas,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'client_id,mes,etapa' }).select().single()

        // Atualiza estado local imediatamente — sem precisar recarregar a página
        if (upserted) {
          setProducao(prev => {
            const idx = prev.findIndex(r => r.client_id === selected.client_id && r.etapa === etapa && r.mes === pautaRefMonth)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = upserted as ProducaoMensal
              return next
            }
            return [...prev, upserted as ProducaoMensal]
          })
        }
      }
    }

    const updated = {
      ...selected,
      status: editStatus as Pauta['status'],
      notas: editNotas || null,
      tipo: editTipo,
      data: editData,
      turno: editTurno,
      client_id: editClientId || null,
      assignee_id: editAssigneeId,
    }
    setPautas(prev => prev.map(p => p.id === selected.id ? updated : p))
    setSelected(updated)
    setEditingSave(false)
  }

  async function deletePauta() {
    if (!selected) return
    const supabase = createClient()
    await supabase.from('pautas').delete().eq('id', selected.id)
    setPautas(prev => prev.filter(p => p.id !== selected.id))
    setSelected(null)
  }

  const todayStr = toDateStr(new Date())
  const weekStrs = weekDays.map(toDateStr)
  const isCurrentWeek = weekStrs.includes(todayStr)

  // ── Contadores para o header ─────────────────────────────────
  const weekPautas = pautas.filter(p => weekStrs.includes(p.data))
  const weekConcluidas = weekPautas.filter(p => p.status === 'concluido').length
  const weekPendentes = weekPautas.filter(p => p.status === 'pendente' || p.status === 'em_andamento').length

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── Painel principal ───────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0 flex items-center gap-4 flex-wrap relative z-20"
          style={{ borderColor: 'var(--border)' }}>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: 'var(--cream)' }}>Pautas da Equipa</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Agenda semanal — Social Media e Designer
            </p>
          </div>

          {/* Stats semana */}
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {weekPautas.length} esta semana
            </span>
            {weekConcluidas > 0 && (
              <span className="px-2.5 py-1 rounded-lg"
                style={{ background: '#4ade8018', color: '#4ade80' }}>
                ✓ {weekConcluidas} concluídas
              </span>
            )}
            {weekPendentes > 0 && (
              <span className="px-2.5 py-1 rounded-lg"
                style={{ background: '#fbbf2418', color: '#fbbf24' }}>
                ◷ {weekPendentes} em aberto
              </span>
            )}
          </div>

          <button onClick={refresh} title="Atualizar"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm shrink-0"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            ↻
          </button>

          {canEdit && (
            <button
              onClick={() => openCreate()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
              style={{ background: 'var(--accent)' }}>
              + Nova pauta
            </button>
          )}
        </div>

        {/* ── Barra de pendências compacta ─────────────────── */}
        {pendencias.length > 0 && (
          <div className="border-b shrink-0 px-6 py-2.5 flex items-center gap-2 flex-wrap"
            style={{ borderColor: 'var(--border)', background: '#fbbf2406' }}>

            <span className="text-xs font-semibold shrink-0" style={{ color: '#fbbf24' }}>
              ⚠ Pipeline:
            </span>

            {pendencias.map(({ client, faltam }) => {
              const isOpen = expandedPendClient === client.id
              const isUrgent = faltam.length >= 4

              return (
                <div key={client.id} className="relative">
                  <button
                    onClick={() => setExpandedPendClient(isOpen ? null : client.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: isUrgent ? '#f8717115' : '#fbbf2412',
                      border: `1px solid ${isUrgent ? '#f87171' : '#fbbf24'}50`,
                      color: isUrgent ? '#f87171' : '#fbbf24',
                    }}>
                    {client.name}
                    <span className="opacity-50 font-normal">{faltam.length}</span>
                    <span className="opacity-40 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Dropdown com etapas */}
                  {isOpen && (
                    <>
                      {/* Overlay para fechar */}
                      <div className="fixed inset-0 z-10"
                        onClick={() => setExpandedPendClient(null)} />
                      <div className="absolute top-full left-0 mt-1.5 z-20 rounded-xl p-2 flex flex-col gap-1"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          minWidth: 180,
                        }}>
                        <p className="text-xs font-semibold px-2 pt-1 pb-1.5 border-b"
                          style={{ color: 'var(--cream)', borderColor: 'var(--border)' }}>
                          {client.name}
                        </p>
                        {faltam.map(e => {
                          const isDesignerEtapa = e.key === 'design' || e.key === 'edicao'
                          const defaultRole = isDesignerEtapa ? 'designer' : 'social_media'
                          const defaultAssignee = profiles.find(p => p.role === defaultRole)?.id ?? ''
                          return (
                            <button
                              key={e.key}
                              onClick={() => {
                                setFClient(client.id)
                                setFTipo(e.pautaTipo)
                                setFAssignee(defaultAssignee)
                                setFData(toDateStr(new Date()))
                                setFTurno('manha')
                                setFNotas('')
                                setSaveError('')
                                setExpandedPendClient(null)
                                setShowForm(true)
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-all hover:opacity-80"
                              style={{ background: e.dot + '15', color: e.dot }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.dot }} />
                              {e.label}
                              <span className="ml-auto opacity-50">+</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Toolbar: navegação semana + filtro role */}
        <div className="px-6 py-3 border-b shrink-0 flex items-center gap-4"
          style={{ borderColor: 'var(--border)' }}>

          {/* Navegação semana */}
          <div className="flex items-center gap-2">
            <button onClick={prevWeek}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              ‹
            </button>
            <span className="text-sm font-medium px-1" style={{ color: 'var(--cream)', minWidth: 160, textAlign: 'center' }}>
              {formatWeekRange(weekDays)}
            </span>
            <button onClick={nextWeek}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              ›
            </button>
            {!isCurrentWeek && (
              <button onClick={goToday}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                Hoje
              </button>
            )}
          </div>

          {/* Filtro por role */}
          <div className="flex gap-1 ml-auto">
            {([
              { key: 'todos', label: 'Todos' },
              { key: 'social_media', label: 'Social Media' },
              { key: 'designer', label: 'Designer' },
            ] as const).map(opt => (
              <button key={opt.key}
                onClick={() => setFilterRole(opt.key)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterRole === opt.key ? 'var(--accent)' : 'var(--surface-2)',
                  color: filterRole === opt.key ? '#08080F' : 'var(--text-muted)',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid semanal */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                {/* Coluna pessoa */}
                <th className="w-36 sticky left-0 z-10 px-3 py-3 text-left border-b border-r"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Equipa
                </th>
                {weekDays.map(day => {
                  const isToday = toDateStr(day) === todayStr
                  const dayLabel = day.toLocaleDateString('pt-PT', { weekday: 'short' })
                  const dayNum = day.getDate()
                  return (
                    <th key={toDateStr(day)}
                      className="px-2 py-3 text-center border-b border-r"
                      style={{
                        borderColor: 'var(--border)',
                        background: isToday ? '#9FA4DB0a' : 'var(--surface)',
                        minWidth: 140,
                      }}>
                      <span className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: isToday ? 'var(--lavanda-light)' : 'var(--text-muted)' }}>
                        {dayLabel}
                      </span>
                      <span className={`ml-1.5 text-sm font-bold ${isToday ? 'px-1.5 py-0.5 rounded-full' : ''}`}
                        style={{
                          color: isToday ? '#08080F' : 'var(--cream)',
                          background: isToday ? 'var(--lavanda)' : 'transparent',
                        }}>
                        {dayNum}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredTeam.map(person => (
                TURNOS.filter(t => t.key !== 'dia_todo').map((turno, ti) => {
                  const isFirstRow = ti === 0
                  return (
                    <tr key={`${person.id}-${turno.key}`}
                      style={{ borderBottom: !isFirstRow ? `1px solid var(--border)` : 'none' }}>

                      {/* Célula da pessoa — só na 1ª linha */}
                      <td className="sticky left-0 z-10 px-3 border-r align-top"
                        style={{
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                          paddingTop: isFirstRow ? 12 : 4,
                          paddingBottom: isFirstRow ? 0 : 12,
                          verticalAlign: isFirstRow ? 'top' : 'bottom',
                          borderBottom: !isFirstRow ? `1px solid var(--border)` : 'none',
                          borderTop: isFirstRow ? `1px solid var(--border)` : 'none',
                        }}>
                        {isFirstRow ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ background: person.avatar_color, color: '#08080F' }}>
                              {(person.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium" style={{ color: 'var(--cream)' }}>
                                {person.name?.split(' ')[0] ?? '—'}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                                {person.role === 'social_media' ? 'Social Media' : 'Designer'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                            {turno.label}
                          </p>
                        )}
                        {isFirstRow && (
                          <p className="text-xs mt-3" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                            {turno.label}
                          </p>
                        )}
                      </td>

                      {/* Células dos dias */}
                      {weekDays.map(day => {
                        const dateStr = toDateStr(day)
                        const isToday = dateStr === todayStr
                        const key = `${dateStr}__${person.id}__${turno.key}`
                        const cellPautas = pautaIndex[key] ?? []

                        // Também busca pautas "dia_todo" para este dia/pessoa
                        const diaKey = `${dateStr}__${person.id}__dia_todo`
                        const diaPautas = isFirstRow ? (pautaIndex[diaKey] ?? []) : []

                        const allCellPautas = [...cellPautas, ...diaPautas]

                        const cellKey = `${dateStr}__${person.id}__${turno.key}`
                        const isDragOver = dragOverCell === cellKey
                        return (
                          <td key={dateStr}
                            className="px-2 py-2 align-top border-r"
                            onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey) }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCell(null) }}
                            onDrop={e => {
                              e.preventDefault()
                              const id = e.dataTransfer.getData('pautaId')
                              if (id) movePauta(id, dateStr, person.id, turno.key)
                              setDraggingId(null); setDragOverCell(null)
                            }}
                            style={{
                              borderColor: 'var(--border)',
                              background: isDragOver ? '#9FA4DB15' : isToday ? '#9FA4DB05' : 'transparent',
                              borderTop: isFirstRow ? `1px solid var(--border)` : 'none',
                              borderBottom: !isFirstRow ? `1px solid var(--border)` : 'none',
                              minHeight: 80,
                              verticalAlign: 'top',
                              outline: isDragOver ? '2px dashed #9FA4DB60' : 'none',
                              outlineOffset: '-2px',
                            }}>

                            <div className="flex flex-col gap-1 min-h-[72px]">
                              {allCellPautas.map(pauta => {
                                const cfg = TIPOS[pauta.tipo] ?? TIPOS.outro
                                const st = STATUS_CONFIG[pauta.status] ?? STATUS_CONFIG.pendente
                                const clientName = clients.find(c => c.id === pauta.client_id)?.name
                                return (
                                  <button key={pauta.id}
                                    onClick={() => openDetail(pauta)}
                                    draggable
                                    onDragStart={e => { e.dataTransfer.setData('pautaId', pauta.id); setDraggingId(pauta.id) }}
                                    onDragEnd={() => { setDraggingId(null); setDragOverCell(null) }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all hover:opacity-90"
                                    style={{ background: cfg.color, border: `1px solid ${cfg.border}`, opacity: draggingId === pauta.id ? 0.4 : 1, cursor: 'grab' }}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ background: cfg.dot }} />
                                      <span className="font-medium truncate" style={{ color: 'var(--cream)' }}>
                                        {cfg.label}
                                      </span>
                                      {pauta.status === 'concluido' && (
                                        <span className="ml-auto text-xs" style={{ color: '#4ade80' }}>✓</span>
                                      )}
                                      {pauta.status === 'em_andamento' && (
                                        <span className="ml-auto text-xs" style={{ color: '#fbbf24' }}>◷</span>
                                      )}
                                    </div>
                                    {clientName && (
                                      <p className="truncate" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                        {clientName}
                                      </p>
                                    )}
                                    {pauta.turno === 'dia_todo' && (
                                      <p style={{ color: 'var(--text-dim)', fontSize: '0.6rem' }}>Dia todo</p>
                                    )}
                                  </button>
                                )
                              })}

                              {/* Botão adicionar */}
                              {canEdit && (
                                <button
                                  onClick={() => openCreate(dateStr, person.id, turno.key)}
                                  className="w-full flex items-center justify-center h-7 rounded-lg text-xs opacity-0 hover:opacity-100 transition-all border border-dashed"
                                  style={{
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-dim)',
                                  }}>
                                  +
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ))}

              {filteredTeam.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center"
                    style={{ color: 'var(--text-muted)' }}>
                    Nenhum colaborador encontrado para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center gap-3 flex-wrap"
          style={{ borderColor: 'var(--border)' }}>
          <span className="label-caps">Tipos:</span>
          {Object.entries(TIPOS).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Painel de detalhe ─────────────────────────────── */}
      {selected && (
        <div className="w-80 border-l flex flex-col shrink-0 overflow-y-auto"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

          <div className="px-5 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>Detalhe da pauta</h2>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>

          <div className="flex-1 px-5 py-5 space-y-5">
            {/* Tipo */}
            <div>
              <p className="label-caps mb-2">Tipo</p>
              {canEditDetail(selected) ? (
                <div className="flex flex-col gap-1">
                  {Object.entries(TIPOS)
                    .filter(([, cfg]) => {
                      const assigneeRole = team.find(p => p.id === editAssigneeId)?.role ?? ''
                      return !assigneeRole || cfg.roles.includes(assigneeRole)
                    })
                    .map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => setEditTipo(key)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-all"
                        style={{
                          background: editTipo === key ? cfg.color : 'var(--surface-2)',
                          border: `1px solid ${editTipo === key ? cfg.border : 'var(--border)'}`,
                          color: editTipo === key ? 'var(--cream)' : 'var(--text-muted)',
                        }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                        {cfg.label}
                      </button>
                    ))}
                </div>
              ) : (() => {
                const cfg = TIPOS[selected.tipo] ?? TIPOS.outro
                return (
                  <div className="px-3 py-2.5 rounded-xl flex items-center gap-2.5"
                    style={{ background: cfg.color, border: `1px solid ${cfg.border}` }}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cfg.dot }} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--cream)' }}>{cfg.label}</span>
                  </div>
                )
              })()}
            </div>

            {/* Info */}
            <div className="space-y-3">
              <div>
                <p className="label-caps mb-1">Colaborador</p>
                {canEditDetail(selected) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {team.map(p => (
                      <button key={p.id}
                        onClick={() => setEditAssigneeId(p.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all"
                        style={{
                          background: editAssigneeId === p.id ? p.avatar_color + '25' : 'var(--surface-2)',
                          border: `1px solid ${editAssigneeId === p.id ? p.avatar_color : 'var(--border)'}`,
                          color: editAssigneeId === p.id ? p.avatar_color : 'var(--text-muted)',
                        }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: editAssigneeId === p.id ? p.avatar_color : 'var(--border)', color: '#08080F' }}>
                          {(p.name || '?')[0].toUpperCase()}
                        </div>
                        {p.name?.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                ) : (() => {
                  const p = profiles.find(x => x.id === selected.assignee_id)
                  return p ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: p.avatar_color, color: '#08080F' }}>
                        {(p.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm" style={{ color: 'var(--cream)' }}>{p.name}</span>
                    </div>
                  ) : <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
                })()}
              </div>

              <div>
                <p className="label-caps mb-1">Data</p>
                {canEditDetail(selected) ? (
                  <input type="date" value={editData} onChange={e => setEditData(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                ) : (
                  <p className="text-sm" style={{ color: 'var(--cream)' }}>
                    {new Date(selected.data + 'T12:00:00').toLocaleDateString('pt-PT', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </p>
                )}
              </div>

              <div>
                <p className="label-caps mb-1">Turno</p>
                {canEditDetail(selected) ? (
                  <div className="flex gap-1.5">
                    {TURNOS.map(t => (
                      <button key={t.key}
                        onClick={() => setEditTurno(t.key)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: editTurno === t.key ? 'var(--accent)' : 'var(--surface-2)',
                          color: editTurno === t.key ? '#08080F' : 'var(--text-muted)',
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--cream)' }}>
                    {TURNOS.find(t => t.key === selected.turno)?.label ?? selected.turno}
                  </p>
                )}
              </div>

              <div>
                <p className="label-caps mb-1">Cliente</p>
                {canEditDetail(selected) ? (
                  <select value={editClientId} onChange={e => setEditClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option value="">Sem cliente</option>
                    {clients.filter(c => c.status === 'ativo').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : selected.client_id ? (
                  <p className="text-sm" style={{ color: 'var(--cream)' }}>
                    {clients.find(c => c.id === selected.client_id)?.name ?? '—'}
                  </p>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Sem cliente</p>
                )}
              </div>
            </div>

            {/* Status */}
            {canEditDetail(selected) ? (
              <div>
                <p className="label-caps mb-2">Status</p>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key}
                      onClick={() => setEditStatus(key)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all"
                      style={{
                        background: editStatus === key ? cfg.bg : 'var(--surface-2)',
                        border: `1px solid ${editStatus === key ? cfg.color + '60' : 'var(--border)'}`,
                        color: editStatus === key ? cfg.color : 'var(--text-muted)',
                      }}>
                      <span className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: editStatus === key ? cfg.color : 'var(--border)' }} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="label-caps mb-1">Status</p>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: STATUS_CONFIG[selected.status]?.bg ?? '#9FA4DB18',
                    color: STATUS_CONFIG[selected.status]?.color ?? '#9FA4DB',
                  }}>
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </span>
              </div>
            )}

            {/* Notas */}
            <div>
              <p className="label-caps mb-2">Notas</p>
              {canEditDetail(selected) ? (
                <textarea
                  value={editNotas}
                  onChange={e => setEditNotas(e.target.value)}
                  rows={4}
                  placeholder="Adiciona notas, detalhes ou link de briefing..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', lineHeight: 1.6 }}
                />
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: selected.notas ? 'var(--text)' : 'var(--text-dim)' }}>
                  {selected.notas || 'Sem notas'}
                </p>
              )}
            </div>
          </div>

          {/* Footer ações */}
          {canEditDetail(selected) && (
            <div className="px-5 py-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
              <button onClick={saveDetail} disabled={editingSave}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent)', color: '#08080F' }}>
                {editingSave ? 'A guardar...' : 'Guardar alterações'}
              </button>
              <button onClick={deletePauta}
                className="w-full py-1.5 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--danger)', background: 'var(--surface-2)' }}>
                Eliminar pauta
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal criar pauta ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Nova pauta</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Cliente */}
              <div>
                <p className="label-caps mb-2">Cliente *</p>
                {(() => {
                  const filteredClients = clients.filter(c => {
                    if (c.status !== 'ativo') return false
                    if (!fAssignee) return true
                    return (c.responsible_ids ?? []).includes(fAssignee)
                  })
                  return (
                    <>
                      <select value={fClient} onChange={e => setFClient(e.target.value)}
                        className={inputClass}
                        style={{ ...inputStyle, borderColor: !fClient ? 'var(--accent)' : 'var(--border)' } as React.CSSProperties}>
                        <option value="">Seleciona o cliente...</option>
                        {filteredClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {fAssignee && filteredClients.length === 0 && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--warning)' }}>
                          Nenhum cliente ativo atribuído a este colaborador.
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Colaborador */}
              <div>
                <p className="label-caps mb-2">Colaborador *</p>
                <div className="flex gap-2 flex-wrap">
                  {team.map(p => (
                    <button key={p.id}
                      onClick={() => setFAssignee(p.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: fAssignee === p.id ? p.avatar_color + '25' : 'var(--surface-2)',
                        border: `1px solid ${fAssignee === p.id ? p.avatar_color : 'var(--border)'}`,
                        color: fAssignee === p.id ? p.avatar_color : 'var(--text-muted)',
                      }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: fAssignee === p.id ? p.avatar_color : 'var(--border)', color: '#08080F' }}>
                        {(p.name || '?')[0].toUpperCase()}
                      </div>
                      {p.name?.split(' ')[0]}
                      <span className="opacity-60">
                        · {p.role === 'social_media' ? 'SM' : 'Design'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <p className="label-caps mb-2">Tipo de trabalho *</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(TIPOS)
                    .filter(([, cfg]) => {
                      if (!fAssignee) return true
                      const assigneeRole = team.find(p => p.id === fAssignee)?.role ?? ''
                      return cfg.roles.includes(assigneeRole)
                    })
                    .map(([key, cfg]) => (
                      <button key={key}
                        onClick={() => setFTipo(key)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all"
                        style={{
                          background: fTipo === key ? cfg.color : 'var(--surface-2)',
                          border: `1px solid ${fTipo === key ? cfg.border : 'var(--border)'}`,
                          color: fTipo === key ? 'var(--cream)' : 'var(--text-muted)',
                        }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
                        {cfg.label}
                      </button>
                    ))
                  }
                </div>
              </div>

              {/* Data */}
              <div>
                <p className="label-caps mb-2">Data *</p>
                <input type="date" value={fData} onChange={e => setFData(e.target.value)}
                  className={inputClass} style={inputStyle} />
              </div>

              {/* Turno */}
              <div>
                <p className="label-caps mb-2">Turno</p>
                <div className="flex gap-2">
                  {TURNOS.map(t => (
                    <button key={t.key}
                      onClick={() => setFTurno(t.key)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: fTurno === t.key ? 'var(--accent)' : 'var(--surface-2)',
                        color: fTurno === t.key ? '#08080F' : 'var(--text-muted)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <p className="label-caps mb-2">Notas (opcional)</p>
                <textarea placeholder="Ex: Roteiro para o Reel de produto, referência no Drive..."
                  value={fNotas} onChange={e => setFNotas(e.target.value)}
                  rows={3} className={inputClass}
                  style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} />
              </div>

              {saveError && (
                <p className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'var(--danger)15', color: 'var(--danger)' }}>
                  Erro: {saveError}
                </p>
              )}

              <button onClick={savePauta}
                disabled={!fAssignee || !fData || !fTipo || !fClient || saving}
                className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent)', color: '#08080F' }}>
                {saving ? 'A criar...' : 'Criar pauta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
