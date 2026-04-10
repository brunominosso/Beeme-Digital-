import { createClient } from '@/lib/supabase/server'
import HomeDashboard from '@/components/HomeDashboard'
import HomeDesigner from '@/components/HomeDesigner'
import HomeSocialMedia from '@/components/HomeSocialMedia'
import HomeFinanceiro from '@/components/HomeFinanceiro'
import type { Client, Task, Meeting, Profile, Invoice, Expense, Post } from '@/types/database'

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
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).single(),
    supabase.from('clients').select('*').order('name'),
    supabase.from('tasks').select('*').order('due_date', { ascending: true }),
    supabase.from('meetings').select('*').gte('date', todayStr).order('date', { ascending: true }).limit(20),
    supabase.from('invoices').select('*').order('due_date', { ascending: true }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('profiles').select('id, name, avatar_color, role').order('name'),
    supabase.from('posts').select('*').order('publish_date', { ascending: true }),
  ])

  const profile = rawProfile as Profile | null
  const allClients = (rawClients as Client[]) ?? []
  const allTasks = (rawTasks as Task[]) ?? []
  const upcomingMeetings = (rawMeetings as Meeting[]) ?? []
  const allInvoices = (rawInvoices as Invoice[]) ?? []
  const allExpenses = (rawExpenses as Expense[]) ?? []
  const allProfiles = (rawProfiles as Pick<Profile, 'id' | 'name' | 'avatar_color' | 'role'>[]) ?? []
  const allPosts = (rawPosts as Post[]) ?? []

  const myClients = profile?.role === 'admin'
    ? allClients
    : allClients.filter(c => c.responsible_ids?.includes(user!.id))

  const myTasks = profile?.role === 'admin'
    ? allTasks
    : allTasks.filter(t => t.assignee_id === user!.id || t.created_by === user!.id)

  const myPosts = profile?.role === 'admin'
    ? allPosts
    : allPosts.filter(p => p.assignee_ids?.includes(user!.id))

  const defaultProfile: Profile = {
    id: user!.id,
    name: user?.user_metadata?.name || user?.email || 'Utilizador',
    role: 'gestor',
    avatar_color: 'var(--accent)',
    responsibilities: null,
    created_at: now.toISOString(),
  }

  const activeProfile = profile ?? defaultProfile

  const sharedProps = {
    profile: activeProfile,
    myClients,
    allTasks: myTasks,
    upcomingMeetings,
    todayStr,
    tomorrowStr,
    weekEndStr,
  }

  switch (activeProfile.role) {
    case 'designer':
      return <HomeDesigner {...sharedProps} myPosts={myPosts} allClients={allClients} />
    case 'social_media':
      return <HomeSocialMedia {...sharedProps} myPosts={myPosts} allClients={allClients} weekEndStr={weekEndStr} />
    case 'financeiro':
      return <HomeFinanceiro {...sharedProps} allInvoices={allInvoices} allExpenses={allExpenses} />
    default:
      return <HomeDashboard {...sharedProps} allProfiles={allProfiles} allClients={allClients} allPosts={allPosts} allTasks={allTasks} />
  }
}
