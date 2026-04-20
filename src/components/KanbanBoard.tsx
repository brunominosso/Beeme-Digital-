'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Client, Profile, TaskTemplate } from '@/types/database'

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
  lockCards?: boolean
  noAdd?: boolean
  isDropZone?: boolean
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

// Parses description for interactive checklist items
function parseChecklist(text: string) {
  const lines = text.split(/\r?\n/)
  const items = lines.map(line => {
    const m = line.match(/^-\s*\[([ xX]?)\]\s*(.+)/)
    if (m) return { type: 'check' as const, checked: (m[1] ?? '').toLowerCase() === 'x', text: m[2].trim() }
    return { type: 'text' as const, text: line, checked: false }
  })
  return {
    items,
    hasChecklist: items.some(i => i.type === 'check'),
    total: items.filter(i => i.type === 'check').length,
    done: items.filter(i => i.type === 'check' && i.checked).length,
  }
}


export default function KanbanBoard({
  initialTasks,
  clients,
  profiles,
  userRole = 'gestor',
  currentUserId,
  assignableProfileIds,
  hideAssignee = false,
}: {
  initialTasks: TaskWithRelations[]
  clients: Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]
  profiles: Pick<Profile, 'id' | 'name' | 'avatar_color'>[]
  userRole?: string
  currentUserId?: string
  assignableProfileIds?: string[] | null  // null = sem restrição (admin)
  hideAssignee?: boolean
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
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [saving, setSaving] = useState(false)
  const [showRawDescription, setShowRawDescription] = useState(false)
  const [checklistEditMode, setChecklistEditMode] = useState(false)
  const [taskStyle, setTaskStyle] = useState<'simples' | 'checklist'>('simples')

  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [doneFilterDate, setDoneFilterDate] = useState('')

  // Templates
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateCadenciaAtiva, setTemplateCadenciaAtiva] = useState(false)
  const [templateCadenciaDia, setTemplateCadenciaDia] = useState(1) // 1=Segunda

  const today = new Date().toISOString().split('T')[0]

  // Início da semana atual (segunda-feira)
  const startOfWeek = (() => {
    const d = new Date()
    const day = d.getDay() // 0=Dom
    const diff = day === 0 ? -6 : 1 - day // ajusta para segunda
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  })()

  // Active clients for template checklist
  const activeClients = clients.filter(c =>
    (c.status === 'ativo' || c.status === 'active') &&
    (!currentUserId || (c.responsible_ids as string[] | null)?.includes(currentUserId))
  )

  // Tarefas concluídas para o painel de histórico
  const doneTasks = tasks
    .filter(t => {
      if (t.status !== 'done' && t.status !== 'sm_aprovacao') return false
      if (doneFilterDate) {
        const updatedAt = (t as any).updated_at
        const completedDate = updatedAt ? updatedAt.split('T')[0] : (t.due_date || '')
        return completedDate === doneFilterDate
      }
      return true
    })
    .sort((a, b) => {
      const aDate = (a as any).updated_at || a.due_date || ''
      const bDate = (b as any).updated_at || b.due_date || ''
      return bDate.localeCompare(aDate)
    })

  function getTaskColumn(task: TaskWithRelations): ColConfig | undefined {
    return columns.find(c => c.displayStatuses.includes(task.status))
  }

  function isTaskDraggable(task: TaskWithRelations): boolean {
    return !getTaskColumn(task)?.lockCards
  }

  function buildClientChecklist() {
    return activeClients.map(c => `- [ ] ${c.name}`).join('\n')
  }

  // Profiles disponíveis para atribuição conforme regras do usuário
  const assignableProfiles = assignableProfileIds === null || assignableProfileIds === undefined
    ? profiles
    : profiles.filter(p => assignableProfileIds.includes(p.id))

  // Se o usuário só pode atribuir a si mesmo, auto-preenche
  const autoAssigneeId = assignableProfileIds?.length === 1 ? assignableProfileIds[0] : undefined

  function openNew(colId: string) {
    const col = columns.find(c => c.id === colId)
    setEditTask(null)
    setTitle(''); setDescription(''); setClientId('')
    setAssigneeId(autoAssigneeId ?? '')
    setPriority('medium'); setStartDate(''); setDueDate(''); setDueTime('')
    setStatus(col?.dropStatus ?? defaultStatus)
    setTaskStyle('simples')
    setShowRawDescription(false)
    setChecklistEditMode(false)
    setShowForm(true)
  }

  function openEdit(task: TaskWithRelations) {
    setEditTask(task)
    setTitle(task.title)
    setDescription(task.description || '')
    setClientId(task.client_id || '')
    setAssigneeId(task.assignee_id || '')
    setPriority(task.priority)
    setStartDate((task as any).start_date || '')
    setDueDate(task.due_date || '')
    setDueTime((task as any).due_time || '')
    setStatus(task.status)
    const isChecklist = parseChecklist(task.description || '').hasChecklist
    setTaskStyle(isChecklist ? 'checklist' : 'simples')
    setShowRawDescription(false)
    setChecklistEditMode(false)
    setShowForm(true)
  }

  function switchTaskStyle(style: 'simples' | 'checklist') {
    setTaskStyle(style)
    if (style === 'checklist') {
      const checklist = buildClientChecklist()
      // Preserva texto já existente que não seja checklist, adiciona clientes
      const parsed = parseChecklist(description)
      if (!parsed.hasChecklist) {
        setDescription(description ? `${description}\n${checklist}` : checklist)
      }
      setShowRawDescription(false)
    }
  }

  function toggleDescriptionLine(lineIndex: number) {
    const lines = description.split('\n')
    const line = lines[lineIndex]
    const m = line.match(/^-\s*\[([ xX]?)\]\s*(.+)/)
    if (!m) return
    const wasDone = (m[1] ?? '').toLowerCase() === 'x'
    lines[lineIndex] = `- [${wasDone ? ' ' : 'x'}] ${m[2]}`
    setDescription(lines.join('\n'))
  }

  function removeDescriptionLine(lineIndex: number) {
    const lines = description.split('\n')
    lines.splice(lineIndex, 1)
    setDescription(lines.join('\n'))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      title, description: description || null,
      client_id: clientId || null, assignee_id: assigneeId || autoAssigneeId || null,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      status,
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

  // --- Templates ---
  async function loadTemplates() {
    setLoadingTemplates(true)
    const supabase = createClient()
    const { data } = await supabase.from('task_templates').select('*').order('created_at', { ascending: false })
    setTemplates((data as TaskTemplate[]) ?? [])
    setLoadingTemplates(false)
  }

  async function openTemplates() {
    setShowTemplates(true)
    await loadTemplates()
  }

  async function saveCurrentAsTemplate() {
    if (!newTemplateName.trim()) return
    setSavingTemplate(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Tenta salvar com cadência; se falhar (migration não rodada), salva sem
    let { error } = await supabase.from('task_templates').insert({
      title: newTemplateName.trim(),
      description: description || null,
      priority,
      assignee_id: assigneeId || null,
      created_by: user?.id,
      cadencia_ativa: templateCadenciaAtiva,
      cadencia_dia: templateCadenciaAtiva ? templateCadenciaDia : null,
    })

    if (error) {
      // Tenta sem campos de cadência (migration pode não ter sido rodada)
      const fallback = await supabase.from('task_templates').insert({
        title: newTemplateName.trim(),
        description: description || null,
        priority,
        assignee_id: assigneeId || null,
        created_by: user?.id,
      })
      if (fallback.error) {
        alert(`Erro ao salvar modelo: ${fallback.error.message}`)
        setSavingTemplate(false)
        return
      }
    }

    setNewTemplateName('')
    setTemplateCadenciaAtiva(false)
    setTemplateCadenciaDia(1)
    setSavingTemplate(false)
    await loadTemplates()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminar este modelo?')) return
    const supabase = createClient()
    await supabase.from('task_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function toggleTemplateCadencia(template: TaskTemplate, dia: number) {
    const novaAtiva = !(template.cadencia_ativa)
    const supabase = createClient()
    await supabase.from('task_templates').update({
      cadencia_ativa: novaAtiva,
      cadencia_dia: novaAtiva ? dia : null,
    }).eq('id', template.id)
    setTemplates(prev => prev.map(t =>
      t.id === template.id
        ? { ...t, cadencia_ativa: novaAtiva, cadencia_dia: novaAtiva ? dia : null }
        : t
    ))
  }

  async function updateTemplateDia(id: string, dia: number) {
    const supabase = createClient()
    await supabase.from('task_templates').update({ cadencia_dia: dia }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, cadencia_dia: dia } : t))
  }

  function applyTemplate(template: TaskTemplate) {
    const checklist = activeClients.length > 0
      ? '\n' + activeClients.map(c => `- [ ] ${c.name}`).join('\n')
      : ''
    setEditTask(null)
    setTitle(template.title)
    setDescription((template.description || '') + checklist)
    setClientId('')
    setAssigneeId(template.assignee_id || '')
    setPriority(template.priority)
    setStartDate('')
    setDueDate('')
    setDueTime('')
    setStatus(defaultStatus)
    setTaskStyle('checklist')
    setShowRawDescription(false)
    setShowTemplates(false)
    setShowForm(true)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  const statusOptions = columns
    .filter(c => !c.lockCards && !c.isDropZone && c.displayStatuses.length > 0)
    .flatMap(c => c.displayStatuses.map(s => ({ value: s, label: c.label })))

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
      <div className="px-4 md:px-6 py-3 md:py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white">{boardTitle}</h1>
          <p className="text-xs mt-0.5 hidden md:block" style={{ color: 'var(--text-muted)' }}>{headerStats}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDone(v => !v)}
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: showDone ? 'var(--success)20' : 'var(--surface-2)',
              color: showDone ? 'var(--success)' : 'var(--text-muted)',
              border: `1px solid ${showDone ? 'var(--success)40' : 'var(--border)'}`,
            }}>
            ✓ Concluídas
          </button>
          <button onClick={openTemplates}
            className="px-3 py-2 rounded-lg text-sm font-semibold hidden md:block"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Modelos
          </button>
          {/* Mobile: só ícone */}
          <button onClick={openTemplates}
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            title="Modelos">
            📋
          </button>
          <button onClick={() => openNew(columns[0].id)}
            className="hidden md:flex px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + Nova tarefa
          </button>
        </div>
      </div>

      {/* Filtro de data — desktop only, mobile usa botão compacto */}
      {!showDone && <div className="border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        {/* Desktop */}
        <div className="hidden md:flex px-6 py-3 items-center gap-3">
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
        {/* Mobile — tabs de coluna com scroll horizontal */}
        <div className="md:hidden flex overflow-x-auto gap-0 px-2 py-2" style={{ scrollbarWidth: 'none' }}>
          {columns.filter(c => !c.isDropZone).map((col, i) => {
            const count = tasks.filter(t => col.displayStatuses.includes(t.status)).length
            return (
              <button key={col.id}
                onClick={() => {
                  const board = document.getElementById('kanban-board')
                  const colEl = document.getElementById(`kanban-col-${col.id}`)
                  if (board && colEl) board.scrollTo({ left: colEl.offsetLeft - 12, behavior: 'smooth' })
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: `1px solid var(--border)`,
                  marginRight: '6px',
                }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                {col.label}
                {count > 0 && <span className="text-xs opacity-60">·{count}</span>}
              </button>
            )
          })}
        </div>
      </div>}

      {/* Painel de tarefas concluídas */}
      {showDone && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="text-sm font-semibold text-white">Tarefas concluídas</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Concluídas em:</span>
                <input type="date" value={doneFilterDate} onChange={e => setDoneFilterDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
                {doneFilterDate && (
                  <button onClick={() => setDoneFilterDate('')}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    Limpar ✕
                  </button>
                )}
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {doneTasks.length} {doneTasks.length === 1 ? 'tarefa' : 'tarefas'}
              </span>
            </div>
            {doneTasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-4xl mb-3">✓</div>
                <p className="text-sm font-medium text-white">Nenhuma tarefa concluída</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {doneFilterDate ? 'Sem tarefas concluídas neste dia' : 'As tarefas concluídas aparecerão aqui'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {doneTasks.map(task => {
                  const p = PRIORITY[task.priority as keyof typeof PRIORITY]
                  const updatedAt = (task as any).updated_at
                  const completedDate = updatedAt
                    ? new Date(updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
                    : task.due_date
                    ? new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
                    : ''
                  const checklist = parseChecklist(task.description || '')
                  return (
                    <div key={task.id} className="rounded-lg p-3 flex items-start gap-3"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{task.title}</p>
                        {checklist.hasChecklist && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full" style={{
                                background: 'var(--success)',
                                width: checklist.total > 0 ? `${(checklist.done / checklist.total) * 100}%` : '0%',
                              }} />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{checklist.done}/{checklist.total}</span>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap mt-1">
                          {task.clients && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent)20', color: 'var(--accent)' }}>
                              {task.clients.name}
                            </span>
                          )}
                          {p && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color }}>
                              {p.label}
                            </span>
                          )}
                          {completedDate && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {completedDate}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => openEdit(task)}
                        className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>✎</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Board */}
      {!showDone && (
      <div id="kanban-board" className="kanban-board flex-1 overflow-x-auto p-3 md:p-6">
        <div className="flex gap-3 md:gap-4 h-full min-w-max">
          {columns.map(col => {
            const colTasks = tasks.filter(t => {
              if (!col.displayStatuses.includes(t.status)) return false

              const isDone = t.status === 'done' || t.status === 'sm_aprovacao'

              // Auto-hide concluídas de semanas anteriores — usar updated_at como proxy de conclusão
              if (isDone) {
                const updatedAt = (t as any).updated_at
                const completedDate = updatedAt ? updatedAt.split('T')[0] : (t.due_date || '')
                if (completedDate < startOfWeek) return false
              }

              // Não mostrar tarefas antes da data inicial
              if ((t as any).start_date && (t as any).start_date > today) return false

              if (!filterFrom && !filterTo) return true
              const d = t.due_date || ''
              return (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo)
            })
            const isOver = dragOver === col.id

            if (col.isDropZone) {
              return (
                <div key={col.id} id={`kanban-col-${col.id}`}
                  className="kanban-col w-72 flex flex-col rounded-xl transition-all"
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
              <div key={col.id} id={`kanban-col-${col.id}`}
                className="kanban-col w-72 flex flex-col rounded-xl"
                style={{ background: 'var(--surface)', border: `1px solid ${isOver ? col.color : 'var(--border)'}` }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id); setDragging(null); setDragOver(null) }}>

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
                    const isOverdue = task.due_date && task.due_date < today && !isDone
                    const draggable = isTaskDraggable(task)
                    const checklist = parseChecklist(task.description || '')

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

                        {/* Progresso do checklist (compacto, sem expor os itens) */}
                        {task.description && checklist.hasChecklist && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full transition-all" style={{
                                background: 'var(--accent)',
                                width: checklist.total > 0 ? `${(checklist.done / checklist.total) * 100}%` : '0%',
                              }} />
                            </div>
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {checklist.done}/{checklist.total}
                            </span>
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
                          {/* Datas */}
                          <div className="ml-auto flex items-center gap-1">
                            {(task as any).start_date && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date((task as any).start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                {' →'}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-xs"
                                style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                                {isOverdue ? '⚠ ' : ''}{new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                                {(task as any).due_time && ` ${(task as any).due_time}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

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
      )}

      {/* FAB — mobile only */}
      <button
        onClick={() => openNew(columns[0].id)}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
        style={{ background: 'var(--accent)', color: '#08080F' }}>
        +
      </button>

      {/* Modal de tarefa */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bottom-sheet w-full md:max-w-md rounded-t-2xl md:rounded-xl p-5 md:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Handle bar — mobile */}
            <div className="md:hidden w-10 h-1 rounded-full mx-auto -mt-1 mb-1" style={{ background: 'var(--border)' }} />
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">{editTask ? 'Editar tarefa' : 'Nova tarefa'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Título *" value={title} onChange={e => setTitle(e.target.value)}
              className={inputClass} style={inputStyle} />

            {/* Estilo da tarefa */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Estilo da tarefa</p>
              <div className="flex gap-2">
                <button onClick={() => switchTaskStyle('simples')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: taskStyle === 'simples' ? 'var(--accent)' : 'var(--surface-2)',
                    color: taskStyle === 'simples' ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${taskStyle === 'simples' ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  Simples
                </button>
                <button onClick={() => switchTaskStyle('checklist')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: taskStyle === 'checklist' ? 'var(--accent)' : 'var(--surface-2)',
                    color: taskStyle === 'checklist' ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${taskStyle === 'checklist' ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  ☑ Checklist de clientes
                  {taskStyle === 'checklist' && activeClients.length > 0 && (
                    <span className="ml-1.5 opacity-75">({activeClients.length})</span>
                  )}
                </button>
              </div>
              {taskStyle === 'checklist' && activeClients.length === 0 && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>
                  Nenhum cliente ativo encontrado
                </p>
              )}
            </div>

            {/* Descrição / Checklist interativo */}
            {(() => {
              const parsed = parseChecklist(description)
              if (parsed.hasChecklist && (taskStyle === 'checklist' || !showRawDescription)) {
                return (
                  <div className="rounded-xl p-3 space-y-2" style={{ ...inputStyle }}>
                    {/* Header com progresso */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {parsed.done === parsed.total && parsed.total > 0 ? '✅ Tudo pronto!' : `${parsed.done} de ${parsed.total} concluídos`}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => { setChecklistEditMode(v => !v) }}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ color: checklistEditMode ? 'var(--danger)' : 'var(--text-muted)', background: 'var(--surface)' }}>
                          {checklistEditMode ? 'Concluir edição' : '✎ Editar lista'}
                        </button>
                        <button onClick={() => setShowRawDescription(true)}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}>
                          txt
                        </button>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        background: parsed.done === parsed.total && parsed.total > 0
                          ? '#22c55e'
                          : 'var(--accent)',
                        width: parsed.total > 0 ? `${(parsed.done / parsed.total) * 100}%` : '0%',
                      }} />
                    </div>
                    {/* Itens */}
                    {parsed.items.map((item, i) => {
                      if (item.type === 'text') {
                        return item.text
                          ? <p key={i} className="text-xs py-0.5" style={{ color: 'var(--text-muted)' }}>{item.text}</p>
                          : null
                      }
                      return (
                        <label key={i}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none transition-all"
                          style={{
                            background: item.checked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${item.checked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                          }}>
                          {/* Bolinha */}
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{
                              background: item.checked ? 'var(--accent)' : 'transparent',
                              borderColor: item.checked ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                            }}
                            onClick={() => toggleDescriptionLine(i)}>
                            {item.checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="text-sm flex-1 transition-all duration-200" style={{
                            color: item.checked ? 'var(--text-muted)' : 'var(--text, #fff)',
                            textDecoration: item.checked ? 'line-through' : 'none',
                          }}
                            onClick={() => toggleDescriptionLine(i)}>
                            {item.text}
                          </span>
                          {checklistEditMode && (
                            <button
                              type="button"
                              onClick={e => {
                                e.preventDefault(); e.stopPropagation()
                                if (confirm(`Remover "${item.text}" da lista?`)) removeDescriptionLine(i)
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 text-xs"
                              style={{ color: 'var(--danger)', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}
                              title="Remover da lista">
                              ✕
                            </button>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )
              }
              return (
                <div>
                  <textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)}
                    rows={5} className={`${inputClass} resize-y`} style={{ ...inputStyle, minHeight: '120px' }} />
                  {parseChecklist(description).hasChecklist && (
                    <button onClick={() => setShowRawDescription(false)}
                      className="text-xs mt-1 px-2 py-0.5 rounded"
                      style={{ color: 'var(--accent)' }}>
                      ← Ver checklist
                    </button>
                  )}
                </div>
              )
            })()}

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
                {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!hideAssignee && (
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">Sem responsável</option>
                  {assignableProfiles.map(p => <option key={p.id} value={p.id}>{p.name || 'Utilizador'}</option>)}
                </select>
              )}
            </div>

            {/* Datas */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Período da tarefa</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Data inicial</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Data final</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className={inputClass} style={inputStyle} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Hora (opcional)</label>
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                placeholder="Hora"
                className="w-36 px-3 py-2 rounded-lg text-sm text-white outline-none"
                style={inputStyle} />
            </div>

            {/* Recorrência */}
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white">Recorrência semanal</p>
                  {templateCadenciaAtiva && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Cria automaticamente toda {['domingo','segunda','terça','quarta','quinta','sexta','sábado'][templateCadenciaDia]}
                    </p>
                  )}
                </div>
                <div
                  onClick={() => setTemplateCadenciaAtiva(v => !v)}
                  className="w-8 h-4 rounded-full relative transition-colors shrink-0"
                  style={{ background: templateCadenciaAtiva ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }}>
                  <div className="w-3 h-3 rounded-full absolute top-0.5 transition-all"
                    style={{ background: '#fff', left: templateCadenciaAtiva ? '17px' : '2px' }} />
                </div>
              </div>
              {templateCadenciaAtiva && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Dia da semana</span>
                  <select value={templateCadenciaDia} onChange={e => setTemplateCadenciaDia(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <option value={0}>Domingo</option>
                    <option value={1}>Segunda</option>
                    <option value={2}>Terça</option>
                    <option value={3}>Quarta</option>
                    <option value={4}>Quinta</option>
                    <option value={5}>Sexta</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>
              )}
            </div>

            {/* Salvar como modelo */}
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Salvar como modelo de tarefa</p>
              <div className="flex gap-2">
                <input type="text" placeholder="Nome do modelo" value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <button onClick={saveCurrentAsTemplate} disabled={!newTemplateName.trim() || savingTemplate}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {savingTemplate ? '...' : 'Salvar'}
                </button>
              </div>
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

      {/* Modal de modelos */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bottom-sheet w-full md:max-w-md rounded-t-2xl md:rounded-xl p-5 md:p-6 space-y-4 max-h-[88vh] flex flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="md:hidden w-10 h-1 rounded-full mx-auto -mt-1 mb-1" style={{ background: 'var(--border)' }} />
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-semibold text-white">Modelos de tarefa</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Cria uma tarefa com checklist de todos os clientes ativos
                </p>
              </div>
              <button onClick={() => setShowTemplates(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingTemplates ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>A carregar...</p>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum modelo ainda</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Cria uma tarefa e usa "Salvar como modelo"
                  </p>
                </div>
              ) : (
                templates.map(template => {
                  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
                  const diaAtual = template.cadencia_dia ?? 1
                  return (
                    <div key={template.id} className="rounded-lg p-3 space-y-2"
                      style={{ background: 'var(--surface-2)', border: `1px solid ${template.cadencia_ativa ? 'var(--accent)' : 'var(--border)'}` }}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{template.title}</p>
                            {template.cadencia_ativa && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: 'var(--accent)20', color: 'var(--accent)', border: '1px solid var(--accent)40' }}>
                                toda {DIAS[template.cadencia_dia ?? 1]}
                              </span>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                              {template.description}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Prioridade: {PRIORITY[template.priority as keyof typeof PRIORITY]?.label ?? template.priority}
                            {activeClients.length > 0 && ` · ${activeClients.length} clientes ativos`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => applyTemplate(template)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: 'var(--accent)' }}>
                            Usar
                          </button>
                          <button onClick={() => deleteTemplate(template.id)}
                            className="px-2 py-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--danger)', background: 'var(--surface)' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                      {/* Controle de cadência */}
                      <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div
                            onClick={() => toggleTemplateCadencia(template, diaAtual)}
                            className="w-8 h-4 rounded-full relative transition-colors"
                            style={{ background: template.cadencia_ativa ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }}>
                            <div className="w-3 h-3 rounded-full absolute top-0.5 transition-all"
                              style={{ background: '#fff', left: template.cadencia_ativa ? '17px' : '2px' }} />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cadência semanal</span>
                        </label>
                        {template.cadencia_ativa && (
                          <select
                            value={template.cadencia_dia ?? 1}
                            onChange={e => updateTemplateDia(template.id, Number(e.target.value))}
                            className="px-2 py-0.5 rounded-lg text-xs text-white outline-none"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <option value={0}>Domingo</option>
                            <option value={1}>Segunda</option>
                            <option value={2}>Terça</option>
                            <option value={3}>Quarta</option>
                            <option value={4}>Quinta</option>
                            <option value={5}>Sexta</option>
                            <option value={6}>Sábado</option>
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
