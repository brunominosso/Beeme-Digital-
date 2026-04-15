import { createClient } from '@/lib/supabase/server'
import PautasView from '@/components/PautasView'
import type { Pauta, Client, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PautasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  // Busca pautas dos próximos 3 meses e dos últimos 30 dias
  const rangeStart = new Date()
  rangeStart.setDate(rangeStart.getDate() - 30)
  const rangeEnd = new Date()
  rangeEnd.setDate(rangeEnd.getDate() + 90)

  const [
    { data: rawPautas },
    { data: rawClients },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase
      .from('pautas')
      .select('*')
      .gte('data', rangeStart.toISOString().split('T')[0])
      .lte('data', rangeEnd.toISOString().split('T')[0])
      .order('data')
      .order('turno'),
    supabase.from('clients').select('id, name, status, responsible_ids').order('name'),
    supabase.from('profiles').select('id, name, role, avatar_color').order('name'),
  ])

  return (
    <PautasView
      initialPautas={(rawPautas as Pauta[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      userRole={userRole}
      currentUserId={user!.id}
    />
  )
}
