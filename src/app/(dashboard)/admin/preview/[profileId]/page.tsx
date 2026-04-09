import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeDashboard from '@/components/HomeDashboard'
import HomeDesigner from '@/components/HomeDesigner'
import HomeSocialMedia from '@/components/HomeSocialMedia'
import HomeFinanceiro from '@/components/HomeFinanceiro'
import PreviewBanner from '@/components/PreviewBanner'
import type { Client, Task, Meeting, Profile, Invoice, Expense } from '@/types/database'

export default async function PreviewPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params
  const supabase = await createClient()

  // Só admin pode aceder
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/')

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
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase.from('clients').select('*').order('name'),
    supabase.from('tasks').select('*').order('due_date', { ascending: true }),
    supabase.from('meetings').select('*').gte('date', todayStr).order('date', { ascending: true }).limit(20),
    supabase.from('invoices').select('*').order('due_date', { ascending: true }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
  ])

  if (!rawProfile) redirect('/admin')

  const profile = rawProfile as Profile
  const allClients = (rawClients as Client[]) ?? []
  const allTasks = (rawTasks as Task[]) ?? []
  const upcomingMeetings = (rawMeetings as Meeting[]) ?? []
  const allInvoices = (rawInvoices as Invoice[]) ?? []
  const allExpenses = (rawExpenses as Expense[]) ?? []

  const myClients = allClients.filter(c => c.responsible_ids?.includes(profileId))
  const myTasks = allTasks.filter(t => t.assignee_id === profileId || t.created_by === profileId)

  const sharedProps = {
    profile,
    myClients,
    allTasks: myTasks,
    upcomingMeetings,
    todayStr,
    tomorrowStr,
    weekEndStr,
  }

  let HomeComponent
  switch (profile.role) {
    case 'designer':
      HomeComponent = <HomeDesigner {...sharedProps} />
      break
    case 'social_media':
      HomeComponent = <HomeSocialMedia {...sharedProps} />
      break
    case 'financeiro':
      HomeComponent = <HomeFinanceiro {...sharedProps} allInvoices={allInvoices} allExpenses={allExpenses} />
      break
    default:
      HomeComponent = <HomeDashboard {...sharedProps} />
  }

  return (
    <div>
      <PreviewBanner name={profile.name || 'Membro'} role={profile.role} />
      {HomeComponent}
    </div>
  )
}
