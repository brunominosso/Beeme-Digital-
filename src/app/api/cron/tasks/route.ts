import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  // Vercel injeta CRON_SECRET automaticamente — rejeita chamadas não autorizadas
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()

  const today = new Date()
  // Ajusta para timezone de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60
  const localTime = new Date(today.getTime() + brasiliaOffset * 60000)
  const dayOfWeek = localTime.getUTCDay() // 0=Dom, 1=Seg, ..., 6=Sab
  const todayDate = localTime.toISOString().split('T')[0]

  // Busca modelos com cadência ativa para o dia de hoje
  const { data: templates, error: templatesError } = await supabase
    .from('task_templates')
    .select('*')
    .eq('cadencia_ativa', true)
    .eq('cadencia_dia', dayOfWeek)

  if (templatesError) {
    return NextResponse.json({ error: templatesError.message }, { status: 500 })
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json({ created: 0, message: 'Nenhum modelo com cadência para hoje' })
  }

  // Busca clientes ativos para montar o checklist
  const { data: activeClients } = await supabase
    .from('clients')
    .select('id, name')
    .in('status', ['ativo', 'active'])
    .order('name')

  const clientChecklist = (activeClients ?? []).length > 0
    ? '\n' + (activeClients ?? []).map(c => `- [ ] ${c.name}`).join('\n')
    : ''

  // Busca a posição mais alta para colocar as novas tarefas no topo
  const { data: topTask } = await supabase
    .from('tasks')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const basePosition = (topTask?.position ?? 0) + 1000

  const tasksToCreate = templates.map((t, i) => ({
    title: t.title,
    description: t.description ? t.description + clientChecklist : clientChecklist || null,
    priority: t.priority,
    assignee_id: t.assignee_id ?? null,
    status: 'sm_novo',
    due_date: todayDate,
    position: basePosition + i * 100,
  }))

  const { data: created, error: insertError } = await supabase
    .from('tasks')
    .insert(tasksToCreate)
    .select('id, title')

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    created: created?.length ?? 0,
    tasks: created?.map(t => t.title),
    date: todayDate,
    dayOfWeek,
  })
}
