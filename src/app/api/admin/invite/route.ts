import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { rateLimit, getIP } from '@/lib/rate-limit'

const ALLOWED_ROLES = ['admin', 'social_media', 'designer', 'financeiro', 'closer'] as const

const inviteSchema = z.object({
  email: z.string().email('Email inválido').max(254),
  name: z.string().min(2).max(100).trim(),
  role: z.enum(ALLOWED_ROLES, { errorMap: () => ({ message: 'Role inválida' }) }),
  avatar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#9FA4DB'),
})

export async function POST(req: NextRequest) {
  // Rate limit: 5 convites por hora por IP
  const ip = getIP(req)
  const rl = rateLimit(`invite:${ip}`, { limit: 5, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Limite de convites atingido. Tente novamente mais tarde.' },
      { status: 429 }
    )
  }

  // Verifica autenticação
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Verifica que é admin
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profileRole = (profileData as { role: string } | null)?.role
  if (profileRole !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Valida e sanitiza o body
  let body: z.infer<typeof inviteSchema>
  try {
    body = inviteSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { email, name, role, avatar_color } = body

  // Admin client inicializado dentro do handler (não no módulo)
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Guarda convite pendente
  await adminSupabase.from('pending_profiles').upsert(
    { email, name, role, avatar_color },
    { onConflict: 'email' }
  )

  // Envia convite
  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
  })

  if (error) {
    // Log interno, não expõe detalhes
    console.error('[admin/invite] erro ao enviar convite:', error.message)
    return NextResponse.json({ error: 'Erro ao enviar convite. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
