'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Client, Profile, Meeting, Task } from '@/types/database'
import ActivityLogPanel from '@/components/ActivityLogPanel'

function ApprovalLinkRow({ token, clientId, expiresAt: initialExpiresAt }: {
  token: string; clientId: string; expiresAt: string | null
}) {
  const [copied,    setCopied]    = useState(false)
  const [renewing,  setRenewing]  = useState(false)
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/aprovacao/${token}`
    : `/aprovacao/${token}`

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function renewToken() {
    setRenewing(true)
    const newExpiry = new Date()
    newExpiry.setDate(newExpiry.getDate() + 30)
    const supabase = createClient()
    await supabase.from('clients')
      .update({ approval_token_expires_at: newExpiry.toISOString() })
      .eq('id', clientId)
    setExpiresAt(newExpiry.toISOString())
    setRenewing(false)
  }

  return (
    <div className="space-y-2">
      {expiresAt && (
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {isExpired ? '🔒 Link expirado' : `✓ Válido até ${new Date(expiresAt).toLocaleDateString('pt-BR')}`}
          </span>
          <button onClick={renewToken} disabled={renewing}
            className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--lavanda-light)', border: '1px solid var(--border)' }}>
            {renewing ? '...' : '↻ Renovar 30 dias'}
          </button>
        </div>
      )}
      {!expiresAt && (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sem expiração definida</span>
          <button onClick={renewToken} disabled={renewing}
            className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--lavanda-light)', border: '1px solid var(--border)' }}>
            {renewing ? '...' : '+ Definir expiração (30 dias)'}
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 px-3 py-2 rounded-lg text-xs outline-none truncate"
          style={{ background: 'var(--surface-2)', border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--text-muted)' }}
          onClick={e => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={copy}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ background: copied ? 'var(--success)' : 'var(--accent)' }}>
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  em_negociacao: { label: 'Em negociação', color: '#6c63ff' },
  onboarding: { label: 'Onboarding', color: '#f59e0b' },
  ativo: { label: 'Cliente ativo', color: 'var(--success)' },
  lead_perdido: { label: 'Lead perdido', color: 'var(--danger)' },
  inativo: { label: 'Inativo', color: 'var(--text-muted)' },
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--danger)',
  high: '#f59e0b',
  medium: 'var(--accent)',
  low: 'var(--text-muted)',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa',
}

const WEEKDAYS = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
]

const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'A fazer',
  doing: 'Em curso',
  review: 'Em revisão',
  done: 'Concluída',
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const ROLE_LABELS: Record<string, string> = {
  gestor: 'Gestor de Tráfego',
  social_media: 'Social Media',
  designer: 'Designer',
  editor: 'Editor',
  financeiro: 'Financeiro',
  admin: 'Admin',
}

function ResponsiblesRow({
  profiles,
  responsibleIds,
  onToggle,
}: {
  profiles: Profile[]
  responsibleIds: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const assigned = profiles.filter(p => responsibleIds.includes(p.id))
  const available = profiles.filter(p => !responsibleIds.includes(p.id))

  return (
    <div className="flex-1 min-w-0">
      <p className="label-caps mb-2">Responsáveis</p>
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl min-h-[42px] relative"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>

        {/* Chips dos atribuídos */}
        {assigned.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Nenhum responsável</span>
        )}
        {assigned.map(p => (
          <div key={p.id}
            className="flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: p.avatar_color + '22', border: `1px solid ${p.avatar_color}55` }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: p.avatar_color, color: '#08080F' }}>
              {(p.name || '?')[0].toUpperCase()}
            </div>
            <span style={{ color: p.avatar_color }}>{p.name?.split(' ')[0]}</span>
            <button onClick={() => onToggle(p.id)}
              className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity leading-none"
              style={{ color: p.avatar_color }}>×</button>
          </div>
        ))}

        {/* Botão adicionar */}
        <div className="relative">
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: open ? '#9FA4DB20' : 'transparent',
              color: open ? 'var(--lavanda)' : 'var(--text-muted)',
              border: '1px dashed var(--border)',
            }}>
            + Adicionar
          </button>

          {open && (
            <div className="absolute left-0 top-8 z-20 rounded-xl py-1 min-w-[200px] shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {profiles.length === 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Sem perfis na BD — corre o SQL de equipa
                </p>
              )}
              {available.map(p => (
                <button key={p.id}
                  onClick={() => { onToggle(p.id); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:opacity-80 transition-opacity text-left"
                  style={{ color: 'var(--text)' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: p.avatar_color, color: '#08080F' }}>
                    {(p.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{p.name}</p>
                    <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
                      {ROLE_LABELS[p.role] || p.role}
                    </p>
                  </div>
                </button>
              ))}
              {available.length === 0 && profiles.length > 0 && (
                <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Todos já adicionados</p>
              )}
            </div>
          )}
        </div>

        {/* Fechar dropdown ao clicar fora */}
        {open && (
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        )}
      </div>
    </div>
  )
}

export default function ClientDetail({
  client: initialClient,
  profiles,
  meetings: initialMeetings,
  tasks: initialTasks,
}: {
  client: Client
  profiles: Profile[]
  meetings: Meeting[]
  tasks: Task[]
}) {
  const router = useRouter()
  const [client, setClient] = useState(initialClient)
  const [meetings, setMeetings] = useState(initialMeetings)
  const [tasks, setTasks] = useState(initialTasks)
  const [tab, setTab] = useState<'conteudo' | 'tarefas' | 'atividades'>('conteudo')
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)

  // Meeting form
  const [mTitle, setMTitle] = useState('')
  const [mDate, setMDate] = useState('')
  const [mNotes, setMNotes] = useState('')
  const [mSaving, setMSaving] = useState(false)

  // Task form
  const [tTitle, setTTitle] = useState('')
  const [tDescription, setTDescription] = useState('')
  const [tAssignee, setTAssignee] = useState('')
  const [tPriority, setTPriority] = useState('medium')
  const [tMode, setTMode] = useState<'date' | 'recurrence'>('date')
  const [tDate, setTDate] = useState('')
  const [tDays, setTDays] = useState<number[]>([])
  const [tSaving, setTSaving] = useState(false)

  const status = STATUS_MAP[client.status] ?? STATUS_MAP.em_negociacao

  function contractDuration() {
    if (!client.contract_start) return null
    const start = new Date(client.contract_start)
    const end = client.contract_end ? new Date(client.contract_end) : new Date()
    const months = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const years = Math.floor(months / 12)
    const rem = months % 12
    if (years > 0) return `${years} ano${years > 1 ? 's' : ''}${rem > 0 ? `, ${rem} ${rem > 1 ? 'meses' : 'mês'}` : ''}`
    return `${months} ${months !== 1 ? 'meses' : 'mês'}`
  }

  async function updateField(field: string, value: string | number | string[] | null) {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('clients').update({ [field]: value } as any).eq('id', client.id)
    setClient(prev => ({ ...prev, [field]: value }))
  }

  async function toggleResponsible(profileId: string) {
    const current = client.responsible_ids || []
    const updated = current.includes(profileId)
      ? current.filter(id => id !== profileId)
      : [...current, profileId]
    await updateField('responsible_ids', updated)
  }

  async function saveMeeting() {
    if (!mTitle || !mDate) return
    setMSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('meetings').insert({
      client_id: client.id, title: mTitle, date: mDate,
      notes: mNotes || null, status: 'done', created_by: user?.id,
    }).select().single()
    if (data) setMeetings(prev => [data as Meeting, ...prev])
    setMSaving(false); setShowMeetingForm(false)
    setMTitle(''); setMDate(''); setMNotes('')
  }

  async function saveTask() {
    if (!tTitle.trim()) return
    setTSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const recurrence = tMode === 'recurrence' && tDays.length > 0
      ? `weekly:${tDays.sort().join(',')}`
      : null

    const { data } = await supabase.from('tasks').insert({
      title: tTitle,
      description: tDescription || null,
      client_id: client.id,
      assignee_id: tAssignee || null,
      created_by: user?.id,
      priority: tPriority,
      status: 'todo',
      due_date: tMode === 'date' && tDate ? tDate : null,
      recurrence,
      position: 0,
    }).select().single()

    if (data) setTasks(prev => [data as Task, ...prev])
    setTSaving(false); setShowTaskForm(false)
    setTTitle(''); setTDescription(''); setTAssignee(''); setTPriority('medium')
    setTMode('date'); setTDate(''); setTDays([])
  }

  function toggleDay(day: number) {
    setTDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  function formatRecurrence(recurrence: string) {
    const days = recurrence.replace('weekly:', '').split(',').map(Number)
    return 'Repete ' + days.map(d => WEEKDAYS[d]?.label).join(', ')
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  function EditableField({ label, value, field, type = 'text', placeholder }: {
    label: string; value: string | null | undefined; field: string; type?: string; placeholder?: string
  }) {
    const [editing, setEditing] = useState(false)
    const [val, setVal] = useState(value || '')
    return (
      <div className="flex items-start gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm w-40 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {editing ? (
          <div className="flex-1 flex gap-2">
            <input type={type} value={val} onChange={e => setVal(e.target.value)}
              className="flex-1 px-2 py-1 rounded text-sm text-white outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { updateField(field, val || null); setEditing(false) } if (e.key === 'Escape') setEditing(false) }} />
            <button onClick={() => { updateField(field, val || null); setEditing(false) }}
              className="text-xs px-2 py-1 rounded" style={{ background: 'var(--success)', color: 'white' }}>✓</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm hover:opacity-70 transition-opacity"
            style={{ color: val ? 'white' : 'var(--text-muted)' }}>
            {val || placeholder || 'Vazio'}
          </button>
        )}
      </div>
    )
  }

  function TextareaField({ label, value, field, placeholder }: {
    label: string; value: string | null | undefined; field: string; placeholder?: string
  }) {
    const [val, setVal] = useState(value || '')
    return (
      <div>
        <p className="text-sm font-semibold text-white mb-2">{label}</p>
        <textarea value={val} onChange={e => setVal(e.target.value)}
          onBlur={() => updateField(field, val || null)}
          rows={4} placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      </div>
    )
  }

  const openTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-8 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href="/leads" className="text-xs mb-3 inline-block" style={{ color: 'var(--text-muted)' }}>← Leads & Clientes</Link>
        <div className="flex items-start gap-5">
          {/* Logo */}
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-xl font-bold"
            style={{ background: client.logo_url ? 'transparent' : 'var(--lavanda)', color: '#08080F' }}>
            {client.logo_url
              ? <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
              : getInitials(client.name)}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Nome + status */}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>{client.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <select
                  value={client.status}
                  onChange={e => updateField('status', e.target.value)}
                  className="text-xs px-2.5 py-1 rounded-full font-medium outline-none cursor-pointer"
                  style={{ background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k} style={{ background: 'var(--surface)', color: 'white' }}>{v.label}</option>
                  ))}
                </select>
                {client.city && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>📍 {client.city}</span>}
                {client.instagram && (
                  <a href={`https://instagram.com/${client.instagram}`} target="_blank" rel="noreferrer"
                    className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    @{client.instagram}
                  </a>
                )}
              </div>
            </div>

            {/* Responsáveis — linha com chips */}
            <ResponsiblesRow
              profiles={profiles}
              responsibleIds={client.responsible_ids || []}
              onToggle={toggleResponsible}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b flex gap-6" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'conteudo', label: 'Conteúdo' },
          { key: 'tarefas', label: `Tarefas${openTasks.length > 0 ? ` (${openTasks.length})` : ''}` },
          { key: 'atividades', label: 'Atividades' },
        ] as { key: 'conteudo' | 'tarefas' | 'atividades'; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="py-3 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? 'white' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl">

        {/* CONTEÚDO TAB */}
        {tab === 'conteudo' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>DADOS DE CADASTRO</h2>
              <div className="rounded-xl px-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <EditableField label="📞 Telefone" value={client.phone} field="phone" placeholder="Vazio" />
                <EditableField label="📍 Cidade" value={client.city} field="city" placeholder="Vazio" />
                <EditableField label="✉️ Email" value={client.email} field="email" type="email" placeholder="Vazio" />
                <EditableField label="📸 Instagram" value={client.instagram} field="instagram" placeholder="Vazio" />
                <EditableField label="🪪 CPF / CNPJ" value={client.cnpj} field="cnpj" placeholder="Vazio" />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>DADOS DE CONTRATO</h2>
              <div className="rounded-xl px-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <EditableField label="📅 Início do Contrato" value={client.contract_start} field="contract_start" type="date" placeholder="Vazio" />
                <div className="flex items-center gap-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm w-40 shrink-0" style={{ color: 'var(--text-muted)' }}>⏱ Tempo de contrato</span>
                  <span className="text-sm" style={{ color: contractDuration() ? 'var(--success)' : 'var(--text-muted)' }}>
                    {contractDuration() || 'Vazio'}
                  </span>
                </div>
                <EditableField label="💳 Dia de Pagamento" value={client.payment_day?.toString()} field="payment_day" placeholder="Vazio" />
                <EditableField label="📅 Data Fim" value={client.contract_end} field="contract_end" type="date" placeholder="Vazio" />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>INFORMAÇÕES</h2>
              <div className="rounded-xl px-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <EditableField label="🖼 Logo (URL)" value={client.logo_url} field="logo_url" placeholder="Vazio" />
                <EditableField label="📁 Link Drive" value={client.drive_link} field="drive_link" placeholder="Vazio" />
              </div>
            </div>

            {/* Link de aprovação */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>LINK DE APROVAÇÃO DO CLIENTE</h2>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Partilhe este link com o cliente. Sempre que um card for enviado para aprovação, ele aparecerá aqui automaticamente.
              </p>
              {client.approval_token
                ? <ApprovalLinkRow
                    token={client.approval_token}
                    clientId={client.id}
                    expiresAt={client.approval_token_expires_at ?? null}
                  />
                : <p className="text-xs" style={{ color: 'var(--danger)' }}>Token não gerado — corre o SQL de migração (schema-v12-approval.sql).</p>
              }
            </div>

            {/* Histórico de atividades */}
            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>HISTÓRICO DE ATIVIDADES</h2>
              <ActivityLogPanel clientId={client.id} />
            </div>

            <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <TextareaField label="Contexto geral" value={client.context} field="context"
                placeholder="Escreve aqui o contexto geral deste cliente/lead de acordo com o que vais percebendo em cada interação..." />
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>INFORMAÇÕES ÚTEIS</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '🔐 Senhas de acesso', field: 'passwords', placeholder: 'Insere aqui todas as senhas de acesso fornecidas pelo cliente.', sensitive: true },
                  { label: '😟 Pontos de dor', field: 'pain_points', placeholder: 'Lista aqui os pontos de dor deste cliente.', sensitive: false },
                  { label: '🏪 Principais concorrentes', field: 'competitors', placeholder: 'Lista aqui os principais concorrentes deste cliente.', sensitive: false },
                  { label: '🎯 Expectativas', field: 'expectations', placeholder: 'Anota as expectativas do cliente com relação ao teu serviço.', sensitive: false },
                ].map(card => {
                  const fieldValue = client[card.field as keyof Client] as string | null
                  const [val, setVal] = useState(fieldValue || '')
                  const [revealed, setRevealed] = useState(false)
                  return (
                    <div key={card.field} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{card.label}</p>
                        {card.sensitive && val && (
                          <button
                            type="button"
                            onClick={() => setRevealed(r => !r)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          >
                            {revealed ? 'Ocultar' : 'Revelar'}
                          </button>
                        )}
                      </div>
                      <textarea value={val} onChange={e => setVal(e.target.value)}
                        onBlur={() => updateField(card.field, val || null)}
                        rows={4} placeholder={card.placeholder}
                        className="w-full text-xs outline-none resize-none"
                        style={{
                          background: 'transparent',
                          color: val ? 'var(--text)' : 'var(--text-muted)',
                          ...(card.sensitive && val && !revealed ? {
                            WebkitTextSecurity: 'disc',
                            textSecurity: 'disc',
                            letterSpacing: '0.15em',
                          } as React.CSSProperties : {}),
                        }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAREFAS TAB */}
        {tab === 'tarefas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">Tarefas do cliente</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {openTasks.length} abertas · {doneTasks.length} concluídas
                </p>
              </div>
              <button onClick={() => setShowTaskForm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                style={{ background: 'var(--accent)' }}>
                + Nova tarefa
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-3xl mb-2">📋</p>
                <p className="font-medium text-white">Sem tarefas para este cliente</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cria a primeira tarefa para organizar o trabalho</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const assignee = profiles.find(p => p.id === task.assignee_id)
                  const isRecurring = !!task.recurrence
                  return (
                    <div key={task.id}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: task.status === 'done' ? 0.55 : 1 }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                        style={{
                          borderColor: task.status === 'done' ? 'var(--success)' : PRIORITY_COLOR[task.priority],
                          background: task.status === 'done' ? 'var(--success)' : 'transparent',
                        }}>
                        {task.status === 'done' && <span className="text-white text-xs">✓</span>}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white" style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: PRIORITY_COLOR[task.priority] + '20', color: PRIORITY_COLOR[task.priority] }}>
                            {PRIORITY_LABEL[task.priority]}
                          </span>
                          {isRecurring ? (
                            <span className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                              🔁 {formatRecurrence(task.recurrence!)}
                            </span>
                          ) : task.due_date ? (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                              📅 {new Date(task.due_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                            </span>
                          ) : null}
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {TASK_STATUS_LABEL[task.status]}
                          </span>
                        </div>
                      </div>

                      {assignee && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          title={assignee.name || ''}
                          style={{ background: assignee.avatar_color }}>
                          {(assignee.name || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ATIVIDADES TAB */}
        {tab === 'atividades' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Reuniões & Atividades</h2>
              <button onClick={() => setShowMeetingForm(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}>
                + Registar reunião
              </button>
            </div>
            {!meetings.length ? (
              <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-3xl mb-2">📋</p>
                <p className="font-medium text-white">Nenhuma atividade registada</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Regista reuniões e atas aqui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map(m => (
                  <div key={m.id} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white">{m.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {new Date(m.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--success)20', color: 'var(--success)' }}>
                        Realizada
                      </span>
                    </div>
                    {m.notes && (
                      <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                        {m.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meeting modal */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Registar reunião</h2>
              <button onClick={() => setShowMeetingForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <input type="text" placeholder="Título da reunião *" value={mTitle} onChange={e => setMTitle(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />
            <input type="datetime-local" value={mDate} onChange={e => setMDate(e.target.value)}
              className={inputClass} style={inputStyle} />
            <textarea placeholder="Ata da reunião — o que foi discutido, decisões tomadas, próximos passos..."
              value={mNotes} onChange={e => setMNotes(e.target.value)}
              rows={6} className={inputClass} style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} />
            <button onClick={saveMeeting} disabled={!mTitle || !mDate || mSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {mSaving ? 'A guardar...' : 'Guardar reunião'}
            </button>
          </div>
        </div>
      )}

      {/* Task modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Nova tarefa — {client.name}</h2>
              <button onClick={() => setShowTaskForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Título da tarefa *" value={tTitle} onChange={e => setTTitle(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />

            <input type="text" placeholder="Descrição (opcional)" value={tDescription} onChange={e => setTDescription(e.target.value)}
              className={inputClass} style={inputStyle} />

            <div className="grid grid-cols-2 gap-3">
              {/* Assignee */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Atribuir a</p>
                <select value={tAssignee} onChange={e => setTAssignee(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="" style={{ background: 'var(--surface)' }}>Sem atribuição</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id} style={{ background: 'var(--surface)' }}>
                      {p.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Prioridade</p>
                <select value={tPriority} onChange={e => setTPriority(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="low" style={{ background: 'var(--surface)' }}>Baixa</option>
                  <option value="medium" style={{ background: 'var(--surface)' }}>Média</option>
                  <option value="high" style={{ background: 'var(--surface)' }}>Alta</option>
                  <option value="urgent" style={{ background: 'var(--surface)' }}>Urgente</option>
                </select>
              </div>
            </div>

            {/* Mode selector */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Agendamento</p>
              <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <button onClick={() => setTMode('date')}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ background: tMode === 'date' ? 'var(--accent)' : 'transparent', color: tMode === 'date' ? 'white' : 'var(--text-muted)' }}>
                  📅 Data específica
                </button>
                <button onClick={() => setTMode('recurrence')}
                  className="flex-1 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{ background: tMode === 'recurrence' ? 'var(--accent)' : 'transparent', color: tMode === 'recurrence' ? 'white' : 'var(--text-muted)' }}>
                  🔁 Repetir
                </button>
              </div>
            </div>

            {tMode === 'date' && (
              <input type="date" value={tDate} onChange={e => setTDate(e.target.value)}
                className={inputClass} style={inputStyle} />
            )}

            {tMode === 'recurrence' && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Repetir todos os</p>
                <div className="flex gap-2">
                  {WEEKDAYS.map(day => (
                    <button key={day.value} onClick={() => toggleDay(day.value)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        background: tDays.includes(day.value) ? 'var(--accent)' : 'var(--surface-2)',
                        color: tDays.includes(day.value) ? 'white' : 'var(--text-muted)',
                        border: `1px solid ${tDays.includes(day.value) ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                      {day.label}
                    </button>
                  ))}
                </div>
                {tDays.length > 0 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                    Repete toda {tDays.map(d => WEEKDAYS[d]?.label).join(', ')}
                  </p>
                )}
              </div>
            )}

            <button onClick={saveTask}
              disabled={!tTitle.trim() || (tMode === 'recurrence' && tDays.length === 0) || tSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {tSaving ? 'A criar...' : 'Criar tarefa'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
