import { createClient } from '@/lib/supabase/server'
import AboutView from '@/components/AboutView'
import type { Profile } from '@/types/database'

export default async function AboutPage() {
  const supabase = await createClient()
  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return <AboutView profiles={(rawProfiles as Profile[]) ?? []} />
}
