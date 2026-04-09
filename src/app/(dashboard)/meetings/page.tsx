import { createClient } from '@/lib/supabase/server'
import MeetingsView from '@/components/MeetingsView'
import type { Meeting, Client, Profile } from '@/types/database'

export default async function MeetingsPage() {
  const supabase = await createClient()

  const [{ data: rawMeetings }, { data: rawClients }, { data: rawProfiles }] = await Promise.all([
    supabase.from('meetings').select('*').order('date', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('profiles').select('id, name, avatar_color, role'),
  ])

  return (
    <MeetingsView
      initialMeetings={(rawMeetings as Meeting[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name'>[]) ?? []}
      profiles={(rawProfiles as Profile[]) ?? []}
    />
  )
}
