import { createClient } from '@/lib/supabase/server'
import GoalsView from '@/components/GoalsView'
import type { Objective, KeyResult, Profile } from '@/types/database'

export default async function GoalsPage() {
  const supabase = await createClient()

  const [{ data: rawObjectives }, { data: rawKeyResults }, { data: rawProfiles }] = await Promise.all([
    supabase.from('objectives').select('*').order('created_at', { ascending: false }),
    supabase.from('key_results').select('*').order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, name, avatar_color, role'),
  ])

  return (
    <GoalsView
      initialObjectives={(rawObjectives as Objective[]) ?? []}
      initialKeyResults={(rawKeyResults as KeyResult[]) ?? []}
      profiles={(rawProfiles as Profile[]) ?? []}
    />
  )
}
