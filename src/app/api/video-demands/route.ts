import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { client_id, briefing, drive_material_link } = body

  if (!briefing?.trim() || !drive_material_link?.trim()) {
    return NextResponse.json({ error: 'Briefing e link do Drive são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase.from('video_demands').insert({
    client_id: client_id || null,
    created_by: user.id,
    briefing: briefing.trim(),
    drive_material_link: drive_material_link.trim(),
    status: 'pendente',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify all gestor/admin users
  const { data: gestors } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['gestor', 'admin'])
    .neq('id', user.id)

  if (gestors && gestors.length > 0) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single()

    const clientName = (clientData as any)?.name
    const notifMessage = clientName
      ? `Nova demanda de vídeo — ${clientName}`
      : 'Nova demanda de vídeo'

    await supabase.from('notifications').insert(
      gestors.map((g: any) => ({
        user_id: g.id,
        type: 'video_demand_new',
        title: 'Nova demanda de edição',
        message: notifMessage,
        data: { video_demand_id: data.id },
        read: false,
      }))
    )
  }

  return NextResponse.json({ demand: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id, status, drive_edited_link, notas } = body

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
  if (status) updatePayload.status = status
  if (drive_edited_link !== undefined) updatePayload.drive_edited_link = drive_edited_link || null
  if (notas !== undefined) updatePayload.notas = notas || null

  const { data, error } = await supabase
    .from('video_demands')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the demand creator when video is delivered
  if (status === 'entregue' && (data as any).created_by) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', (data as any).client_id)
      .single()

    const clientName = (clientData as any)?.name
    const notifMessage = clientName
      ? `Vídeo editado entregue — ${clientName}`
      : 'Vídeo editado entregue'

    await supabase.from('notifications').insert({
      user_id: (data as any).created_by,
      type: 'video_demand_delivered',
      title: 'Vídeo pronto!',
      message: notifMessage,
      data: { video_demand_id: id },
      read: false,
    })
  }

  return NextResponse.json({ demand: data })
}
