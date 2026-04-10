import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminView from '@/components/AdminView'
import type { Profile } from '@/types/database'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase.from('profiles').select('*').order('name')
  const myProfile = (profiles as Profile[] | null)?.find(p => p.id === user!.id)
  if (myProfile?.role !== 'admin') redirect('/')

  return <AdminView profiles={(profiles as Profile[]) ?? []} />
}
