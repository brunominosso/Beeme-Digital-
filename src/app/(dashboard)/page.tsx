import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/HomeDashboard'
import HomeDesigner from '@/components/HomeDesigner'
import HomeSocialMedia from '@/components/HomeSocialMedia'
import HomeFinanceiro from '@/components/HomeFinanceiro'
import HomeMobile from '@/components/HomeMobile'
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
    // RLS garante que só role=financeiro recebe dados
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

  const mobileView = (
    <div className="md:hidden">
      <HomeMobile
        profile={activeProfile}
        myClients={myClients}
        allTasks={myTasks}
        upcomingMeetings={upcomingMeetings}
        todayStr={todayStr}
        tomorrowStr={tomorrowStr}
        allProfiles={allProfiles}
        allPosts={allPosts}
      />
    </div>
  )

  switch (activeProfile.role) {
    case 'captacao':
      redirect('/pautas')
    case 'designer':
      return <>{mobileView}<div className="hidden md:block"><HomeDesigner {...sharedProps} myPosts={myPosts} allClients={allClients} /></div></>
    case 'social_media':
      return <>{mobileView}<div className="hidden md:block"><HomeSocialMedia {...sharedProps} myPosts={myPosts} allClients={allClients} weekEndStr={weekEndStr} /></div></>
    case 'financeiro':
      return <>{mobileView}<div className="hidden md:block"><HomeFinanceiro {...sharedProps} allInvoices={allInvoices} allExpenses={allExpenses} paymentSchedules={allSchedules} /></div></>
    default:
      return <>{mobileView}<div className="hidden md:block"><HomeDashboard {...sharedProps} allProfiles={allProfiles} allClients={allClients} allPosts={allPosts} allTasks={allTasks} /></div></>
  }
}
