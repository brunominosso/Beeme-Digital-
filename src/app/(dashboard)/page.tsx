import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardHomeSwitch from '@/components/DashboardHomeSwitch'
import type { Client, Task, Meeting, Profile, Invoice, Expense, Post, PaymentSchedule } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const [
    { data: rawProfile },
    { data: rawClients },
    { data: rawTasks },
    { data: rawMeetings },
    { data: rawInvoices },
    { data: rawExpenses },
    { data: rawProfiles },
    { data: rawPosts },
    { data: rawSchedules },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('clients').select('*').order('name'),
    supabase.from('tasks').select('*').order('due_date', { ascending: true }),
    supabase.from('meetings').select('*').gte('date', todayStr).order('date', { ascending: true }).limit(20),
    supabase.from('invoices').select('*').order('due_date', { ascending: true }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('profiles').select('id, name, avatar_color, role').order('name'),
    supabase.from('posts').select('*').order('publish_date', { ascending: true }),
    supabase.from('payment_schedules').select('*, clients(name, status)').order('payment_day', { ascending: true }),
  ])

  const profile = rawProfile as Profile | null
  const allClients = (rawClients as Client[]) ?? []
  const allTasks = (rawTasks as Task[]) ?? []
  const upcomingMeetings = (rawMeetings as Meeting[]) ?? []
  const allInvoices = (rawInvoices as Invoice[]) ?? []
  const allExpenses = (rawExpenses as Expense[]) ?? []
  const allProfiles = (rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]) ?? []
  const allPosts = (rawPosts as Post[]) ?? []
  type ScheduleWithClient = PaymentSchedule & { clients: { name: string; status: string } | null }
  const allSchedules = (rawSchedules as ScheduleWithClient[]) ?? []

  if (profile?.role === 'captacao') redirect('/pautas')

  const myClients = profile?.role === 'admin'
    ? allClients
    : allClients.filter(c => c.responsible_ids?.includes(user!.id))

  const myTasks = profile?.role === 'admin'
    ? allTasks
    : allTasks.filter(t => t.assignee_id === user!.id || t.created_by === user!.id)

  const myPosts = profile?.role === 'admin'
    ? allPosts
    : allPosts.filter(p => p.assignee_ids?.includes(user!.id))

  const activeProfile: Profile = profile ?? {
    id: user!.id,
    name: user?.user_metadata?.name || user?.email || 'Utilizador',
    role: 'gestor',
    avatar_color: 'var(--accent)',
    responsibilities: null,
    created_at: now.toISOString(),
  }

  return (
    <DashboardHomeSwitch
      profile={activeProfile}
      myClients={myClients}
      allClients={allClients}
      myTasks={myTasks}
      allTasks={allTasks}
      upcomingMeetings={upcomingMeetings}
      allProfiles={allProfiles}
      allPosts={allPosts}
      myPosts={myPosts}
      allInvoices={allInvoices}
      allExpenses={allExpenses}
      paymentSchedules={allSchedules}
      todayStr={todayStr}
      tomorrowStr={tomorrowStr}
      weekEndStr={weekEndStr}
    />
  )
}
