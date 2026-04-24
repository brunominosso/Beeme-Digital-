'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const password = passwordRef.current?.value ?? ''
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: 'var(--accent)' }}>
            <span className="text-xl">🎬</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Roteiros</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Beeme Digital</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                placeholder="O teu nome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                placeholder="tu@beemedigital.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Palavra-passe</label>
              <input
                type="password"
                required
                minLength={6}
                ref={passwordRef}
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-2 transition-all"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'A criar conta...' : 'Criar conta'}
            </button>
          </div>

          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Já tens conta?{' '}
            <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
