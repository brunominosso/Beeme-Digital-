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

  // 1. Pautas → etapas
  // Agrupa por client+etapa, pega o melhor status (concluido > em_andamento > pendente)
  const pautaBestByKey: Record<string, { status: string; data: string }> = {}
  const rank: Record<string, number> = { concluido: 3, em_andamento: 2, pendente: 1 }
  for (const pauta of (rawPautas ?? []) as any[]) {
    const etapa = PAUTA_ETAPA[pauta.tipo]
    if (!etapa || !pauta.client_id || pauta.status === 'cancelado') continue
    const key = `${pauta.client_id}__${etapa}`
    const existing = pautaBestByKey[key]
    if (!existing || (rank[pauta.status] ?? 0) > (rank[existing.status] ?? 0)) {
      pautaBestByKey[key] = { status: pauta.status, data: pauta.data }
    }
  }

  // Etapas mapeadas a pautas (aprovacao é controlada pelos posts, não por pauta)
  const ETAPAS_PAUTA = Object.values(PAUTA_ETAPA)

  for (const [key, { status, data }] of Object.entries(pautaBestByKey)) {
    const [clientId, etapa] = key.split('__')
    const pipelineStatus = status === 'concluido' ? 'concluido' : 'em_andamento'
    const notas = status === 'concluido'
      ? 'Auto: pauta concluída'
      : `Auto: pauta agendada para ${data}`
    autoUpserts.push({ client_id: clientId, mes: refMonthStr, etapa, status: pipelineStatus, notas })
  }

  // Reseta para "pendente" todas as etapas de cliente que NÃO têm pauta no mês
  // Isto garante que pautas apagadas limpam o pipeline corretamente
  for (const client of clients as any[]) {
    for (const etapa of ETAPAS_PAUTA) {
      const key = `${client.id}__${etapa}`
      if (!pautaBestByKey[key]) {
        autoUpserts.push({
          client_id: client.id, mes: refMonthStr, etapa,
          status: 'pendente', notas: 'Auto: sem pauta agendada',
        })
      }
    }
  }

  // 2. Posts todos publicados → agendamento concluído
  for (const [clientId, posts] of Object.entries(postsByClient)) {
    if (posts.length > 0 && posts.every((p: any) => p.status === 'sm_postado')) {
      autoUpserts.push({
        client_id: clientId, mes: refMonthStr, etapa: 'agendamento',
        status: 'concluido', notas: 'Auto: todos os posts publicados',
      })
    }
  }

  // 3. Aprovação — ciclo completo com o cliente
  for (const client of clients as any[]) {
    const ajustes    = ajusteByClient[client.id] ?? 0
    const aguardando = aguardandoByClient[client.id] ?? 0
    const clientPosts = postsByClient[client.id] ?? []
    const allApproved = clientPosts.length > 0 &&
      clientPosts.every((p: any) => p.status === 'sm_aprovado' || p.status === 'sm_postado')

    let status: string
    let notas: string

    if (ajustes > 0) {
      status = 'bloqueado'
      notas = `Auto: cliente pediu alteração em ${ajustes} material${ajustes > 1 ? 'is' : ''}`
    } else if (aguardando > 0) {
      status = 'em_andamento'
      notas = `Auto: ${aguardando} material${aguardando > 1 ? 'is' : ''} aguardando aprovação do cliente`
    } else if (allApproved) {
      status = 'concluido'
      notas = 'Auto: todos os materiais aprovados pelo cliente'
    } else {
      status = 'pendente'
      notas = 'Auto: materiais ainda não enviados para aprovação'
    }

    autoUpserts.push({ client_id: client.id, mes: refMonthStr, etapa: 'aprovacao', status, notas })
  }

  if (autoUpserts.length > 0) {
    await supabase.from('producao_mensal').upsert(autoUpserts, {
      onConflict: 'client_id,mes,etapa',
    })
  }

  const { data: finalProducao } = await supabase
    .from('producao_mensal').select('*').in('mes', [refMonthStr, currentMonthStr])

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
