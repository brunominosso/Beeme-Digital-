import { createClient } from '@/lib/supabase/server'
import PipelineView from '@/components/PipelineView'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

const PAUTA_ETAPA: Record<string, string> = {
  planejamento:  'planejamento',
  captacao:      'captacao',
  edicao_video:  'edicao',
  edicao_cards:  'design',
  agendamento:   'agendamento',
}

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  const now = new Date()
  // Pipeline e pautas são do mesmo mês
  const refMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const currentMonthStr = refMonthStr
  // Pautas: 3 meses atrás até fim do mês atual (para suportar navegação histórica e sirenes)
  const pautaStart = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]
  const pautaEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  // Posts: mês atual
  const postStart = refMonthStr
  const postEnd = pautaEnd

  const [
    { data: rawProfiles },
    { data: rawAllClients },
    { data: rawProducao },
    { data: rawPautas },
    { data: rawPosts },
    { data: rawClientPosts },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, role, avatar_color')
      .in('role', ['social_media', 'designer', 'admin', 'gestor']),
    supabase.from('clients').select('id, name, status, responsible_ids')
      .eq('status', 'ativo').order('name'),
    supabase.from('producao_mensal').select('*')
      .gte('mes', new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0])
      .order('mes'),
    supabase.from('pautas').select('id, client_id, tipo, status, data, assignee_id')
      .gte('data', pautaStart).lte('data', pautaEnd),
    supabase.from('posts').select('client_id, status, publish_date')
      .gte('publish_date', postStart).lte('publish_date', postEnd),
    // Aprovação: posts do próximo mês em ciclo de revisão com o cliente
    supabase.from('posts').select('client_id, status')
      .in('status', ['design_ajuste', 'cliente_aprovacao'])
      .gte('publish_date', postStart).lte('publish_date', postEnd),
  ])

  const teamIds = (rawProfiles ?? [])
    .filter((p: any) => p.role === 'social_media' || p.role === 'designer')
    .map((p: any) => p.id)

  const clients = (rawAllClients ?? []).filter((c: any) =>
    (c.responsible_ids ?? []).some((id: string) => teamIds.includes(id))
  )

  // ── Posts pendentes de cliente por tipo ──────────────────
  const ajusteByClient: Record<string, number> = {}
  const aguardandoByClient: Record<string, number> = {}
  for (const post of (rawClientPosts ?? []) as any[]) {
    if (!post.client_id) continue
    if (post.status === 'design_ajuste') {
      ajusteByClient[post.client_id] = (ajusteByClient[post.client_id] ?? 0) + 1
    } else if (post.status === 'cliente_aprovacao') {
      aguardandoByClient[post.client_id] = (aguardandoByClient[post.client_id] ?? 0) + 1
    }
  }

  // ── Posts por cliente (mês de referência) ────────────────
  const postsByClient: Record<string, any[]> = {}
  for (const post of (rawPosts ?? []) as any[]) {
    if (!post.client_id) continue
    if (!postsByClient[post.client_id]) postsByClient[post.client_id] = []
    postsByClient[post.client_id].push(post)
  }

  // ── Auto-popular: pautas + posts + aprovação ──────────────
  const autoUpserts: any[] = []
  const rank: Record<string, number> = { concluido: 3, em_andamento: 2, pendente: 1 }
  const ETAPAS_PAUTA = Object.values(PAUTA_ETAPA)

  // 1. Pautas → etapas, agrupadas POR MÊS (cada mês constrói o seu próprio pipeline)
  const pautasByMonth: Record<string, any[]> = {}
  for (const pauta of (rawPautas ?? []) as any[]) {
    if (!pauta.client_id || pauta.status === 'cancelado' || !PAUTA_ETAPA[pauta.tipo]) continue
    const monthKey = pauta.data.slice(0, 7) + '-01'
    if (!pautasByMonth[monthKey]) pautasByMonth[monthKey] = []
    pautasByMonth[monthKey].push(pauta)
  }

  for (const [monthStr, monthPautas] of Object.entries(pautasByMonth)) {
    const bestByKey: Record<string, { status: string; data: string }> = {}
    for (const pauta of monthPautas) {
      const etapa = PAUTA_ETAPA[pauta.tipo]
      const key = `${pauta.client_id}__${etapa}`
      const existing = bestByKey[key]
      if (!existing || (rank[pauta.status] ?? 0) > (rank[existing.status] ?? 0)) {
        bestByKey[key] = { status: pauta.status, data: pauta.data }
      }
    }

    for (const [key, { status, data }] of Object.entries(bestByKey)) {
      const [clientId, etapa] = key.split('__')
      const pipelineStatus = status === 'concluido' ? 'concluido' : 'em_andamento'
      autoUpserts.push({
        client_id: clientId, mes: monthStr, etapa, status: pipelineStatus,
        notas: status === 'concluido' ? 'Auto: pauta concluída' : `Auto: pauta agendada para ${data}`,
      })
    }

    // Reseta etapas sem pauta para este mês
    for (const client of clients as any[]) {
      for (const etapa of ETAPAS_PAUTA) {
        if (!bestByKey[`${client.id}__${etapa}`]) {
          autoUpserts.push({ client_id: client.id, mes: monthStr, etapa, status: 'pendente', notas: 'Auto: sem pauta agendada' })
        }
      }
    }
  }

  // 2. Posts (só mês atual)
  for (const [clientId, posts] of Object.entries(postsByClient)) {
    if (posts.length > 0 && posts.every((p: any) => p.status === 'sm_postado')) {
      autoUpserts.push({ client_id: clientId, mes: refMonthStr, etapa: 'agendamento', status: 'concluido', notas: 'Auto: todos os posts publicados' })
    }
  }

  // 3. Aprovação (só mês atual)
  for (const client of clients as any[]) {
    const ajustes    = ajusteByClient[client.id] ?? 0
    const aguardando = aguardandoByClient[client.id] ?? 0
    const clientPosts = postsByClient[client.id] ?? []
    const allApproved = clientPosts.length > 0 && clientPosts.every((p: any) => p.status === 'sm_aprovado' || p.status === 'sm_postado')
    const status = ajustes > 0 ? 'bloqueado' : aguardando > 0 ? 'em_andamento' : allApproved ? 'concluido' : 'pendente'
    const notas = ajustes > 0
      ? `Auto: cliente pediu alteração em ${ajustes} material${ajustes > 1 ? 'is' : ''}`
      : aguardando > 0 ? `Auto: ${aguardando} material${aguardando > 1 ? 'is' : ''} aguardando aprovação`
      : allApproved ? 'Auto: todos os materiais aprovados' : 'Auto: materiais ainda não enviados'
    autoUpserts.push({ client_id: client.id, mes: refMonthStr, etapa: 'aprovacao', status, notas })
  }

  if (autoUpserts.length > 0) {
    await supabase.from('producao_mensal').upsert(autoUpserts, { onConflict: 'client_id,mes,etapa' })
  }

  const { data: finalProducao } = await supabase
    .from('producao_mensal').select('*')
    .gte('mes', pautaStart)
    .order('mes')

  return (
    <PipelineView
      clients={clients as Pick<Client, 'id' | 'name' | 'status' | 'responsible_ids'>[]}
      producao={(finalProducao as ProducaoMensal[]) ?? []}
      profiles={(rawProfiles as Pick<Profile, 'id' | 'name' | 'role' | 'avatar_color'>[]) ?? []}
      pautas={(rawPautas as any[]) ?? []}
      refMonthStr={refMonthStr}
      currentMonthStr={currentMonthStr}
      userRole={userRole}
      currentUserId={user!.id}
    />
  )
}
