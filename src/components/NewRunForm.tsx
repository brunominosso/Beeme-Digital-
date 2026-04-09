'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ClientOption = { id: string; name: string; niche: string }

export default function NewRunForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter()
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [mode, setMode] = useState<'news' | 'topic' | 'trend'>('news')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: run, error } = await supabase.from('runs').insert({
      client_id: clientId,
      user_id: user.id,
      mode,
      topic: topic || null,
      status: 'pending',
      current_step: 0,
    }).select().single()

    if (error || !run) { setLoading(false); return }

    router.push(`/runs/${run.id}`)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Client selector */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Cliente *</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)}
            className={inputClass} style={inputStyle}>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedClient && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Nicho: {selectedClient.niche}</p>
          )}
        </div>

        {/* Mode */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Origem do conteúdo *</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'news', label: '📰 Notícias', desc: 'Nuno pesquisa notícias recentes do nicho' },
              { value: 'topic', label: '💡 Tema', desc: 'Defines o tema — sem pesquisa de notícias' },
              { value: 'trend', label: '🔥 Tendência', desc: 'Nuno pesquisa tendências do nicho' },
            ].map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setMode(opt.value as typeof mode)}
                className="px-3 py-3 rounded-lg text-left transition-all text-sm"
                style={{
                  background: mode === opt.value ? 'var(--accent)' : 'var(--surface-2)',
                  border: `1px solid ${mode === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  color: mode === opt.value ? 'white' : 'var(--text-muted)',
                }}>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs mt-0.5 opacity-75">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic (optional for news, required for topic) */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            {mode === 'topic' ? 'Tema *' : 'Foco de pesquisa (opcional)'}
          </label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            required={mode === 'topic'}
            className={inputClass} style={inputStyle}
            placeholder={mode === 'topic'
              ? 'Ex: Como usar IA para responder clientes no WhatsApp'
              : 'Ex: Meta Ads, inteligência artificial, vendas online...'}
          />
        </div>
      </div>

      {/* Pipeline preview */}
      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>PIPELINE</p>
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {[
            { agent: 'Nuno', icon: '📰', skip: mode === 'topic' },
            { agent: 'Carlos', icon: '💡', skip: false, label: 'Ângulos' },
            { agent: 'Carlos', icon: '✍️', skip: false, label: 'Carrossel' },
            { agent: 'Vítor', icon: '✨', skip: false },
            { agent: 'Rafael', icon: '🎬', skip: false },
            { agent: 'Sabrina', icon: '📱', skip: false },
            { agent: 'Tereza', icon: '✅', skip: false },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={`px-2 py-1 rounded ${s.skip ? 'opacity-30' : ''}`}
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                {s.icon} {s.label || s.agent}
              </span>
              {i < 6 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Approvals em: seleção de notícias, ângulo, copy
        </p>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}>
        {loading ? 'A criar...' : 'Iniciar pipeline →'}
      </button>
    </form>
  )
}
