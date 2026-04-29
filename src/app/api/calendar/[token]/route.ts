import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyCalendarToken } from '@/lib/calendar-token'

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '🔴',
  high:   '🟠',
  medium: '🟡',
  low:    '⚪',
}

const TIPO_LABEL: Record<string, string> = {
  social_media: 'Social Media',
  designer:     'Design',
  videomaker:   'Vídeo',
  captacao:     'Captação',
}

const TURNO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

function icalDate(dateStr: string, timeStr?: string | null): string {
  const d = dateStr.replace(/-/g, '')
  if (timeStr) {
    const t = timeStr.replace(/:/g, '').slice(0, 6)
    return `${d}T${t}00`
  }
  return d
}

function icalNextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatDtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const userId = verifyCalendarToken(token)

  if (!userId) {
    return new NextResponse('Token inválido', { status: 401 })
  }

  const supabase = await createClient()

  const [{ data: tasks }, { data: profile }, { data: clients }, { data: pautas }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('assignee_id', userId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('profiles').select('name').eq('id', userId).single(),
    supabase.from('clients').select('id, name'),
    supabase
      .from('pautas')
      .select('*')
      .eq('assignee_id', userId)
      .neq('status', 'cancelado')
      .order('data', { ascending: true }),
  ])

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]))
  const userName = (profile as any)?.name ?? 'Equipa'
  const dtstamp = formatDtstamp()

  const taskEvents = (tasks ?? []).map((task: any) => {
    const emoji = PRIORITY_EMOJI[task.priority] ?? '⚪'
    const clientName = task.client_id ? clientMap[task.client_id] : null
    const title = clientName
      ? `${emoji} ${task.title} — ${clientName}`
      : `${emoji} ${task.title}`

    const descParts: string[] = []
    if (task.description) descParts.push(task.description)
    if (clientName) descParts.push(`Cliente: ${clientName}`)
    descParts.push(`Prioridade: ${task.priority}`)
    const description = escapeIcal(descParts.join('\\n'))

    let dtstart: string
    let dtend: string
    let allDay: boolean

    if (task.due_date) {
      allDay = !task.due_time
      if (allDay) {
        // Multi-day: starts today (or due_date if already overdue), ends on due_date
        const now = new Date()
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        dtstart = icalDate(todayStr <= task.due_date ? todayStr : task.due_date)
        dtend   = icalNextDay(task.due_date)
      } else {
        dtstart = icalDate(task.due_date, task.due_time)
        dtend   = icalDate(task.due_date, task.due_time)
      }
    } else {
      // Sem prazo: evento all-day no dia de hoje + 7 dias
      const fallback = new Date()
      fallback.setDate(fallback.getDate() + 7)
      const fb = `${fallback.getFullYear()}${String(fallback.getMonth() + 1).padStart(2, '0')}${String(fallback.getDate()).padStart(2, '0')}`
      dtstart = fb
      dtend   = fb
      allDay  = true
    }

    const dtStartLine = allDay
      ? `DTSTART;VALUE=DATE:${dtstart}`
      : `DTSTART;TZID=America/Sao_Paulo:${dtstart}`
    const dtEndLine = allDay
      ? `DTEND;VALUE=DATE:${dtend}`
      : `DTEND;TZID=America/Sao_Paulo:${dtend}`

    return [
      'BEGIN:VEVENT',
      `UID:task-${task.id}@beemedigital`,
      `DTSTAMP:${dtstamp}`,
      dtStartLine,
      dtEndLine,
      `SUMMARY:${escapeIcal(title)}`,
      `DESCRIPTION:${description}`,
      'STATUS:NEEDS-ACTION',
      'END:VEVENT',
    ].join('\r\n')
  })

  const pautaEvents = (pautas ?? []).map((pauta: any) => {
    const clientName = pauta.client_id ? clientMap[pauta.client_id] : null
    const tipoLabel = TIPO_LABEL[pauta.tipo] ?? pauta.tipo
    const turnoLabel = TURNO_LABEL[pauta.turno] ?? pauta.turno

    const title = clientName
      ? `📋 ${tipoLabel} — ${clientName}`
      : `📋 ${tipoLabel}`

    const descParts: string[] = []
    if (clientName) descParts.push(`Cliente: ${clientName}`)
    descParts.push(`Turno: ${turnoLabel}`)
    descParts.push(`Tipo: ${tipoLabel}`)
    if (pauta.notas) descParts.push(`Notas: ${pauta.notas}`)
    const description = escapeIcal(descParts.join('\\n'))

    return [
      'BEGIN:VEVENT',
      `UID:pauta-${pauta.id}@beemedigital`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icalDate(pauta.data)}`,
      `DTEND;VALUE=DATE:${icalNextDay(pauta.data)}`,
      `SUMMARY:${escapeIcal(title)}`,
      `DESCRIPTION:${description}`,
      'STATUS:NEEDS-ACTION',
      'END:VEVENT',
    ].join('\r\n')
  })

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Beeme Digital//Sistema//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Beeme — ${escapeIcal(userName)}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...taskEvents,
    ...pautaEvents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="beeme.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
