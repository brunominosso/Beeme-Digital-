import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getIP } from '@/lib/rate-limit'
import {
  nunoPrompt,
  carlosAnglesPrompt,
  carlosCarouselPrompt,
  vitorPrompt,
  rafaelPrompt,
  sabrinaPrompt,
  terezaPrompt,
} from '@/lib/agents/prompts'
import type { Run, Client } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type RunWithClient = Run & { clients: Client }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  runId: z.string().regex(UUID_REGEX, 'runId inválido'),
  step: z.number().int().min(1).max(7),
  input: z.record(z.string(), z.string().max(50000)).default({}),
})

export async function POST(req: NextRequest) {
  // Rate limit: 20 chamadas por minuto por IP
  const ip = getIP(req)
  const rl = rateLimit(`pipeline:${ip}`, { limit: 20, windowSec: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Valida body com Zod
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { runId, step, input } = body

  // Busca o run verificando ownership: só retorna se pertence ao usuário autenticado
  const { data: rawRun } = await supabase
    .from('runs')
    .select('*, clients(*)')
    .eq('id', runId)
    .eq('user_id', user.id)  // ← ownership check
    .single()

  if (!rawRun) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const run = rawRun as unknown as RunWithClient
  const client = run.clients

  const STEPS: Record<number, { name: string; agent: string; getPrompt: () => string }> = {
    1: {
      name: 'Pesquisa de notícias',
      agent: 'Nuno Notícias',
      getPrompt: () => nunoPrompt(client, run.topic || '', run.mode),
    },
    2: {
      name: 'Geração de ângulos',
      agent: 'Carlos Conteúdo',
      getPrompt: () => carlosAnglesPrompt(client, input.newsBriefing ?? ''),
    },
    3: {
      name: 'Roteiro do carrossel',
      agent: 'Carlos Conteúdo',
      getPrompt: () => carlosCarouselPrompt(client, input.selectedNews ?? '', input.selectedAngle ?? ''),
    },
    4: {
      name: 'Humanização do copy',
      agent: 'Vítor Voz',
      getPrompt: () => vitorPrompt(client, input.carouselCopy ?? ''),
    },
    5: {
      name: 'Script do Reel',
      agent: 'Rafael Roteiro',
      getPrompt: () => rafaelPrompt(client, input.carouselHumanized ?? ''),
    },
    6: {
      name: 'Sequência de Stories',
      agent: 'Sabrina Sequência',
      getPrompt: () => sabrinaPrompt(client, input.carouselHumanized ?? ''),
    },
    7: {
      name: 'Revisão de qualidade',
      agent: 'Tereza Tela',
      getPrompt: () => terezaPrompt(
        client,
        input.carouselHumanized ?? '',
        input.reelScript ?? '',
        input.storiesSequence ?? ''
      ),
    },
  }

  const stepConfig = STEPS[step]
  if (!stepConfig) return NextResponse.json({ error: 'Step inválido' }, { status: 400 })

  // Create/update step record
  const { data: existingStep } = await supabase
    .from('run_steps')
    .select('id')
    .eq('run_id', runId)
    .eq('step_number', step)
    .single()

  if (existingStep) {
    await supabase.from('run_steps').update({ status: 'running', output: null }).eq('id', existingStep.id)
  } else {
    await supabase.from('run_steps').insert({
      run_id: runId,
      step_number: step,
      step_name: stepConfig.name,
      agent_name: stepConfig.agent,
      status: 'running',
      input: input as Record<string, string>,
    })
  }

  await supabase.from('runs').update({ status: 'running', current_step: step }).eq('id', runId)

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullOutput = ''

      try {
        const claudeStream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{ role: 'user', content: stepConfig.getPrompt() }],
        })

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text
            fullOutput += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }

        await supabase
          .from('run_steps')
          .update({ status: 'completed', output: fullOutput })
          .eq('run_id', runId)
          .eq('step_number', step)

        await supabase.from('runs').update({ status: 'waiting_approval', current_step: step }).eq('id', runId)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, output: fullOutput })}\n\n`))
      } catch (err) {
        // Log interno — não expõe detalhes ao cliente
        console.error('[pipeline/run] erro interno:', err)

        await supabase
          .from('run_steps')
          .update({ status: 'failed', output: 'Erro interno no processamento.' })
          .eq('run_id', runId)
          .eq('step_number', step)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Erro interno. Tente novamente.' })}\n\n`))
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
