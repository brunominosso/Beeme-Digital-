import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  // Verifica que quem chama é admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profileRole = (profileData as unknown as { role: string } | null)?.role
  if (profileRole !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { email, name, role, avatar_color } = await req.json()
  if (!email || !name || !role) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  // Guarda convite pendente
  await adminSupabase.from('pending_profiles').upsert({
    email, name, role, avatar_color: avatar_color || '#9FA4DB',
  }, { onConflict: 'email' })

  // Envia convite por email (magic link)
  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
