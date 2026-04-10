'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#09081A' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(159,164,219,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(159,164,219,.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Glow top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(159,164,219,.07) 0%, transparent 65%)',
          top: '-150px',
          right: '-150px',
        }}
      />

      {/* Glow bottom-left */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,114,187,.05) 0%, transparent 65%)',
          bottom: '-100px',
          left: '-100px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-4">

        {/* Logo block */}
        <div className="text-center mb-10">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-8"
            style={{
              background: 'rgba(159,164,219,.08)',
              border: '1px solid rgba(159,164,219,.18)',
              borderRadius: '100px',
              padding: '6px 16px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#9FA4DB',
                display: 'inline-block',
                boxShadow: '0 0 6px #9FA4DB',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.35em',
                textTransform: 'uppercase' as const,
                color: '#9FA4DB',
              }}
            >
              Sistema Interno
            </span>
          </div>

          {/* Logo */}
          <div
            style={{
              fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
              fontSize: '64px',
              fontWeight: 300,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: '#FFFFFF',
              marginBottom: '12px',
            }}
          >
            beeme<span style={{ color: '#B8BCEE' }}>.</span>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontFamily: 'var(--font-playfair), "Playfair Display", serif',
              fontStyle: 'italic',
              fontSize: '14px',
              color: '#6E6E82',
              letterSpacing: '0.01em',
            }}
          >
            resultado real, não promessa.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: '#0E0D1C',
              border: '1px solid #2A2850',
              borderRadius: '16px',
              padding: '32px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.3em',
                textTransform: 'uppercase' as const,
                color: '#3A3870',
                marginBottom: '24px',
              }}
            >
              Acesso restrito
            </div>

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase' as const,
                    color: '#6E6E82',
                    marginBottom: '8px',
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@beemedigital.com"
                  style={{
                    width: '100%',
                    background: '#181638',
                    border: '1px solid #2A2850',
                    borderRadius: '10px',
                    padding: '11px 14px',
                    fontSize: '14px',
                    color: '#EEEAE0',
                    outline: 'none',
                    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                    transition: 'border-color .2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#9FA4DB')}
                  onBlur={e => (e.target.style.borderColor = '#2A2850')}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase' as const,
                    color: '#6E6E82',
                    marginBottom: '8px',
                  }}
                >
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: '#181638',
                    border: '1px solid #2A2850',
                    borderRadius: '10px',
                    padding: '11px 14px',
                    fontSize: '14px',
                    color: '#EEEAE0',
                    outline: 'none',
                    fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                    transition: 'border-color .2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#9FA4DB')}
                  onBlur={e => (e.target.style.borderColor = '#2A2850')}
                />
              </div>

              {/* Error */}
              {error && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#E24B4A',
                    textAlign: 'center',
                    padding: '8px 12px',
                    background: 'rgba(226,75,74,.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(226,75,74,.2)',
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: loading ? '#6C72BB' : '#9FA4DB',
                  border: 'none',
                  color: '#09081A',
                  fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'background .2s, opacity .2s',
                }}
                onMouseEnter={e => {
                  if (!loading) (e.currentTarget.style.background = '#B8BCEE')
                }}
                onMouseLeave={e => {
                  if (!loading) (e.currentTarget.style.background = '#9FA4DB')
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </div>
        </form>

        {/* Footer info */}
        <div className="text-center mt-8">
          <p
            style={{
              fontFamily: 'var(--font-barlow), "Barlow Condensed", sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.25em',
              textTransform: 'uppercase' as const,
              color: '#3A3870',
            }}
          >
            Beeme Digital · Gravatai, RS · 2026
          </p>
        </div>
      </div>
    </div>
  )
}
