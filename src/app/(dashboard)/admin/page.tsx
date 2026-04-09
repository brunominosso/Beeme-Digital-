import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminView from '@/components/AdminView'
import type { Profile } from '@/types/database'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if ((profile as { role: string } | null)?.role !== 'admin') redirect('/')

  const { data: profiles } = await supabase.from('profiles').select('*').order('name')

  return <AdminView profiles={(profiles as Profile[]) ?? []} />
}
