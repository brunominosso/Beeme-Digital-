import { createClient } from '@/lib/supabase/server'
import LeadsView from '@/components/LeadsView'
import type { Client, Profile } from '@/types/database'

export default async function LeadsPage() {
  const supabase = await createClient()

  const [{ data: rawClients }, { data: rawProfiles }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name, avatar_color, role'),
  ])

  return (
    <LeadsView
      initialClients={(rawClients as Client[]) ?? []}
      profiles={(rawProfiles as Profile[]) ?? []}
    />
  )
}
