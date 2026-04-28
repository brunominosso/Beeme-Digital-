import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientDetail from '@/components/ClientDetail'
import type { Client, Profile, Meeting, Task } from '@/types/database'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawClient }, { data: rawProfiles }, { data: rawMeetings }, { data: rawTasks }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('profiles').select('id, name, avatar_color, role'),
    supabase.from('meetings').select('*').eq('client_id', id).order('date', { ascending: false }),
    supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
  ])

  if (!rawClient) notFound()

  return (
    <ClientDetail
      client={rawClient as Client}
      profiles={(rawProfiles as Profile[]) ?? []}
      meetings={(rawMeetings as Meeting[]) ?? []}
      tasks={(rawTasks as Task[]) ?? []}
      backHref="/clients"
      backLabel="← Clientes"
    />
  )
}
