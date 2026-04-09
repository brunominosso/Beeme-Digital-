import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Client } from '@/types/database'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: rawClients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const clients = rawClients as Client[] | null

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {clients?.length ?? 0} cliente{clients?.length !== 1 ? 's' : ''} registado{clients?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/clients/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          + Novo cliente
        </Link>
      </div>

      {!clients?.length ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium text-white">Nenhum cliente ainda</p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Cria o primeiro cliente para começar a produzir roteiros</p>
          <Link href="/clients/new"
            className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Criar cliente
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map(client => (
            <Link key={client.id} href={`/clients/${client.id}`}
              className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors hover:opacity-90"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{ background: 'var(--accent)' }}>
                {client.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{client.name}</p>
                <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{client.niche}</p>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
