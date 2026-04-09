'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Client, Profile } from '@/types/database'

type TaskWithRelations = Task & {
  clients: { name: string } | null
  profiles: { name: string | null } | null
}

const COLUMNS = [
  { id: 'todo', label: 'A fazer', color: 'var(--text-muted)' },
  { id: 'in_progress', label: 'Em progresso', color: 'var(--accent)' },
  { id: 'review', label: 'Revisão', color: '#f59e0b' },
  { id: 'done', label: 'Concluído', color: 'var(--success)' },
]

const PRIORITY = {
  urgent: { label: 'Urgente', color: 'var(--danger)' },
  high: { label: 'Alta', color: '#f59e0b' },
  medium: { label: 'Média', color: 'var(--accent)' },
  low: { label: 'Baixa', color: 'var(--text-muted)' },
}

export default function KanbanBoard({
  initialTasks,
  clients,
  profiles,
}: {
  initialTasks: TaskWithRelations[]
  clients: Pick<Client, 'id' | 'name'>[]
  profiles: Pick<Profile, 'id' | 'name' | 'avatar_color'>[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState<TaskWithRelations | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('todo')
  const [saving, setSaving] = useState(false)

  function openNew(col: string) {
    setEditTask(null)
    setTitle(''); setDescription(''); setClientId(''); setAssigneeId('')
    setPriority('medium'); setDueDate(''); setStatus(col)
    setShowForm(true)
  }

  function openEdit(task: TaskWithRelations) {
    setEditTask(task)
    setTitle(task.title); setDescription(task.description || '')
    setClientId(task.client_id || ''); setAssigneeId(task.assignee_id || '')
    setPriority(task.priority); setDueDate(task.due_date || ''); setStatus(task.status)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      title, description: description || null,
      client_id: clientId || null, assignee_id: assigneeId || null,
      priority, due_date: dueDate || null, status,
    }

    if (editTask) {
      const { data } = await supabase.from('tasks').update(payload).eq('id', editTask.id).select('*, clients(name), profiles!tasks_assignee_id_fkey(name)').single()
      if (data) setTasks(prev => prev.map(t => t.id === editTask.id ? data as TaskWithRelations : t))
    } else {
      const { data } = await supabase.from('tasks').insert({ ...payload, created_by: user?.id }).select('*, clients(name), profiles!tasks_assignee_id_fkey(name)').single()
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

  async function moveTask(taskId: string, newStatus: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const supabase = createClient()
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-white">Tarefas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {tasks.filter(t => t.status !== 'done').length} abertas · {tasks.filter(t => t.status === 'done').length} concluídas
          </p>
        </div>
        <button onClick={() => openNew('todo')}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          + Nova tarefa
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id)
            const isOver = dragOver === col.id
            return (
              <div key={col.id}
                className="w-72 flex flex-col rounded-xl"
                style={{ background: 'var(--surface)', border: `1px solid ${isOver ? col.color : 'var(--border)'}` }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id); setDragging(null); setDragOver(null) }}>

                {/* Column header */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <button onClick={() => openNew(col.id)}
                    className="text-lg leading-none transition-colors hover:text-white"
                    style={{ color: 'var(--text-muted)' }}>+</button>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colTasks.map(task => {
                    const p = PRIORITY[task.priority as keyof typeof PRIORITY]
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                    return (
                      <div key={task.id}
                        draggable
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => setDragging(null)}
                        className="rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: dragging === task.id ? 0.5 : 1 }}>

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-white leading-snug flex-1">{task.title}</p>
                          <button onClick={() => openEdit(task)}
                            className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>✎</button>
                        </div>

                        {task.description && (
                          <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${p.color}20`, color: p.color }}>
                            {p.label}
                          </span>
                          {task.clients && (
                            <span className="text-xs px-1.5 py-0.5 rounded truncate max-w-24"
                              style={{ background: 'var(--accent)20', color: 'var(--accent)' }}>
                              {task.clients.name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs ml-auto" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task modal */}
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
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
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

            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className={inputClass} style={inputStyle} />

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
