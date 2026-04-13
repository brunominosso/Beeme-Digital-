import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/KanbanBoard'
import type { Task, Client, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

type TaskWithRelations = Task & {
  clients: { name: string } | null
  profiles: { name: string | null } | null
}

const SM_STATUSES = ['sm_novo', 'design_fila', 'design_fazendo', 'sm_revisao', 'sm_aprovacao']
const DESIGNER_STATUSES = ['design_fila', 'design_fazendo']

export default async function KanbanPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const userRole = (rawProfile as any)?.role ?? 'gestor'

  let taskQuery = supabase
    .from('tasks')
    .select('*, clients(name), profiles!tasks_assignee_id_fkey(name)')
    .order('position')

  if (userRole === 'social_media') {
    taskQuery = taskQuery.in('status', SM_STATUSES)
  } else if (userRole === 'designer') {
    taskQuery = taskQuery.in('status', DESIGNER_STATUSES)
  }

  const [{ data: rawTasks }, { data: rawClients }, { data: rawProfiles }] = await Promise.all([
    taskQuery,
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('profiles').select('id, name, avatar_color'),
  ])

  return (
    <KanbanBoard
      initialTasks={(rawTasks as TaskWithRelations[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name'>[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color'>[]) ?? []}
      userRole={userRole}
    />
  )
}
