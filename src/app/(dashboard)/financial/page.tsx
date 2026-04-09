import { createClient } from '@/lib/supabase/server'
import FinancialView from '@/components/FinancialView'
import type { Invoice, Expense, Client } from '@/types/database'

type InvoiceWithClient = Invoice & { clients: { name: string } | null }

export default async function FinancialPage() {
  const supabase = await createClient()

  const [{ data: rawInvoices }, { data: rawExpenses }, { data: rawClients }] = await Promise.all([
    supabase.from('invoices').select('*, clients(name)').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
  ])

  return (
    <FinancialView
      initialInvoices={(rawInvoices as InvoiceWithClient[]) ?? []}
      initialExpenses={(rawExpenses as Expense[]) ?? []}
      clients={(rawClients as Pick<Client, 'id' | 'name'>[]) ?? []}
    />
  )
}
