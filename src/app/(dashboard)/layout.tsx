import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profileData as unknown as { role: string } | null)?.role ?? 'gestor'

  return (
    <DashboardShell user={user} role={role}>
      {children}
    </DashboardShell>
  )
}
