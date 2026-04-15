import { createClient } from '@/lib/supabase/server'
import PipelineView from '@/components/PipelineView'
import type { Client, Profile, ProducaoMensal } from '@/types/database'

export const dynamic = 'force-dynamic'

// Mapeamento: tipo de pauta → etapa do pipeline
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

  // Mês de referência: próximo mês
  const now = new Date()
  const refMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const refMonthStr = refMonth.toISOString().split('T')[0]
  const currentMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  // Intervalo de datas do mês de referência para buscar pautas
  const refStart = refMonthStr
  const refEnd = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: rawProfiles },
    { data: rawAllClients },
    { data: rawProducao },
    { data: rawPautas },
    { data: rawPosts },
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
  ])

  // IDs de Paloma (social_media) e Lorenzo (designer)
  const teamIds = (rawProfiles ?? [])
    .filter((p: any) => p.role === 'social_media' || p.role === 'designer')
    .map((p: any) => p.id)

  // Só clientes com Paloma ou Lorenzo como responsável
  const clients = (rawAllClients ?? []).filter((c: any) =>
    (c.responsible_ids ?? []).some((id: string) => teamIds.includes(id))
  )

  // ── Auto-popular: derivar status das pautas concluídas ──────
  const existingKeys = new Set(
    (rawProducao ?? []).map((r: any) => `${r.client_id}__${r.mes}__${r.etapa}`)
  )

  const autoInserts: any[] = []

  // 1. Pautas concluídas → etapas correspondentes
  for (const pauta of (rawPautas ?? []) as any[]) {
    const etapa = PAUTA_ETAPA[pauta.tipo]
    if (!etapa || !pauta.client_id) continue
    if (pauta.status !== 'concluido') continue
    const key = `${pauta.client_id}__${refMonthStr}__${etapa}`
    if (!existingKeys.has(key)) {
      autoInserts.push({
        client_id: pauta.client_id,
        mes: refMonthStr,
        etapa,
        status: 'concluido',
        notas: 'Auto: pauta concluída',
      })
      existingKeys.add(key)
    }
  }

  // 2. Posts todos agendados → etapa agendamento
  const postsByClient: Record<string, any[]> = {}
  for (const post of (rawPosts ?? []) as any[]) {
    if (!post.client_id) continue
    if (!postsByClient[post.client_id]) postsByClient[post.client_id] = []
    postsByClient[post.client_id].push(post)
  }
  for (const [clientId, posts] of Object.entries(postsByClient)) {
    const allPosted = posts.length > 0 && posts.every((p: any) => p.status === 'sm_postado')
    if (!allPosted) continue
    const key = `${clientId}__${refMonthStr}__agendamento`
    if (!existingKeys.has(key)) {
      autoInserts.push({
        client_id: clientId, mes: refMonthStr, etapa: 'agendamento',
        status: 'concluido', notas: 'Auto: todos os posts publicados',
      })
      existingKeys.add(key)
    }
  }

  // Inserir auto-derivados (upsert silencioso)
  if (autoInserts.length > 0) {
    await supabase.from('producao_mensal').upsert(autoInserts, {
      onConflict: 'client_id,mes,etapa',
      ignoreDuplicates: true,
    })
  }

  // Re-fetch após auto inserts
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
