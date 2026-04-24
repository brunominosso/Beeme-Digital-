'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

type PostFile = { name: string; url: string; type: string; size: number }

type ApprovalTask = {
  id: string
  title: string
  description: string | null
  caption: string | null
  platform: string | null
  format: string | null
  due_date: string | null
  publish_date: string | null
  approval_notes: string | null
  files: PostFile[]
  platformLabel: string
  formatLabel: string
}

type CardState =
  | { type: 'idle' }
  | { type: 'adjusting'; notes: string }
  | { type: 'loading' }
  | { type: 'done'; action: 'approve' | 'adjust' }

const PLATFORM_ICON: Record<string, string> = {
  instagram: '📸', tiktok: '🎵', youtube: '▶️', linkedin: '💼',
}

function fmtSize(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`
}

function isImage(type: string) { return type.startsWith('image/') }
function isVideo(type: string) { return type.startsWith('video/') }
function isLink(type: string)  { return type.startsWith('link/') }

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const swipedRef    = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || urls.length <= 1) return

    let startX = 0
    let startY = 0

    function onStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    function onEnd(e: TouchEvent) {
      const dx = startX - e.changedTouches[0].clientX
      const dy = startY - e.changedTouches[0].clientY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        swipedRef.current = true
        setIdx(i => dx > 0 ? (i + 1) % urls.length : (i - 1 + urls.length) % urls.length)
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend',   onEnd)
    }
  }, [urls.length])

  function handleOverlayClick() {
    if (swipedRef.current) { swipedRef.current = false; return }
    onClose()
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.93)' }}
      onClick={handleOverlayClick}>
      <button
        className="absolute top-4 right-4 text-white text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.15)' }}
        onClick={e => { e.stopPropagation(); onClose() }}>✕</button>

      {urls.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white w-10 h-10 flex items-center justify-center rounded-full text-xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + urls.length) % urls.length) }}>‹</button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white w-10 h-10 flex items-center justify-center rounded-full text-xl"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % urls.length) }}>›</button>
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </div>
        </>
      )}

      <img
        src={urls[idx]}
        alt=""
        className="max-w-full max-h-full rounded-xl object-contain"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── ImageCarousel ─────────────────────────────────────────────────────────────
function ImageCarousel({ imgs, onOpen }: { imgs: PostFile[]; onOpen: (idx: number) => void }) {
  const [idx, setIdx] = useState(0)
  const containerRef  = useRef<HTMLDivElement>(null)
  const swipedRef     = useRef(false)
  const startXRef     = useRef(0)
  const startYRef     = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el || imgs.length <= 1) return

    function onTouchStart(e: TouchEvent) {
      startXRef.current = e.touches[0].clientX
      startYRef.current = e.touches[0].clientY
      swipedRef.current = false
    }
    function onTouchEnd(e: TouchEvent) {
      const dx = startXRef.current - e.changedTouches[0].clientX
      const dy = startYRef.current - e.changedTouches[0].clientY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
        swipedRef.current = true
        if (dx > 0) setIdx(i => Math.min(i + 1, imgs.length - 1))
        else        setIdx(i => Math.max(i - 1, 0))
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [imgs.length])

  const slideW = 100 / imgs.length

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden" style={{ height: '240px' }}>
      {/* Track deslizante */}
      <div
        className="flex h-full"
        style={{
          width: `${imgs.length * 100}%`,
          transform: `translateX(-${idx * slideW}%)`,
          transition: 'transform 0.28s ease',
        }}
      >
        {imgs.map((f, i) => (
          <div
            key={i}
            className="h-full flex-shrink-0 cursor-pointer"
            style={{ width: `${slideW}%` }}
            onClick={() => { if (!swipedRef.current) onOpen(i) }}
          >
            <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {imgs.length > 1 && (
        <>
          {/* Setas */}
          {idx > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-white text-xl"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              onClick={() => setIdx(i => i - 1)}>
              ‹
            </button>
          )}
          {idx < imgs.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-white text-xl"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              onClick={() => setIdx(i => i + 1)}>
              ›
            </button>
          )}

          {/* Contador */}
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            {idx + 1}/{imgs.length}
          </div>

          {/* Dots */}
          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── FileGrid ──────────────────────────────────────────────────────────────────
function FileGrid({ files }: { files: PostFile[] }) {
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const imgs   = files.filter(f => isImage(f.type))
  const vids   = files.filter(f => isVideo(f.type))
  const links  = files.filter(f => isLink(f.type))
  const others = files.filter(f => !isImage(f.type) && !isVideo(f.type) && !isLink(f.type))

  if (!files.length) return null

  const imgUrls = imgs.map(f => f.url)

  return (
    <div className="space-y-2">
      {lightbox && (
        <Lightbox urls={lightbox.urls} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      {/* Imagens */}
      {imgs.length > 0 && (
        imgs.length === 1 ? (
          <div className="relative rounded-xl overflow-hidden cursor-pointer" style={{ height: '240px' }}
            onClick={() => setLightbox({ urls: imgUrls, index: 0 })}>
            <img src={imgs[0].url} alt={imgs[0].name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <ImageCarousel imgs={imgs} onOpen={i => setLightbox({ urls: imgUrls, index: i })} />
        )
      )}

      {/* Vídeos */}
      {vids.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
          style={{ background: '#111116', border: '1px solid #2a2a35' }}>
          <span className="text-2xl shrink-0">🎬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white">{f.name}</p>
            <p className="text-xs" style={{ color: '#6b7280' }}>{fmtSize(f.size)}</p>
          </div>
          <span className="text-xs shrink-0 px-2.5 py-1 rounded-full font-semibold"
            style={{ background: '#6c63ff20', color: '#a78bfa' }}>Abrir ↗</span>
        </a>
      ))}

      {/* Links embeds (Google Drive, YouTube, Vimeo) */}
      {links.map((f, i) => {
        const viewUrl = f.url.replace('/preview', '/view')
        return (
          <div key={i} className="rounded-xl overflow-hidden"
            style={{ border: '1px solid #2a2a35' }}>
            <iframe
              src={f.url}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full"
              style={{ height: '280px', border: 'none', background: '#111116' }}
            />
            <div className="flex items-center gap-2 px-3.5 py-2.5"
              style={{ background: '#111116' }}>
              <span className="text-lg shrink-0">
                {f.type === 'link/drive' ? '🎬' : f.type === 'link/youtube' ? '▶️' : '🎞️'}
              </span>
              <p className="text-sm font-medium truncate flex-1 text-white">{f.name}</p>
              <a href={viewUrl} target="_blank" rel="noreferrer"
                className="text-xs shrink-0 px-2.5 py-1 rounded-full font-semibold"
                style={{ background: '#6c63ff20', color: '#a78bfa' }}>
                Tela cheia ↗
              </a>
            </div>
          </div>
        )
      })}

      {/* Outros arquivos */}
      {others.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
          style={{ background: '#111116', border: '1px solid #2a2a35' }}>
          <span className="text-xl shrink-0">📎</span>
          <p className="text-sm truncate flex-1 text-white">{f.name}</p>
          <span className="text-xs shrink-0" style={{ color: '#6b7280' }}>{fmtSize(f.size)}</span>
        </a>
      ))}
    </div>
  )
}

// ── ApprovalClient ────────────────────────────────────────────────────────────
export default function ApprovalClient({
  token,
  clientName,
  logoUrl,
  initialTasks,
}: {
  token: string
  clientName: string
  logoUrl: string | null
  initialTasks: ApprovalTask[]
}) {
  const [tasks, setTasks]           = useState(initialTasks)
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({})
  const [expanded, setExpanded]     = useState<string | null>(null)

  function getState(id: string): CardState { return cardStates[id] ?? { type: 'idle' } }
  function setState(id: string, s: CardState) { setCardStates(prev => ({ ...prev, [id]: s })) }

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  async function handleApprove(taskId: string) {
    setState(taskId, { type: 'loading' })
    const res = await fetch(`/api/approval/${token}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action: 'approve' }),
    })
    if (res.ok) {
      setState(taskId, { type: 'done', action: 'approve' })
      setTimeout(() => setTasks(prev => prev.filter(t => t.id !== taskId)), 1800)
    } else {
      const data = await res.json()
      alert(data.error ?? 'Erro ao aprovar. Tente novamente.')
      setState(taskId, { type: 'idle' })
    }
  }

  async function handleAdjust(taskId: string, notes: string) {
    if (!notes.trim()) return
    setState(taskId, { type: 'loading' })
    const res = await fetch(`/api/approval/${token}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, action: 'adjust', notes }),
    })
    if (res.ok) {
      setState(taskId, { type: 'done', action: 'adjust' })
      setTimeout(() => setTasks(prev => prev.filter(t => t.id !== taskId)), 1800)
    } else {
      const data = await res.json()
      alert(data.error ?? 'Erro ao enviar. Tente novamente.')
      setState(taskId, { type: 'adjusting', notes })
    }
  }

  const allDone = tasks.length === 0 && Object.keys(cardStates).length > 0

  return (
    <div className="min-h-screen" style={{ background: '#0f0f12', color: '#e5e7eb' }}>

      {/* Header */}
      <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
        {logoUrl ? (
          <Image src={logoUrl} alt={clientName} width={56} height={56}
            className="rounded-xl mb-3 object-contain" style={{ background: '#1c1c22' }} />
        ) : (
          <div className="w-14 h-14 rounded-xl mb-3 flex items-center justify-center text-2xl font-bold"
            style={{ background: '#6c63ff20', color: '#6c63ff' }}>
            {clientName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-xl font-bold text-white mb-1">{clientName}</h1>
        <p className="text-sm" style={{ color: '#9ca3af' }}>Painel de aprovação de conteúdo</p>
      </div>

      {/* Conteúdo */}
      <div className="px-4 pb-16 max-w-lg mx-auto">

        {tasks.length === 0 && !allDone && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#1c1c22', border: '1px solid #2a2a35' }}>
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold text-white mb-1">Nenhum card pendente!</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              Novos conteúdos aparecerão aqui quando estiverem prontos.
            </p>
          </div>
        )}

        {allDone && (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#1c1c22', border: '1px solid #2a2a35' }}>
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-white mb-1">Tudo avaliado!</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              Obrigado pelo retorno. Nossa equipe já foi notificada.
            </p>
          </div>
        )}

        {tasks.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
              {tasks.length} {tasks.length === 1 ? 'card aguardando' : 'cards aguardando'} sua avaliação
            </p>

            <div className="space-y-4">
              {tasks.map(task => {
                const state      = getState(task.id)
                const isExpanded = expanded === task.id
                const hasFiles   = task.files.length > 0

                if (state.type === 'done') {
                  return (
                    <div key={task.id} className="rounded-2xl p-5 text-center"
                      style={{
                        background: state.action === 'approve' ? '#14532d30' : '#7c2d1230',
                        border: `1px solid ${state.action === 'approve' ? '#16a34a40' : '#ea580c40'}`,
                      }}>
                      <div className="text-2xl mb-1">{state.action === 'approve' ? '✅' : '🔄'}</div>
                      <p className="text-sm font-medium" style={{ color: state.action === 'approve' ? '#4ade80' : '#fb923c' }}>
                        {state.action === 'approve' ? 'Aprovado!' : 'Ajuste solicitado!'}
                      </p>
                    </div>
                  )
                }

                return (
                  <div key={task.id} className="rounded-2xl overflow-hidden"
                    style={{ background: '#1c1c22', border: '1px solid #2a2a35' }}>

                    {/* Cabeçalho — clicável para expandir */}
                    <button
                      className="w-full text-left px-5 pt-5 pb-4"
                      onClick={() => toggleExpand(task.id)}>

                      {/* Plataforma / formato */}
                      {(task.platform || task.format) && (
                        <div className="flex items-center gap-2 mb-3">
                          {task.platform && (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
                              style={{ background: '#6c63ff15', color: '#a78bfa' }}>
                              {PLATFORM_ICON[task.platform] ?? '📱'} {task.platformLabel}
                            </span>
                          )}
                          {task.format && (
                            <span className="text-xs px-2.5 py-1 rounded-full"
                              style={{ background: '#1e3a2f', color: '#4ade80' }}>
                              {task.formatLabel}
                            </span>
                          )}
                          <span className="ml-auto text-xs" style={{ color: '#6b7280' }}>
                            {isExpanded ? '▲ Fechar' : '▼ Ver conteúdo'}
                          </span>
                        </div>
                      )}

                      <h2 className="text-base font-semibold text-white leading-snug">
                        {task.title}
                      </h2>

                      {/* Preview da primeira imagem quando fechado */}
                      {!isExpanded && hasFiles && (() => {
                        const firstImg = task.files.find(f => isImage(f.type))
                        if (!firstImg) return null
                        return (
                          <div className="mt-3 rounded-xl overflow-hidden" style={{ height: '140px' }}>
                            <img src={firstImg.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )
                      })()}

                      {/* Data de publicação */}
                      {(task.publish_date || task.due_date) && (
                        <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
                          📅 Publicar em:{' '}
                          {new Date(((task.publish_date || task.due_date)!) + 'T12:00:00')
                            .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                        </p>
                      )}
                    </button>

                    {/* Conteúdo expandido */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid #2a2a35' }}>
                        <div className="pt-3">
                          {/* Todos os arquivos */}
                          {hasFiles && <FileGrid files={task.files} />}

                          {/* Legenda */}
                          {task.caption && (
                            <div className="rounded-xl px-3.5 py-3 mt-3"
                              style={{ background: '#111116', border: '1px solid #2a2a35' }}>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                                style={{ color: '#6b7280' }}>Legenda</p>
                              <p className="text-sm" style={{ color: '#d1d5db' }}>{task.caption}</p>
                            </div>
                          )}

                          {!hasFiles && !task.caption && (
                            <p className="text-sm text-center py-4" style={{ color: '#4b5563' }}>
                              Nenhum arquivo anexado
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Área de ajuste */}
                    {state.type === 'adjusting' && (
                      <div className="px-5 pb-4" style={{ borderTop: '1px solid #2a2a35' }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mt-4 mb-2"
                          style={{ color: '#fb923c' }}>
                          O que precisa ser ajustado?
                        </p>
                        <textarea
                          autoFocus
                          value={state.notes}
                          onChange={e => setState(task.id, { type: 'adjusting', notes: e.target.value })}
                          placeholder="Descreva o ajuste necessário..."
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none text-white"
                          style={{ background: '#111116', border: '1px solid #3a3a47' }}
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleAdjust(task.id, state.notes)}
                            disabled={!state.notes.trim()}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                            style={{ background: '#f97316' }}>
                            Confirmar solicitação
                          </button>
                          <button
                            onClick={() => setState(task.id, { type: 'idle' })}
                            className="px-4 py-3 rounded-xl text-sm font-semibold"
                            style={{ background: '#2a2a35', color: '#9ca3af' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Botões de ação */}
                    {(state.type === 'idle' || state.type === 'loading') && (
                      <div className="px-5 pb-5 pt-1 flex gap-3">
                        <button
                          onClick={() => handleApprove(task.id)}
                          disabled={state.type === 'loading'}
                          className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
                          style={{ background: '#16a34a' }}>
                          {state.type === 'loading' ? '...' : '✅ Aprovar'}
                        </button>
                        <button
                          onClick={() => setState(task.id, { type: 'adjusting', notes: '' })}
                          disabled={state.type === 'loading'}
                          className="flex-1 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
                          style={{ background: '#f9731615', color: '#fb923c', border: '1.5px solid #f9731630' }}>
                          🔄 Solicitar ajuste
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <p className="text-center text-xs mt-10" style={{ color: '#4b5563' }}>
          Este link é exclusivo para {clientName}. Não compartilhe.
        </p>
      </div>
    </div>
  )
}
