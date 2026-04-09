import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { runId, step, input } = body as {
    runId: string
    step: number
    input: Record<string, string>
  }

  const { data: rawRun } = await supabase
    .from('runs')
    .select('*, clients(*)')
    .eq('id', runId)
    .single()

  if (!rawRun) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

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
      getPrompt: () => carlosAnglesPrompt(client, input.newsBriefing),
    },
    3: {
      name: 'Roteiro do carrossel',
      agent: 'Carlos Conteúdo',
      getPrompt: () => carlosCarouselPrompt(client, input.selectedNews, input.selectedAngle),
    },
    4: {
      name: 'Humanização do copy',
      agent: 'Vítor Voz',
      getPrompt: () => vitorPrompt(client, input.carouselCopy),
    },
    5: {
      name: 'Script do Reel',
      agent: 'Rafael Roteiro',
      getPrompt: () => rafaelPrompt(client, input.carouselHumanized),
    },
    6: {
      name: 'Sequência de Stories',
      agent: 'Sabrina Sequência',
      getPrompt: () => sabrinaPrompt(client, input.carouselHumanized),
    },
    7: {
      name: 'Revisão de qualidade',
      agent: 'Tereza Tela',
      getPrompt: () => terezaPrompt(
        client,
        input.carouselHumanized,
        input.reelScript,
        input.storiesSequence
      ),
    },
  }

  const stepConfig = STEPS[step]
  if (!stepConfig) return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

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
        const msg = err instanceof Error ? err.message : 'Unknown error'
        await supabase
          .from('run_steps')
          .update({ status: 'failed', output: `Erro: ${msg}` })
          .eq('run_id', runId)
          .eq('step_number', step)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
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
