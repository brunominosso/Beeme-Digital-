import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConteudosView from '@/components/ConteudosView'
import type { Post, Client, Profile } from '@/types/database'

export default async function ConteudosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const role = (profile as Profile | null)?.role ?? 'gestor'
  if (!['admin', 'social_media', 'designer', 'editor'].includes(role)) redirect('/')

  const SM_STATUSES   = ['sm_novo', 'design_fila', 'design_fazendo', 'sm_revisao', 'sm_aprovacao']
  const DES_STATUSES  = ['design_fila', 'design_fazendo']

  const ALL_NEW_STATUSES = ['sm_novo', 'design_fila', 'design_fazendo', 'sm_revisao', 'sm_aprovacao']

  const postsQuery = role === 'admin'
    ? supabase.from('posts').select('*').in('status', ALL_NEW_STATUSES).order('publish_date', { ascending: true })
    : role === 'designer'
    ? supabase.from('posts').select('*').in('status', DES_STATUSES).order('publish_date', { ascending: true })
    : role === 'social_media'
    ? supabase.from('posts').select('*').in('status', SM_STATUSES).contains('assignee_ids', [user.id]).order('publish_date', { ascending: true })
    : supabase.from('posts').select('*').contains('assignee_ids', [user.id]).order('publish_date', { ascending: true })

  const [{ data: rawPosts }, { data: rawClients }, { data: rawProfiles }] = await Promise.all([
    postsQuery,
    supabase.from('clients').select('id, name, responsible_ids').order('name'),
    supabase.from('profiles').select('id, name, avatar_color, role').order('name'),
  ])

  const allClients = (rawClients as Pick<Client, 'id' | 'name' | 'responsible_ids'>[]) ?? []

  // Clientes atribuídos ao utilizador atual (para filtro)
  const myClients = role === 'admin'
    ? allClients
    : allClients.filter(c => c.responsible_ids?.includes(user.id))

  return (
    <ConteudosView
      posts={(rawPosts as Post[]) ?? []}
      clients={allClients}
      myClients={myClients}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]) ?? []}
      currentUserId={user.id}
      currentUserRole={role}
      isAdmin={role === 'admin'}
    />
  )
}
