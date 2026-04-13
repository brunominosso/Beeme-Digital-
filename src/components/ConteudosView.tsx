'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post, Client, Profile } from '@/types/database'

type PostFile = { name: string; url: string; type: string; size: number }

function isImage(type: string) { return type.startsWith('image/') }
function isVideo(type: string) { return type.startsWith('video/') }
function fileIcon(type: string) { return isVideo(type) ? '🎬' : isImage(type) ? '🖼️' : '📎' }
function fmtSize(bytes: number) { return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB` }

// ─── constantes ───────────────────────────────────────────────────────────────

const STATUSES = [
  { key: 'nao_iniciado',   label: 'Não iniciado',   color: '#6b7280' },
  { key: 'em_andamento',   label: 'Em andamento',   color: '#3b82f6' },
  { key: 'criar_copy',     label: 'Criar copy',     color: '#8b5cf6' },
  { key: 'fazer_captacao', label: 'Fazer captação', color: '#f59e0b' },
  { key: 'editar_video',   label: 'Editar vídeo',   color: '#ec4899' },
  { key: 'criar_arte',     label: 'Criar arte',     color: '#f97316' },
  { key: 'em_aprovacao',   label: 'Em aprovação',   color: '#eab308' },
  { key: 'publicado',      label: 'Publicado',      color: '#22c55e' },
]
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn']
const FORMATS   = ['Reels/Short', 'Carrossel', 'Imagem única', 'Stories']
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))

function getInitials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
function fmtShort(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) }

// ─── tipos ────────────────────────────────────────────────────────────────────

type SimpleClient  = Pick<Client, 'id' | 'name' | 'responsible_ids'>
type SimpleProfile = Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>

// ─── PostModal ────────────────────────────────────────────────────────────────

const SM_MODAL_STATUSES = [
  { key: 'sm_novo',      label: 'Novo',           color: '#6b7280' },
  { key: 'sm_revisao',   label: 'Em Revisão',     color: '#a855f7' },
  { key: 'sm_aprovacao', label: 'Aprovação',      color: '#22c55e' },
]
const DESIGNER_MODAL_STATUSES = [
  { key: 'design_fila',    label: 'Em Aberto', color: '#6b7280' },
  { key: 'design_fazendo', label: 'Fazendo',   color: '#3b82f6' },
]

function PostModal({ post, clients, profiles, onClose, onSave, userRole }: {
  post: Partial<Post>
  clients: SimpleClient[]
  profiles: SimpleProfile[]
  onClose: () => void
  onSave: (p: Post) => void
  userRole?: string
}) {
  const isNew = !post.id
  const defaultStatus = userRole === 'social_media' ? 'sm_novo' : userRole === 'designer' ? 'design_fila' : 'nao_iniciado'
  const [title,       setTitle]       = useState(post.title ?? '')
  const [status,      setStatus]      = useState(post.status ?? defaultStatus)
  const [clientId,    setClientId]    = useState(post.client_id ?? '')
  const [platform,    setPlatform]    = useState(post.platform ?? '')
  const [format,      setFormat]      = useState(post.format ?? '')
  const [dueDate,     setDueDate]     = useState(post.due_date ?? '')
  const [publishDate, setPublishDate] = useState(post.publish_date ?? '')
  const [assignees,   setAssignees]   = useState<string[]>(post.assignee_ids ?? [])
  const [notes,       setNotes]       = useState(post.notes ?? '')
  const [files,       setFiles]       = useState<PostFile[]>((post.files as PostFile[]) ?? [])
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleAssignee(id: string) {
    setAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return
    setUploading(true)
    const supabase = createClient()
    const postId = post.id ?? `tmp-${Date.now()}`
    const newFiles: PostFile[] = []
    for (const file of picked) {
      const path = `${postId}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const { error } = await supabase.storage.from('post-files').upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('post-files').getPublicUrl(path)
        newFiles.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size })
      }
    }
    setFiles(prev => [...prev, ...newFiles])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload = {
      title, status,
      client_id:    clientId || null,
      platform:     platform || null,
      format:       format || null,
      due_date:     dueDate || null,
      publish_date: publishDate || null,
      assignee_ids: assignees,
      notes:        notes || null,
      files:        files.length > 0 ? files : [],
    }
    let data: Post | null = null
    if (isNew) {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await supabase.from('posts').insert({ ...payload, created_by: user?.id }).select().single()
      data = res.data as Post
    } else {
      const res = await supabase.from('posts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', post.id!).select().single()
      data = res.data as Post
    }
    setSaving(false)
    if (data) { onSave(data); onClose() }
  }

  const inp = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' } as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>{isNew ? 'Novo post' : 'Editar post'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <input type="text" placeholder="Título do post *" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none font-medium" style={inp} autoFocus />

          {/* Status */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(userRole === 'social_media' ? SM_MODAL_STATUSES : userRole === 'designer' ? DESIGNER_MODAL_STATUSES : STATUSES).map(s => (
                <button key={s.key} onClick={() => setStatus(s.key)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{ background: status === s.key ? s.color + '30' : 'var(--surface-2)', color: status === s.key ? s.color : 'var(--text-muted)', border: `1px solid ${status === s.key ? s.color : 'var(--border)'}` }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Cliente</p>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inp}>
              <option value="">Sem cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Plataforma + Formato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Rede social</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setPlatform(platform === p ? '' : p)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: platform === p ? '#22c55e30' : 'var(--surface-2)', color: platform === p ? '#22c55e' : 'var(--text-muted)', border: `1px solid ${platform === p ? '#22c55e' : 'var(--border)'}` }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Formato</p>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map(f => (
                  <button key={f} onClick={() => setFormat(format === f ? '' : f)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: format === f ? '#8b5cf630' : 'var(--surface-2)', color: format === f ? '#8b5cf6' : 'var(--text-muted)', border: `1px solid ${format === f ? '#8b5cf6' : 'var(--border)'}` }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Fazer até', value: dueDate, set: setDueDate },
              { label: 'Publicar até', value: publishDate, set: setPublishDate },
            ].map(d => (
              <div key={d.label}>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{d.label}</p>
                <input type="date" value={d.value} onChange={e => d.set(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={inp} />
              </div>
            ))}
          </div>

          {/* Responsáveis */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Responsáveis</p>
            <div className="flex flex-wrap gap-2">
              {profiles.map(p => (
                <button key={p.id} onClick={() => toggleAssignee(p.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{ background: assignees.includes(p.id) ? (p.avatar_color || '#9FA4DB') + '25' : 'var(--surface-2)', color: assignees.includes(p.id) ? (p.avatar_color || '#9FA4DB') : 'var(--text-muted)', border: `1px solid ${assignees.includes(p.id) ? (p.avatar_color || '#9FA4DB') : 'var(--border)'}` }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: p.avatar_color || '#9FA4DB', color: '#08080F' }}>
                    {getInitials(p.name || '?')}
                  </span>
                  {p.name?.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Notas</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inp}
              placeholder="Observações..." />
          </div>

          {/* Ficheiros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ficheiros ({files.length})</p>
              <button onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: 'var(--surface-2)', color: 'var(--lavanda-light)', border: '1px solid var(--border)' }}>
                {uploading ? '⏳ A carregar...' : '⬆ Carregar ficheiro'}
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
            </div>

            {files.length === 0 ? (
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 rounded-xl border-2 border-dashed text-sm flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <span className="text-2xl">📁</span>
                Arrasta fotos ou vídeos, ou clica para carregar
              </button>
            ) : (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--surface-2)' }}>
                    {isImage(f.type) ? (
                      <img src={f.url} alt={f.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ background: 'var(--surface)' }}>
                        {fileIcon(f.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium" style={{ color: 'var(--cream)' }}>{f.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtSize(f.size)}</p>
                    </div>
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="text-xs px-2 py-1 rounded shrink-0"
                      style={{ color: 'var(--lavanda-light)' }}>
                      Ver
                    </a>
                    <button onClick={() => removeFile(i)} className="text-xs shrink-0"
                      style={{ color: 'var(--text-muted)' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-xs mt-1" style={{ color: 'var(--lavanda-light)' }}>
                  + Adicionar mais
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-2 justify-end" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}>
            {saving ? 'A guardar...' : isNew ? 'Criar post' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PostCard (mini) ──────────────────────────────────────────────────────────

function PostCard({ post, clients, profiles, onClick }: {
  post: Post; clients: SimpleClient[]; profiles: SimpleProfile[]; onClick: () => void
}) {
  const st = STATUS_MAP[post.status] ?? { label: post.status, color: '#6b7280' }
  const client = clients.find(c => c.id === post.client_id)
  const assigneeProfiles = profiles.filter(p => post.assignee_ids?.includes(p.id))

  return (
    <div onClick={onClick} className="rounded-xl p-3 cursor-pointer hover:opacity-90 transition-opacity space-y-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--cream)' }}>{post.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: st.color + '25', color: st.color }}>
          {st.label}
        </span>
        {post.format && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            {post.format}
          </span>
        )}
      </div>
      {client && (
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{client.name}</p>
      )}
      {post.publish_date && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Publicar até {fmtShort(post.publish_date)}</p>
      )}

      {/* Ficheiros */}
      {(() => {
        const postFiles = (post.files as PostFile[] | null) ?? []
        if (!postFiles.length) return null
        const imgs = postFiles.filter(f => isImage(f.type))
        const vids = postFiles.filter(f => isVideo(f.type))
        const others = postFiles.filter(f => !isImage(f.type) && !isVideo(f.type))
        return (
          <div className="space-y-1.5 pt-1" onClick={e => e.stopPropagation()}>
            {/* Grid de imagens */}
            {imgs.length > 0 && (
              <div className={`grid gap-1 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {imgs.slice(0, 4).map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.url} alt={f.name}
                      className="w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ height: imgs.length === 1 ? '140px' : '80px' }}
                      onClick={() => window.open(f.url, '_blank')} />
                    {i === 3 && imgs.length > 4 && (
                      <div className="absolute inset-0 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: 'rgba(0,0,0,0.6)' }}>
                        +{imgs.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Vídeos */}
            {vids.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-lg shrink-0">🎬</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--cream)' }}>{f.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtSize(f.size)}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--lavanda-light)' }}>▶</span>
              </a>
            ))}
            {/* Outros */}
            {others.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="text-base shrink-0">📎</span>
                <p className="text-xs truncate flex-1" style={{ color: 'var(--cream)' }}>{f.name}</p>
              </a>
            ))}
          </div>
        )
      })()}

      {/* Assignees */}
      {assigneeProfiles.length > 0 && (
        <div className="flex gap-1 pt-0.5">
          {assigneeProfiles.map(p => (
            <div key={p.id} className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: p.avatar_color || '#9FA4DB', color: '#08080F' }} title={p.name || ''}>
              {getInitials(p.name || '?')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CalendárioView ───────────────────────────────────────────────────────────

function CalendarioView({ posts, clients, myClients, profiles, onEdit, onNew }: {
  posts: Post[]
  clients: SimpleClient[]
  myClients: SimpleClient[]
  profiles: SimpleProfile[]
  onEdit: (p: Post) => void
  onNew: (date?: string) => void
}) {
  const [cur, setCur] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() } })
  const [clientFilter, setClientFilter] = useState<string>('geral')
  const today = new Date().toISOString().split('T')[0]

  // Posts filtrados por cliente
  const filteredPosts = clientFilter === 'geral'
    ? posts
    : posts.filter(p => p.client_id === clientFilter)

  const firstDay = new Date(cur.year, cur.month, 1)
  const daysInMonth = new Date(cur.year, cur.month + 1, 0).getDate()
  const startDow = firstDay.getDay()
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = firstDay.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  function dateStr(day: number) {
    return `${cur.year}-${String(cur.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function postsByDay(day: number) {
    const ds = dateStr(day)
    return filteredPosts.filter(p => p.publish_date === ds)
  }

  return (
    <div>
      {/* Filtros por cliente */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <button onClick={() => setClientFilter('geral')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
          style={{ background: clientFilter === 'geral' ? 'var(--accent)' : 'var(--surface)', color: clientFilter === 'geral' ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Geral
        </button>
        {myClients.map(c => (
          <button key={c.id} onClick={() => setClientFilter(clientFilter === c.id ? 'geral' : c.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all"
            style={{ background: clientFilter === c.id ? 'var(--accent)' : 'var(--surface)', color: clientFilter === c.id ? 'white' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Nav mês */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold capitalize" style={{ color: 'var(--cream)' }}>{monthLabel}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCur(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() } })}
            className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>‹</button>
          <button onClick={() => { const n = new Date(); setCur({ year: n.getFullYear(), month: n.getMonth() }) }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Hoje</button>
          <button onClick={() => setCur(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() } })}
            className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>›</button>
        </div>
      </div>

      {/* Cabeçalho dias */}
      <div className="grid grid-cols-7 mb-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--border)' }}>
        {cells.map((day, i) => {
          const ds = day ? dateStr(day) : ''
          const isToday = ds === today
          const dayPosts = day ? postsByDay(day) : []
          return (
            <div key={i} onClick={() => day && onNew(ds)}
              className="min-h-24 p-1.5 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: isToday ? '#9FA4DB08' : 'var(--surface)' }}>
              {day && (
                <>
                  <div className="mb-1">
                    <span className="text-xs font-semibold w-6 h-6 inline-flex items-center justify-center rounded-full"
                      style={{ background: isToday ? 'var(--lavanda)' : 'transparent', color: isToday ? '#08080F' : 'var(--text-muted)' }}>
                      {day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map(p => {
                      const st = STATUS_MAP[p.status] ?? { color: '#6b7280' }
                      const clientName = clients.find(c => c.id === p.client_id)?.name ?? ''
                      return (
                        <div key={p.id} onClick={e => { e.stopPropagation(); onEdit(p) }}
                          className="px-1.5 py-1 rounded text-xs leading-tight cursor-pointer hover:opacity-80"
                          style={{ background: st.color + '20', borderLeft: `2px solid ${st.color}` }}>
                          <p className="truncate font-medium" style={{ color: 'var(--cream)' }}>{p.title}</p>
                          {clientName && <p className="truncate" style={{ color: 'var(--text-muted)' }}>{clientName}</p>}
                          {p.format && <span style={{ color: st.color }}>{p.format}</span>}
                        </div>
                      )
                    })}
                    {dayPosts.length > 3 && (
                      <p className="text-xs pl-1" style={{ color: 'var(--text-muted)' }}>+{dayPosts.length - 3}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── KanbanView ───────────────────────────────────────────────────────────────

type KanbanCol = {
  key: string; label: string; color: string
  displayStatuses: string[]; dropStatus: string
  lockCards?: boolean; isDropZone?: boolean
}

const SM_KANBAN_COLS: KanbanCol[] = [
  { key: 'sm_novo',      label: 'Novo',              color: '#6b7280', displayStatuses: ['sm_novo'],                     dropStatus: 'sm_novo' },
  { key: 'com_designer', label: 'Com o Designer',    color: '#f59e0b', displayStatuses: ['design_fila','design_fazendo'], dropStatus: 'design_fila', lockCards: true },
  { key: 'sm_revisao',   label: 'Em Revisão',        color: '#a855f7', displayStatuses: ['sm_revisao'],                  dropStatus: 'sm_revisao' },
  { key: 'sm_aprovacao', label: 'Aprovação',         color: '#22c55e', displayStatuses: ['sm_aprovacao'],                dropStatus: 'sm_aprovacao' },
]

const DESIGNER_KANBAN_COLS: KanbanCol[] = [
  { key: 'design_fila',    label: 'Em Aberto',            color: '#6b7280', displayStatuses: ['design_fila'],    dropStatus: 'design_fila' },
  { key: 'design_fazendo', label: 'Fazendo',              color: '#3b82f6', displayStatuses: ['design_fazendo'], dropStatus: 'design_fazendo' },
  { key: 'design_pronto',  label: 'Enviar à Social Media', color: '#22c55e', displayStatuses: [],               dropStatus: 'sm_revisao', isDropZone: true },
]

function KanbanView({ posts: initialPosts, clients, profiles, onEdit, userRole }: {
  posts: Post[]; clients: SimpleClient[]; profiles: SimpleProfile[]; onEdit: (p: Post) => void; userRole?: string
}) {
  const [posts,    setPosts]    = useState(initialPosts)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const isRoleBoard = userRole === 'social_media' || userRole === 'designer'
  const roleCols: KanbanCol[] | null =
    userRole === 'social_media' ? SM_KANBAN_COLS :
    userRole === 'designer'     ? DESIGNER_KANBAN_COLS :
    null

  async function movePost(postId: string, newStatus: string) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: newStatus } : p))
    const supabase = createClient()
    await supabase.from('posts').update({ status: newStatus }).eq('id', postId)
  }

  // ── Quadro de role (SM / Designer) ──────────────────────────────────────────
  if (roleCols) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {roleCols.map(col => {
          const colPosts = posts.filter(p => col.displayStatuses.includes(p.status))
          const isOver   = dragOver === col.key

          if (col.isDropZone) {
            return (
              <div key={col.key} className="shrink-0 w-64 flex flex-col rounded-xl transition-all"
                style={{ background: isOver ? col.color + '15' : 'transparent', border: `2px dashed ${isOver ? col.color : 'var(--border)'}`, minHeight: '200px' }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => { e.preventDefault(); if (dragging) movePost(dragging, col.dropStatus); setDragging(null); setDragOver(null) }}>
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: col.color + '20' }}>↗</div>
                  <p className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Arrasta aqui para enviar à Social Media</p>
                </div>
              </div>
            )
          }

          return (
            <div key={col.key} className="shrink-0 w-64 flex flex-col rounded-xl transition-all"
              style={{ background: isOver ? col.color + '08' : 'transparent', border: `1px solid ${isOver ? col.color : 'transparent'}`, minHeight: '120px' }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
              onDrop={e => { e.preventDefault(); if (dragging) movePost(dragging, col.dropStatus); setDragging(null); setDragOver(null) }}>
              <div className="flex items-center gap-2 px-1 py-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
                <span className="text-xs ml-auto px-1.5 py-0.5 rounded-full" style={{ background: col.color + '20', color: col.color }}>{colPosts.length}</span>
              </div>
              <div className="space-y-2 flex-1 p-1">
                {colPosts.map(p => (
                  <div key={p.id}
                    draggable={!col.lockCards}
                    onDragStart={!col.lockCards ? () => setDragging(p.id) : undefined}
                    onDragEnd={!col.lockCards ? () => { setDragging(null); setDragOver(null) } : undefined}
                    style={{ opacity: dragging === p.id ? 0.4 : 1, cursor: col.lockCards ? 'default' : 'grab' }}>
                    <PostCard post={p} clients={clients} profiles={profiles} onClick={() => onEdit(p)} />
                  </div>
                ))}
                {isOver && colPosts.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed h-16 flex items-center justify-center text-xs"
                    style={{ borderColor: col.color, color: col.color }}>Largar aqui</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Quadro admin/editor (colunas originais) ──────────────────────────────────
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUSES.map(col => {
        const colPosts = posts.filter(p => p.status === col.key)
        const isOver = dragOver === col.key
        return (
          <div key={col.key} className="shrink-0 w-64 flex flex-col rounded-xl transition-all"
            style={{ background: isOver ? col.color + '08' : 'transparent', border: `1px solid ${isOver ? col.color : 'transparent'}`, minHeight: '120px' }}
            onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
            onDrop={e => { e.preventDefault(); if (dragging) movePost(dragging, col.key); setDragging(null); setDragOver(null) }}>
            <div className="flex items-center gap-2 px-1 py-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
              <span className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</span>
              <span className="text-xs ml-auto px-1.5 py-0.5 rounded-full"
                style={{ background: col.color + '20', color: col.color }}>{colPosts.length}</span>
            </div>
            <div className="space-y-2 flex-1 p-1">
              {colPosts.map(p => (
                <div key={p.id} draggable
                  onDragStart={() => setDragging(p.id)}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  style={{ opacity: dragging === p.id ? 0.4 : 1, cursor: 'grab' }}>
                  <PostCard post={p} clients={clients} profiles={profiles} onClick={() => onEdit(p)} />
                </div>
              ))}
              {isOver && (
                <div className="rounded-xl border-2 border-dashed h-16 flex items-center justify-center text-xs"
                  style={{ borderColor: col.color, color: col.color }}>
                  Largar aqui
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ConteudosView (main) ─────────────────────────────────────────────────────

export default function ConteudosView({ posts: initial, clients, myClients, profiles, currentUserId, currentUserRole, isAdmin }: {
  posts: Post[]
  clients: SimpleClient[]
  myClients: SimpleClient[]
  profiles: SimpleProfile[]
  currentUserId: string
  currentUserRole?: string
  isAdmin?: boolean
}) {
  const [posts,          setPosts]          = useState(initial)
  const [view,           setView]           = useState<'calendario' | 'kanban'>('calendario')
  const [modal,          setModal]          = useState<Partial<Post>>({})
  const [showModal,      setShowModal]      = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState<string>('todos')

  // Posts filtrados por pessoa (só para admin)
  const filteredByPerson = isAdmin && assigneeFilter !== 'todos'
    ? posts.filter(p => p.assignee_ids?.includes(assigneeFilter))
    : posts

  function openNew(date?: string) {
    setModal(date ? { publish_date: date } : {})
    setShowModal(true)
  }

  function openEdit(p: Post) {
    setModal(p)
    setShowModal(true)
  }

  function handleSave(saved: Post) {
    setPosts(prev => {
      const exists = prev.find(p => p.id === saved.id)
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]
    })
  }

  return (
    <div className="p-6 max-w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Conteúdos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{filteredByPerson.length} posts</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro de pessoa — só para admin */}
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
              <button onClick={() => setAssigneeFilter('todos')}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: assigneeFilter === 'todos' ? '#9FA4DB30' : 'transparent', color: assigneeFilter === 'todos' ? '#9FA4DB' : 'var(--text-muted)' }}>
                Todos
              </button>
              {profiles.filter(p => ['social_media', 'designer', 'editor'].includes(p.role)).map(p => (
                <button key={p.id} onClick={() => setAssigneeFilter(assigneeFilter === p.id ? 'todos' : p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{ background: assigneeFilter === p.id ? (p.avatar_color || '#9FA4DB') + '30' : 'transparent', color: assigneeFilter === p.id ? (p.avatar_color || '#9FA4DB') : 'var(--text-muted)' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: p.avatar_color || '#9FA4DB', color: '#08080F' }}>
                    {getInitials(p.name || '?')}
                  </span>
                  {p.name?.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          <div className="flex p-1 rounded-lg gap-1" style={{ background: 'var(--surface)' }}>
            {([['calendario', '📅 Calendário'], ['kanban', '📋 Kanban']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{ background: view === k ? 'var(--accent)' : 'transparent', color: view === k ? 'white' : 'var(--text-muted)' }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => openNew()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: 'var(--accent)' }}>
            + Novo post
          </button>
        </div>
      </div>

      {view === 'calendario' ? (
        <CalendarioView
          posts={filteredByPerson}
          clients={clients}
          myClients={myClients}
          profiles={profiles}
          onEdit={openEdit}
          onNew={openNew}
        />
      ) : (
        <KanbanView posts={filteredByPerson} clients={clients} profiles={profiles} onEdit={openEdit} userRole={currentUserRole} />
      )}

      {showModal && (
        <PostModal
          post={modal}
          clients={clients}
          profiles={profiles}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          userRole={currentUserRole}
        />
      )}
    </div>
  )
}
