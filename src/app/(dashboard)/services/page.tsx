import { createClient } from '@/lib/supabase/server'
import ServicesView from '@/components/ServicesView'
import type { Service } from '@/types/database'

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('services')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  return <ServicesView initialServices={(data as Service[]) ?? []} />
}
