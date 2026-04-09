import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientForm from '@/components/ClientForm'
import Link from 'next/link'
import type { Client, Run } from '@/types/database'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawClient }, { data: rawRuns }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('runs').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
  ])

  if (!rawClient) notFound()

  const client = rawClient as Client
  const runs = rawRuns as Run[] | null

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/clients" className="text-sm mb-4 inline-block" style={{ color: 'var(--text-muted)' }}>
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold text-white">{client.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{client.niche}</p>
      </div>

      <ClientForm client={client} />

      {runs && runs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>ROTEIROS RECENTES</h2>
          <div className="space-y-2">
            {runs.map(run => (
              <Link key={run.id} href={`/runs/${run.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm text-white truncate flex-1">{run.topic || 'Pesquisa de notícias'}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(run.created_at).toLocaleDateString('pt-PT')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
