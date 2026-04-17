import { createClient } from '@/lib/supabase/server'
import PautasView from '@/components/PautasView'
import type { Pauta, Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PautasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  const rangeStart = new Date()
  rangeStart.setDate(rangeStart.getDate() - 30)
  const rangeEnd = new Date()
  rangeEnd.setDate(rangeEnd.getDate() + 90)

  // Mês de referência do pipeline (próximo mês)
  const now = new Date()
  const refMonthStr = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString().split('T')[0]

  const [
    { data: rawPautas },
    { data: rawClients },
    { data: rawProfiles },
    { data: rawProducao },
  ] = await Promise.all([
    supabase.from('pautas').select('*')
      .gte('data', rangeStart.toISOString().split('T')[0])
      .lte('data', rangeEnd.toISOString().split('T')[0])
      .order('data').order('turno'),
    supabase.from('clients').select('id, name, status, responsible_ids')
      .eq('status', 'ativo').order('name'),
    supabase.from('profiles').select('id, name, role, avatar_color').order('name'),
    supabase.from('producao_mensal').select('*').eq('mes', refMonthStr),
  ])

  // Clientes com SM ou Designer como responsável
  // Fallback para todos os ativos se nenhum tiver responsible_ids configurado
  const teamIds = (rawProfiles ?? [])
    .filter((p: any) => p.role === 'social_media' || p.role === 'designer' || p.role === 'captacao')
    .map((p: any) => p.id)

  const filteredByTeam = (rawClients ?? []).filter((c: any) =>
    (c.responsible_ids ?? []).some((id: string) => teamIds.includes(id))
  )
  const activeClients = filteredByTeam.length > 0 ? filteredByTeam : (rawClients ?? [])

  return (
    <PautasView
      initialPautas={(rawPautas as Pauta[]) ?? []}
      clients={activeClients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      producao={(rawProducao as ProducaoMensal[]) ?? []}
      refMonthStr={refMonthStr}
      userRole={userRole}
      currentUserId={user!.id}
    />
  )
}
