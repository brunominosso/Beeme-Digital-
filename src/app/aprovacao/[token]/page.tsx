import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ApprovalClient from './ApprovalClient'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = adminClient()

  // Busca cliente pelo token
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, logo_url, approval_token')
    .eq('approval_token', token)
    .single()

  if (!client) notFound()

  // Busca posts em aprovação para este cliente
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, notes, platform, format, due_date, publish_date, approval_notes')
    .eq('client_id', client.id)
    .eq('status', 'cliente_aprovacao')
    .order('created_at')

  const pendingTasks = (posts ?? []).map(p => ({
    id: p.id,
    title: p.title,
    description: null,
    notes: p.notes ?? null,
    platform: p.platform ?? null,
    format: p.format ?? null,
    due_date: p.due_date ?? null,
    publish_date: p.publish_date ?? null,
    approval_notes: p.approval_notes ?? null,
    platformLabel: p.platform ?? '',
    formatLabel: p.format ?? '',
  }))

  return (
    <ApprovalClient
      token={token}
      clientName={client.name}
      logoUrl={client.logo_url}
      initialTasks={pendingTasks}
    />
  )
}
