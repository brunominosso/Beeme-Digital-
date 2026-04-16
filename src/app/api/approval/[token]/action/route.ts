import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const bodySchema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(['approve', 'adjust']),
  notes: z.string().max(1000).optional(),
})

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { taskId, action, notes } = body
  const supabase = adminClient()

  // Busca o cliente pelo token
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('approval_token', token)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // Verifica que o post pertence a este cliente e está em aprovação
  const { data: post } = await supabase
    .from('posts')
    .select('id, client_id, status, approval_notes_history')
    .eq('id', taskId)
    .eq('client_id', client.id)        // garante que o card é deste cliente
    .eq('status', 'cliente_aprovacao') // só age em cards em aprovação
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Card não encontrado ou não disponível para aprovação' }, { status: 404 })
  }

  if (action === 'approve') {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'sm_aprovado', approval_notes: null })
      .eq('id', taskId)

    if (error) {
      console.error('[approval] erro ao aprovar:', error.message)
      return NextResponse.json({ error: 'Erro ao aprovar. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, newStatus: 'sm_aprovado' })
  }

  // action === 'adjust'
  if (!notes || notes.trim().length === 0) {
    return NextResponse.json({ error: 'Descreva o que precisa ser ajustado.' }, { status: 400 })
  }

  // Versiona o histórico de ajustes
  const existingHistory = (post.approval_notes_history as { version: number; notes: string; date: string; reviewer: string }[]) ?? []
  const newEntry = {
    version: existingHistory.length + 1,
    notes: notes.trim(),
    date: new Date().toISOString().split('T')[0],
    reviewer: 'Cliente',
  }
  const updatedHistory = [...existingHistory, newEntry]

  const { error } = await supabase
    .from('posts')
    .update({
      status: 'design_ajuste',
      approval_notes: notes.trim(),
      approval_notes_history: updatedHistory,
    })
    .eq('id', taskId)

  if (error) {
    console.error('[approval] erro ao solicitar ajuste:', error.message)
    return NextResponse.json({ error: 'Erro ao enviar solicitação. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, newStatus: 'design_ajuste' })
}
