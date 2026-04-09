import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/KanbanBoard'
import type { Task, Client, Profile } from '@/types/database'

type TaskWithRelations = Task & {
  clients: { name: string } | null
  profiles: { name: string | null } | null
}

export default async function KanbanPage() {
  const supabase = await createClient()

  const [{ data: rawTasks }, { data: rawClients }, { data: rawProfiles }] = await Promise.all([
    supabase.from('tasks').select('*, clients(name), profiles!tasks_assignee_id_fkey(name)').order('position'),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('profiles').select('id, name, avatar_color'),
  ])

  return (
    <KanbanBoard
      initialTasks={(rawTasks as TaskWithRelations[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name'>[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color'>[]) ?? []}
    />
  )
}
