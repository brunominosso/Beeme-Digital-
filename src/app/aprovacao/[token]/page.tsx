import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ApprovalClient from './ApprovalClient'

export const dynamic = 'force-dynamic'

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
}

const FORMAT_LABEL: Record<string, string> = {
  reels_short: 'Reels',
  carrossel: 'Carrossel',
  imagem_unica: 'Imagem',
  stories: 'Stories',
  video: 'Vídeo',
}

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

  // Busca cards em aprovação para este cliente
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, notes, platform, format, due_date, publish_date, approval_notes')
    .eq('client_id', client.id)
    .eq('status', 'cliente_aprovacao')
    .order('created_at')

  const pendingTasks = (tasks ?? []).map(t => ({
    ...t,
    platformLabel: PLATFORM_LABEL[t.platform ?? ''] ?? t.platform ?? '',
    formatLabel: FORMAT_LABEL[t.format ?? ''] ?? t.format ?? '',
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
