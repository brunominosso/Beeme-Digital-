'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Client, Profile } from '@/types/database'

type TaskWithRelations = Task & {
  clients: { name: string } | null
  profiles: { name: string | null } | null
}

type ColConfig = {
  id: string
  label: string
  color: string
  displayStatuses: string[]
  dropStatus: string
  lockCards?: boolean   // cards shown here não podem ser arrastados
  noAdd?: boolean       // sem botão "+"
  isDropZone?: boolean  // coluna de transição (sem cards permanentes)
}

// Quadro Social Media
const SM_COLUMNS: ColConfig[] = [
  {
    id: 'sm_novo',
    label: 'Novo',
    color: 'var(--accent)',
    displayStatuses: ['sm_novo'],
    dropStatus: 'sm_novo',
  },
  {
    id: 'com_designer',
    label: 'Com o Designer',
    color: '#f59e0b',
    displayStatuses: ['design_fila', 'design_fazendo'],
    dropStatus: 'design_fila',
    lockCards: true,
    noAdd: true,
  },
  {
    id: 'aguardando_cliente',
    label: 'Aguardando Cliente',
    color: '#f59e0b',
    displayStatuses: ['cliente_aprovacao'],
    dropStatus: 'cliente_aprovacao',
    lockCards: true,
    noAdd: true,
  },
  {
    id: 'sm_revisao',
    label: 'Em Revisão',
    color: '#a855f7',
    displayStatuses: ['sm_revisao'],
    dropStatus: 'sm_revisao',
    noAdd: true,
  },
  {
    id: 'sm_aprovacao',
    label: 'Aprovação',
    color: 'var(--success)',
    displayStatuses: ['sm_aprovacao'],
    dropStatus: 'sm_aprovacao',
    noAdd: true,
  },
]

// Quadro Designer
const DESIGNER_COLUMNS: ColConfig[] = [
  {
    id: 'design_fila',
    label: 'Em Aberto',
    color: 'var(--text-muted)',
    displayStatuses: ['design_fila'],
    dropStatus: 'design_fila',
  },
  {
    id: 'design_fazendo',
    label: 'Fazendo',
    color: 'var(--accent)',
    displayStatuses: ['design_fazendo'],
    dropStatus: 'design_fazendo',
  },
  {
    id: 'design_ajuste',
    label: 'Para Ajuste',
    color: '#f97316',
    displayStatuses: ['design_ajuste'],
    dropStatus: 'design_ajuste',
    noAdd: true,
  },
  {
    id: 'enviar_aprovacao',
    label: 'Enviar para Aprovação',
    color: 'var(--success)',
    displayStatuses: [],
    dropStatus: 'cliente_aprovacao',
    noAdd: true,
    isDropZone: true,
  },
]

// Quadro Admin / Gestor
const ADMIN_COLUMNS: ColConfig[] = [
  { id: 'todo',        label: 'A fazer',      color: 'var(--text-muted)', displayStatuses: ['todo'],        dropStatus: 'todo' },
  { id: 'in_progress', label: 'Em progresso', color: 'var(--accent)',     displayStatuses: ['in_progress'], dropStatus: 'in_progress' },
  { id: 'review',      label: 'Revisão',      color: '#f59e0b',           displayStatuses: ['review'],      dropStatus: 'review' },
  { id: 'done',        label: 'Concluído',    color: 'var(--success)',    displayStatuses: ['done'],        dropStatus: 'done' },
]

const PRIORITY = {
  urgent: { label: 'Urgente', color: 'var(--danger)' },
  high:   { label: 'Alta',    color: '#f59e0b' },
  medium: { label: 'Média',   color: 'var(--accent)' },
  low:    { label: 'Baixa',   color: 'var(--text-muted)' },
}

