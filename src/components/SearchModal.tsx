'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type SearchResults = {
  clients: { id: string; name: string; niche: string | null }[]
  posts: { id: string; title: string; status: string; clients: { name: string } | null }[]
  tasks: { id: string; title: string; status: string; clients: { name: string } | null }[]
}

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)
  const router                = useRouter()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (query.length < 2) { setResults(null); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) setResults(await res.json())
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  function navigate(href: string) { router.push(href); onClose() }

  if (!open) return null

  const hasResults = results && (
    results.clients.length > 0 || results.posts.length > 0 || results.tasks.length > 0
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      style={{ background: 'rgba(8,8,15,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar clientes, posts, tarefas..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--cream)' }}
          />
          <kbd
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              A pesquisar...
            </p>
          )}

          {!loading && results && hasResults && (
            <>
              {results.clients.length > 0 && (
                <ResultSection
                  label="Clientes"
                  items={results.clients.map(c => ({
                    label: c.name,
                    sub: c.niche ?? '',
                    onClick: () => navigate('/leads'),
                  }))}
                />
              )}
              {results.posts.length > 0 && (
                <ResultSection
                  label="Posts"
                  items={results.posts.map(p => ({
                    label: p.title,
                    sub: p.clients?.name ?? '',
                    onClick: () => navigate('/conteudos'),
                  }))}
                />
              )}
              {results.tasks.length > 0 && (
                <ResultSection
                  label="Tarefas"
                  items={results.tasks.map(t => ({
                    label: t.title,
                    sub: t.clients?.name ?? '',
                    onClick: () => navigate('/kanban'),
                  }))}
                />
              )}
            </>
          )}

          {!loading && results && !hasResults && (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Sem resultados para &quot;{query}&quot;
            </p>
          )}

          {!loading && !results && (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Digite pelo menos 2 caracteres...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultSection({
  label,
  items,
}: {
  label: string
  items: { label: string; sub: string; onClick: () => void }[]
}) {
  return (
    <div className="mb-2">
      <p className="label-caps px-2 py-1">{label}</p>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className="w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" style={{ color: 'var(--cream)' }}>{item.label}</p>
            {item.sub && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
