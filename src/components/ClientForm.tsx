'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types/database'

export default function ClientForm({ client }: { client?: Client }) {
  const router = useRouter()
  const isEdit = !!client

  const [name, setName] = useState(client?.name ?? '')
  const [niche, setNiche] = useState(client?.niche ?? '')
  const [toneOfVoice, setToneOfVoice] = useState(client?.tone_of_voice ?? '')
  const [forbiddenWords, setForbiddenWords] = useState((client?.forbidden_words ?? []).join(', '))
  const [domainFramework, setDomainFramework] = useState(client?.domain_framework ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name,
      niche,
      tone_of_voice: toneOfVoice || null,
      forbidden_words: forbiddenWords ? forbiddenWords.split(',').map(w => w.trim()).filter(Boolean) : [],
      domain_framework: domainFramework || null,
    }

    if (isEdit) {
      const { error } = await supabase.from('clients').update(payload).eq('id', client.id)
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.from('clients').insert({ ...payload, user_id: user.id })
      if (error) { setError(error.message); setLoading(false); return }
    }

    router.push('/clients')
    router.refresh()
  }

  async function handleDelete() {
    if (!client || !confirm(`Eliminar ${client.name}? Esta ação não pode ser revertida.`)) return
    const supabase = createClient()
    await supabase.from('clients').delete().eq('id', client.id)
    router.push('/clients')
    router.refresh()
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nome do cliente *</label>
          <input required type="text" value={name} onChange={e => setName(e.target.value)}
            className={inputClass} style={inputStyle} placeholder="Ex: João Silva — Clínica Estética" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nicho *</label>
          <input required type="text" value={niche} onChange={e => setNiche(e.target.value)}
            className={inputClass} style={inputStyle} placeholder="Ex: Saúde e bem-estar, empreendedorismo digital, moda..." />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Tom de voz</label>
          <textarea value={toneOfVoice} onChange={e => setToneOfVoice(e.target.value)} rows={3}
            className={inputClass} style={inputStyle}
            placeholder="Ex: Direto, educativo, sem hype. Fala como expert mas sem ser técnico. Usa exemplos reais." />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Palavras proibidas</label>
          <input type="text" value={forbiddenWords} onChange={e => setForbiddenWords(e.target.value)}
            className={inputClass} style={inputStyle}
            placeholder="alavancar, engajar, potencializar (separadas por vírgula)" />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Separar por vírgula. Vítor Voz nunca usará estas palavras.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Framework de domínio</label>
          <textarea value={domainFramework} onChange={e => setDomainFramework(e.target.value)} rows={4}
            className={inputClass} style={inputStyle}
            placeholder="Contexto sobre o negócio, público-alvo, principais dores, produtos/serviços, diferenciais..." />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {loading ? 'A guardar...' : isEdit ? 'Guardar alterações' : 'Criar cliente'}
        </button>
        {isEdit && (
          <button type="button" onClick={handleDelete}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface-2)', color: 'var(--danger)', border: '1px solid var(--border)' }}>
            Eliminar
          </button>
        )}
      </div>
    </form>
  )
}
