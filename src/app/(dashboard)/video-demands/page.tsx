import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VideoDemandsView from '@/components/VideoDemandsView'
import type { VideoDemand, Client, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'gestor', 'captacao']

export default async function VideoDemandsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  if (!ALLOWED_ROLES.includes(userRole)) redirect('/')

  const [
    { data: rawDemands },
    { data: rawClients },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase
      .from('video_demands')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').eq('status', 'ativo').order('name'),
    supabase.from('profiles').select('id, name, role, avatar_color').order('name'),
  ])

  return (
    <VideoDemandsView
      demands={(rawDemands as VideoDemand[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name'>[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      userRole={userRole}
      currentUserId={user.id}
    />
  )
}
