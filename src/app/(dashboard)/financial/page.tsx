import { createClient } from '@/lib/supabase/server'
import FinancialView from '@/components/FinancialView'
import type { Invoice, Expense, Client, PaymentSchedule } from '@/types/database'

type InvoiceWithClient = Invoice & { clients: { name: string } | null }
type ScheduleWithClient = PaymentSchedule & { clients: { name: string; status: string } | null }

export default async function FinancialPage() {
  const supabase = await createClient()

  const [
    { data: rawInvoices },
    { data: rawExpenses },
    { data: rawClients },
    { data: rawSchedules },
  ] = await Promise.all([
    supabase.from('invoices').select('*, clients(name)').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('clients').select('id, name, monthly_value, payment_day, status').order('name'),
    // RLS garante que só role=financeiro recebe dados; outros recebem []
    supabase.from('payment_schedules').select('*, clients(name, status)').order('payment_day', { ascending: true }),
  ])

  return (
    <FinancialView
      initialInvoices={(rawInvoices as InvoiceWithClient[]) ?? []}
      initialExpenses={(rawExpenses as Expense[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name' | 'monthly_value' | 'payment_day' | 'status'>[]) ?? []}
      initialSchedules={(rawSchedules as ScheduleWithClient[]) ?? []}
    />
  )
}
