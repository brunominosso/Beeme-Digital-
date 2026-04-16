import { createClient } from '@/lib/supabase/server'
import PipelineView from '@/components/PipelineView'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

const PAUTA_ETAPA: Record<string, string> = {
  planejamento:  'planejamento',
  captacao:      'captacao',
  edicao_video:  'edicao',
  edicao_cards:  'design',
  aprovacao:     'revisao',
  agendamento:   'agendamento',
}

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  const userRole = (rawProfile as any)?.role ?? 'social_media'

  const now = new Date()
  const refMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const refMonthStr = refMonth.toISOString().split('T')[0]
  const currentMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const refStart = refMonthStr
  const refEnd = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: rawProfiles },
    { data: rawAllClients },
    { data: rawProducao },
    { data: rawPautas },
    { data: rawPosts },
    { data: rawAjustePosts }, // posts em design_ajuste (qualquer data — alterações são do ciclo atual)
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, role, avatar_color')
      .in('role', ['social_media', 'designer', 'admin', 'gestor']),
    supabase.from('clients').select('id, name, status, responsible_ids')
      .eq('status', 'ativo').order('name'),
    supabase.from('producao_mensal').select('*').in('mes', [refMonthStr, currentMonthStr]),
    supabase.from('pautas').select('client_id, tipo, status')
      .gte('data', refStart).lte('data', refEnd),
    supabase.from('posts').select('client_id, status, publish_date')
      .gte('publish_date', refStart).lte('publish_date', refEnd),
    // Posts em ajuste — sem filtro de data para capturar ciclo atual
    supabase.from('posts').select('client_id, status')
      .eq('status', 'design_ajuste'),
  ])

  const teamIds = (rawProfiles ?? [])
    .filter((p: any) => p.role === 'social_media' || p.role === 'designer')
    .map((p: any) => p.id)

  const clients = (rawAllClients ?? []).filter((c: any) =>
    (c.responsible_ids ?? []).some((id: string) => teamIds.includes(id))
  )

  // ── Contagem de posts em ajuste por cliente ──────────────
  const ajusteCount: Record<string, number> = {}
  for (const post of (rawAjustePosts ?? []) as any[]) {
    if (!post.client_id) continue
    ajusteCount[post.client_id] = (ajusteCount[post.client_id] ?? 0) + 1
  }

  // ── Posts por cliente (mês de referência) ────────────────
  const postsByClient: Record<string, any[]> = {}
  for (const post of (rawPosts ?? []) as any[]) {
    if (!post.client_id) continue
    if (!postsByClient[post.client_id]) postsByClient[post.client_id] = []
    postsByClient[post.client_id].push(post)
  }

  // ── Auto-popular: pautas concluídas + posts + alterações ──
  const existingKeys = new Set(
    (rawProducao ?? []).map((r: any) => `${r.client_id}__${r.mes}__${r.etapa}`)
  )

  const autoUpserts: any[] = []

  // 1. Pautas concluídas → etapas
  for (const pauta of (rawPautas ?? []) as any[]) {
    const etapa = PAUTA_ETAPA[pauta.tipo]
    if (!etapa || !pauta.client_id || pauta.status !== 'concluido') continue
    autoUpserts.push({
      client_id: pauta.client_id, mes: refMonthStr, etapa,
      status: 'concluido', notas: 'Auto: pauta concluída',
    })
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

  // 3. Alterações — semáforo baseado em posts em design_ajuste (workload do designer)
  for (const client of clients as any[]) {
    const count = ajusteCount[client.id] ?? 0
    let status: string
    let notas: string

    if (count === 0) {
      status = 'concluido'
      notas = 'Auto: sem alterações pendentes'
    } else if (count <= 2) {
      status = 'em_andamento'
      notas = `Auto: ${count} post${count > 1 ? 's' : ''} em ajuste pelo designer`
    } else {
      status = 'bloqueado'
      notas = `Auto: ${count} posts em ajuste — atenção necessária`
    }

    autoUpserts.push({
      client_id: client.id, mes: refMonthStr, etapa: 'alteracoes',
      status, notas,
    })
  }

  // 4. Revisão — estado de aprovação do cliente
  // Inicia sempre como verde. Fica amarelo quando cliente pede alteração no link de aprovação.
  // Volta ao verde quando todos os posts são aprovados.
  for (const client of clients as any[]) {
    const ajustes = ajusteCount[client.id] ?? 0
    const clientPosts = postsByClient[client.id] ?? []
    const allApproved = clientPosts.length > 0 &&
      clientPosts.every((p: any) => p.status === 'sm_aprovado' || p.status === 'sm_postado')

    let status: string
    let notas: string

    if (ajustes > 0) {
      // Cliente pediu alteração(ões) — alerta
      status = 'em_andamento'
      notas = `Auto: cliente pediu alteração em ${ajustes} material${ajustes > 1 ? 'is' : ''}`
    } else if (allApproved) {
      status = 'concluido'
      notas = 'Auto: todos os materiais aprovados pelo cliente'
    } else {
      // Nenhum ajuste pendente e ainda não totalmente aprovado — verde por omissão
      status = 'concluido'
      notas = 'Auto: sem pedidos de alteração'
    }

    autoUpserts.push({
      client_id: client.id, mes: refMonthStr, etapa: 'revisao',
      status, notas,
    })
  }

  // Upsert tudo (sobrescreve registros existentes para manter status atualizado)
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
      refMonthStr={refMonthStr}
      currentMonthStr={currentMonthStr}
      userRole={userRole}
      currentUserId={user!.id}
    />
  )
}
