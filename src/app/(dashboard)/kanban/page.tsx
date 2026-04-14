import { createClient } from '@/lib/supabase/server'
import KanbanBoard from '@/components/KanbanBoard'
import type { Task, Client, Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

type TaskWithRelations = Task & {
  clients: { name: string } | null
  profiles: { name: string | null } | null
}

const SM_STATUSES = ['sm_novo', 'design_fila', 'design_fazendo', 'cliente_aprovacao', 'sm_revisao', 'sm_aprovacao']
const DESIGNER_STATUSES = ['design_fila', 'design_fazendo', 'design_ajuste']

export default async function KanbanPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const userRole = (rawProfile as any)?.role ?? 'gestor'
  const currentUserName: string = ((rawProfile as any)?.name ?? '').toLowerCase()

  let taskQuery = supabase
    .from('tasks')
    .select('*, clients(name), profiles!tasks_assignee_id_fkey(name)')
    .order('position')

  // Regras de visibilidade e atribuição:
  // - Admin (bruno) → vê tudo, atribui a todos
  // - Paloma → vê suas tarefas e de Lorenzo, atribui a si e Lorenzo
  // - Lorenzo → vê suas tarefas e de Paloma, atribui a si e Paloma
  // - Todos os outros (Juan, Humberto, Giovanna, desconhecidos) → veem só as próprias tarefas
  // IMPORTANTE: lógica opt-out — padrão é restrito, só desbloqueia para admin/paloma/lorenzo
  const isAdmin = currentUserName.includes('bruno')
  const isPaloma = currentUserName.includes('paloma')
  const isLorenzo = currentUserName.includes('lorenzo')
  const isSelfOnly = !isAdmin && !isPaloma && !isLorenzo

  function getAssignableNames(): string[] | null {
    if (isSelfOnly) return null // não usa nome, usa ID direto abaixo
    if (isPaloma) return ['paloma', 'lorenzo']
    if (isLorenzo) return ['lorenzo', 'paloma']
    return null // admin: sem restrição
  }
  const assignableNames = getAssignableNames()

  if (userRole === 'social_media') {
    taskQuery = taskQuery.in('status', SM_STATUSES)
  } else if (userRole === 'designer') {
    taskQuery = taskQuery.in('status', DESIGNER_STATUSES)
  }

  // Filtrar tarefas pelo assignee para usuários restritos
  console.log('[kanban] user:', user!.id, '| name:', currentUserName, '| isSelfOnly:', isSelfOnly)
  if (isSelfOnly) {
    taskQuery = taskQuery.eq('assignee_id', user!.id)
  }

  const [{ data: rawTasks }, { data: rawClients }, { data: rawProfiles }] = await Promise.all([
    taskQuery,
    supabase.from('clients').select('id, name, status, responsible_ids').order('name'),
    supabase.from('profiles').select('id, name, avatar_color'),
  ])

  return (
    <KanbanBoard
      initialTasks={(rawTasks as TaskWithRelations[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color'>[]) ?? []}
      userRole={userRole}
      currentUserId={user!.id}
      hideAssignee={isSelfOnly}
      assignableProfileIds={
        isSelfOnly
          ? [user!.id]  // só pode atribuir a si mesmo, via ID (não depende do nome)
          : assignableNames === null
            ? null
            : (rawProfiles ?? []).filter((p: any) =>
                assignableNames.some(n => (p.name ?? '').toLowerCase().includes(n))
              ).map((p: any) => p.id)
      }
    />
  )
}
