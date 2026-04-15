import { createClient } from '@/lib/supabase/server'
import PipelineView from '@/components/PipelineView'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  // Mês de referência: próximo mês (produção é sempre para o mês seguinte)
  const now = new Date()
  const refMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const refMonthStr = refMonth.toISOString().split('T')[0]

  // Também busca mês atual para contexto
  const currentMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: rawClients },
    { data: rawProducao },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, status, responsible_ids, avatar_color')
      .eq('status', 'ativo')
      .order('name'),
    supabase
      .from('producao_mensal')
      .select('*')
      .in('mes', [refMonthStr, currentMonthStr]),
    supabase
      .from('profiles')
      .select('id, name, role, avatar_color')
      .in('role', ['social_media', 'designer', 'admin', 'gestor']),
  ])

  return (
    <PipelineView
      clients={(rawClients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]) ?? []}
      producao={(rawProducao as ProducaoMensal[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      refMonthStr={refMonthStr}
      currentMonthStr={currentMonthStr}
      userRole={userRole}
      currentUserId={user!.id}
    />
  )
}
