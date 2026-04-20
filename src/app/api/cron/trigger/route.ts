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

// Manual trigger — só admins autenticados podem usar
// POST /api/cron/trigger com body { date?: "YYYY-MM-DD", dayOverride?: 0-6 }
export async function POST(req: NextRequest) {
  const supabase = adminClient()

  // Verifica sessão via cookie
  const { createServerClient } = await import('@supabase/ssr')
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await authClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  const today = new Date()
  const brasiliaOffset = -3 * 60
  const localTime = new Date(today.getTime() + brasiliaOffset * 60000)
  const dayOfWeek = body.dayOverride !== undefined ? Number(body.dayOverride) : localTime.getUTCDay()
  const todayDate = body.date ?? localTime.toISOString().split('T')[0]

  const { data: templates, error: templatesError } = await supabase
    .from('task_templates')
    .select('*')
    .eq('cadencia_ativa', true)
    .eq('cadencia_dia', dayOfWeek)

  if (templatesError) return NextResponse.json({ error: templatesError.message }, { status: 500 })
  if (!templates || templates.length === 0) {
    return NextResponse.json({ created: 0, message: `Nenhum modelo com cadência para o dia ${dayOfWeek}`, dayOfWeek })
  }

  const { data: activeClients } = await supabase
    .from('clients')
    .select('id, name')
    .in('status', ['ativo', 'active'])
    .order('name')

  const clientChecklist = (activeClients ?? []).length > 0
    ? '\n' + (activeClients ?? []).map(c => `- [ ] ${c.name}`).join('\n')
    : ''

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

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({
    created: created?.length ?? 0,
    tasks: created?.map(t => t.title),
    date: todayDate,
    dayOfWeek,
  })
}
