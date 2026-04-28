import { createClient } from '@/lib/supabase/server'
import PautasView from '@/components/PautasView'
import type { Pauta, Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

function localDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function PautasPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  // Mês visualizado: lido da URL (?month=YYYY-MM) ou mês corrente
  const { month } = await searchParams
  const now = new Date()
  let viewedYear = now.getFullYear()
  let viewedMonth = now.getMonth() // 0-indexed

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number)
    viewedYear = y
    viewedMonth = m - 1
  }

  // Range: 2 meses antes até 3 meses depois do mês visualizado
  const rangeStart = localDateStr(viewedYear, viewedMonth - 2, 1)
  const rangeEnd   = localDateStr(viewedYear, viewedMonth + 4, 0)

  const refMonthStr   = localDateStr(viewedYear, viewedMonth, 1)
  const initialWeekRef = localDateStr(viewedYear, viewedMonth, 15)

  const [
    { data: rawPautas },
    { data: rawClients },
    { data: rawProfiles },
    { data: rawProducao },
  ] = await Promise.all([
    supabase.from('pautas').select('*')
      .gte('data', rangeStart)
      .lte('data', rangeEnd)
      .order('data').order('turno'),
    supabase.from('clients').select('id, name, status, responsible_ids')
      .eq('status', 'ativo').order('name'),
    supabase.from('profiles').select('id, name, role, avatar_color').order('name'),
    supabase.from('producao_mensal').select('*').eq('mes', refMonthStr),
  ])

  // ── Auto-recorrência mensal ──────────────────────────────────────────────────
  // Se o mês visualizado está vazio mas o mês anterior tem pautas,
  // copia automaticamente com as datas ajustadas (+1 mês, mesmo dia).
  let allPautas: Pauta[] = (rawPautas as Pauta[]) ?? []

  const viewedMonthStart = localDateStr(viewedYear, viewedMonth, 1)
  const viewedMonthEnd   = localDateStr(viewedYear, viewedMonth + 1, 0)
  const prevMonthStart   = localDateStr(viewedYear, viewedMonth - 1, 1)
  const prevMonthEnd     = localDateStr(viewedYear, viewedMonth, 0)

  const viewedEmpty    = !allPautas.some(p => p.data >= viewedMonthStart && p.data <= viewedMonthEnd)
  const prevMonthPautas = allPautas.filter(p => p.data >= prevMonthStart && p.data <= prevMonthEnd)

  // Só copia para o mês atual ou futuros (não retroativo)
  const isCurrentOrFuture = viewedYear > now.getFullYear() ||
    (viewedYear === now.getFullYear() && viewedMonth >= now.getMonth())

  if (viewedEmpty && prevMonthPautas.length > 0 && isCurrentOrFuture) {
    const lastDayOfViewedMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate()

    const toInsert = prevMonthPautas.map(p => {
      const dayOfMonth = parseInt(p.data.split('-')[2], 10)
      const clampedDay = Math.min(dayOfMonth, lastDayOfViewedMonth)
      return {
        assignee_id: p.assignee_id,
        client_id:   p.client_id,
        tipo:        p.tipo,
        turno:       p.turno,
        notas:       p.notas,
        status:      'pendente' as const,
        data:        localDateStr(viewedYear, viewedMonth, clampedDay),
        created_by:  user!.id,
      }
    })

    const { data: created } = await supabase.from('pautas').insert(toInsert).select()
    if (created) allPautas = [...allPautas, ...(created as Pauta[])]
  }
  // ────────────────────────────────────────────────────────────────────────────

  const teamIds = (rawProfiles ?? [])
    .filter((p: any) => p.role === 'social_media' || p.role === 'designer' || p.role === 'captacao')
    .map((p: any) => p.id)

  let activeClients: any[]
  if (userRole === 'admin') {
    const filteredByTeam = (rawClients ?? []).filter((c: any) =>
      (c.responsible_ids ?? []).some((id: string) => teamIds.includes(id))
    )
    activeClients = filteredByTeam.length > 0 ? filteredByTeam : (rawClients ?? [])
  } else {
    activeClients = (rawClients ?? []).filter((c: any) =>
      (c.responsible_ids ?? []).includes(user!.id)
    )
  }

  return (
    <PautasView
      initialPautas={allPautas}
      clients={activeClients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      producao={(rawProducao as ProducaoMensal[]) ?? []}
      refMonthStr={refMonthStr}
      userRole={userRole}
      currentUserId={user!.id}
      initialWeekRef={initialWeekRef}
    />
  )
}
