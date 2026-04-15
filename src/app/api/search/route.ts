import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ clients: [], posts: [], tasks: [] })

  const like = `%${q}%`

  const [clientsRes, postsRes, tasksRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, niche, status')
      .ilike('name', like)
      .limit(5),
    supabase
      .from('posts')
      .select('id, title, client_id, status, clients(name)')
      .ilike('title', like)
      .limit(5),
    supabase
      .from('tasks')
      .select('id, title, client_id, status, clients(name)')
      .ilike('title', like)
      .limit(5),
  ])

  return NextResponse.json({
    clients: clientsRes.data ?? [],
    posts: postsRes.data ?? [],
    tasks: tasksRes.data ?? [],
  })
}