export default function KanbanBoard({
  initialTasks,
  clients,
  profiles,
  userRole = 'gestor',
}: {
  initialTasks: TaskWithRelations[]
  clients: Pick<Client, 'id' | 'name'>[]
  profiles: Pick<Profile, 'id' | 'name' | 'avatar_color'>[]
  userRole?: string
}) {
  const columns: ColConfig[] =
    userRole === 'social_media' ? SM_COLUMNS :
    userRole === 'designer'     ? DESIGNER_COLUMNS :
    ADMIN_COLUMNS

  const defaultStatus = columns[0].dropStatus

  const [tasks, setTasks] = useState(initialTasks)
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<TaskWithRelations | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [saving, setSaving] = useState(false)

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  function getTaskColumn(task: TaskWithRelations): ColConfig | undefined {
    return columns.find(c => c.displayStatuses.includes(task.status))
  }

  function isTaskDraggable(task: TaskWithRelations): boolean {
    return !getTaskColumn(task)?.lockCards
  }

  function openNew(colId: string) {
    const col = columns.find(c => c.id === colId)
    setEditTask(null)
    setTitle(''); setDescription(''); setClientId(''); setAssigneeId('')
    setPriority('medium'); setDueDate(''); setDueTime('')
    setStatus(col?.dropStatus ?? defaultStatus)
    setShowForm(true)
  }

  function openEdit(task: TaskWithRelations) {
    setEditTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setClientId(task.client_id || '')
    setAssigneeId(task.assignee_id || '')
    setPriority(task.priority)
    setDueDate(task.due_date || '')
    setDueTime((task as any).due_time || '')
    setStatus(task.status)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      title, description: description || null,
      client_id: clientId || null, assignee_id: assigneeId || null,
      priority, due_date: dueDate || null, due_time: dueTime || null, status,
    }

    if (editTask) {
      const { data } = await supabase.from('tasks').update(payload).eq('id', editTask.id)
        .select('*, clients(name), profiles!tasks_assignee_id_fkey(name)').single()
      if (data) setTasks(prev => prev.map(t => t.id === editTask.id ? data as TaskWithRelations : t))
    } else {
      const { data } = await supabase.from('tasks').insert({ ...payload, created_by: user?.id })
        .select('*, clients(name), profiles!tasks_assignee_id_fkey(name)').single()
      if (data) setTasks(prev => [...prev, data as TaskWithRelations])
    }

    setSaving(false)
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar esta tarefa?')) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function moveTask(taskId: string, colId: string) {
    const col = columns.find(c => c.id === colId)
    if (!col) return
    const newStatus = col.dropStatus
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  // Status options no modal (excluí lockCards e isDropZone)
  const statusOptions = columns
    .filter(c => !c.lockCards && !c.isDropZone && c.displayStatuses.length > 0)
    .flatMap(c => c.displayStatuses.map(s => ({ value: s, label: c.label })))

  // Stats do header
  const headerStats =
    userRole === 'social_media'
      ? `${tasks.filter(t => ['sm_novo', 'sm_revisao'].includes(t.status)).length} para atender · ${tasks.filter(t => t.status === 'sm_aprovacao').length} aprovadas`
      : userRole === 'designer'
      ? `${tasks.filter(t => t.status === 'design_fila').length} em fila · ${tasks.filter(t => t.status === 'design_fazendo').length} fazendo · ${tasks.filter(t => t.status === 'design_ajuste').length} para ajuste`
      : `${tasks.filter(t => t.status !== 'done').length} abertas · ${tasks.filter(t => t.status === 'done').length} concluídas`

  const boardTitle =
    userRole === 'social_media' ? 'Quadro Social Media' :
    userRole === 'designer'     ? 'Quadro Designer' :
    'Tarefas'

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-white">{boardTitle}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{headerStats}</p>
        </div>
        <button onClick={() => openNew(columns[0].id)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          + Nova tarefa
        </button>
      </div>

      {/* Filtro de data */}
      <div className="px-6 py-3 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Filtrar por data:</span>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo('') }}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Limpar ✕
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {columns.map(col => {
            const colTasks = tasks.filter(t => {
              if (!col.displayStatuses.includes(t.status)) return false
              if (!filterFrom && !filterTo) return true
              const d = t.due_date || ''
              return (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo)
            })
            const isOver = dragOver === col.id

            // Coluna de transição (drop zone apenas)
            if (col.isDropZone) {
              return (
                <div key={col.id}
                  className="w-72 flex flex-col rounded-xl transition-all"
                  style={{
                    background: isOver ? `${col.color}12` : 'transparent',
                    border: `2px dashed ${isOver ? col.color : 'var(--border)'}`,
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                  onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id); setDragging(null); setDragOver(null) }}>
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                      style={{ background: `${col.color}20` }}>
                      ↗
                    </div>
                    <p className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {col.id === 'enviar_aprovacao'
                        ? 'Arrasta aqui para enviar ao cliente para aprovação'
                        : 'Arrasta um card aqui para enviar de volta à Social Media'}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div key={col.id}
                className="w-72 flex flex-col rounded-xl"
                style={{ background: 'var(--surface)', border: `1px solid ${isOver ? col.color : 'var(--border)'}` }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id); setDragging(null); setDragOver(null) }}>

                {/* Cabeçalho da coluna */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {colTasks.length}
                    </span>
                  </div>
                  {!col.noAdd && (
                    <button onClick={() => openNew(col.id)}
                      className="text-lg leading-none transition-colors hover:text-white"
                      style={{ color: 'var(--text-muted)' }}>+</button>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colTasks.map(task => {
                    const p = PRIORITY[task.priority as keyof typeof PRIORITY]
                    const isDone = task.status === 'done' || task.status === 'sm_aprovacao'
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone
                    const draggable = isTaskDraggable(task)
                    return (
                      <div key={task.id}
                        draggable={draggable}
                        onDragStart={draggable ? () => setDragging(task.id) : undefined}
                        onDragEnd={draggable ? () => setDragging(null) : undefined}
                        className={`rounded-lg p-3 transition-opacity ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          opacity: dragging === task.id ? 0.5 : 1,
                        }}>

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-white leading-snug flex-1">{task.title}</p>
                          <button onClick={() => openEdit(task)}
                            className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>✎</button>
                        </div>

                        {task.description && (
                          <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                            {task.description}
                          </p>
                        )}

                        {/* Nota de ajuste do cliente */}
                        {(task as any).approval_notes && (
                          <div className="rounded-lg px-2.5 py-2 mb-2"
                            style={{ background: '#f9731610', border: '1px solid #f9731625' }}>
                            <p className="text-xs font-semibold mb-0.5" style={{ color: '#f97316' }}>
                              💬 Solicitação do cliente
                            </p>
                            <p className="text-xs leading-snug" style={{ color: '#fed7aa' }}>
                              {(task as any).approval_notes}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: `${p.color}20`, color: p.color }}>
                            {p.label}
                          </span>
                          {task.clients && (
                            <span className="text-xs px-1.5 py-0.5 rounded truncate max-w-24"
                              style={{ background: 'var(--accent)20', color: 'var(--accent)' }}>
                              {task.clients.name}
                            </span>
                          )}
                          {col.lockCards && (
                            <span className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                              {task.status === 'design_fazendo' ? '🎨 Fazendo' : '🎨 Em fila'}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs ml-auto"
                              style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                              {(task as any).due_time && ` ${(task as any).due_time}`}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Dica visual quando coluna está vazia e é drop target */}
                  {colTasks.length === 0 && isOver && (
                    <div className="rounded-lg p-4 text-center text-xs border-2 border-dashed"
                      style={{ borderColor: col.color, color: col.color }}>
                      Largar aqui
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de tarefa */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">{editTask ? 'Editar tarefa' : 'Nova tarefa'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)}
              className={inputClass} style={inputStyle} />

            <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className={inputClass} style={inputStyle} />

            <div className="grid grid-cols-2 gap-3">
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass} style={inputStyle}>
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={inputClass} style={inputStyle}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">Sem cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="">Sem responsável</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name || 'Utilizador'}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className={inputClass} style={inputStyle} />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                placeholder="Hora"
                className="w-28 px-3 py-2 rounded-lg text-sm text-white outline-none"
                style={inputStyle} />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!title || saving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
              {editTask && (
                <button onClick={() => { handleDelete(editTask.id); setShowForm(false) }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--danger)', border: '1px solid var(--border)' }}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
