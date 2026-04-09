'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Run, RunStep, Client } from '@/types/database'

const PIPELINE_STEPS = [
  { number: 1, name: 'Pesquisa de notícias', agent: 'Nuno Notícias', icon: '📰', desc: 'Pesquisa e ranqueia notícias/tendências' },
  { number: 2, name: 'Geração de ângulos', agent: 'Carlos Conteúdo', icon: '💡', desc: 'Cria 3 ângulos com drivers emocionais' },
  { number: 3, name: 'Roteiro do carrossel', agent: 'Carlos Conteúdo', icon: '✍️', desc: 'Escreve os 8 slides do carrossel' },
  { number: 4, name: 'Humanização do copy', agent: 'Vítor Voz', icon: '✨', desc: 'Remove padrões AI, adiciona ritmo humano' },
  { number: 5, name: 'Script do Reel', agent: 'Rafael Roteiro', icon: '🎬', desc: 'Cria roteiro de reel 15-30s com loop' },
  { number: 6, name: 'Sequência de Stories', agent: 'Sabrina Sequência', icon: '📱', desc: '5 frames com arco narrativo e interativo' },
  { number: 7, name: 'Revisão de qualidade', agent: 'Tereza Tela', icon: '✅', desc: 'Aprova ou lista o que precisa de revisão' },
]

// Checkpoints where user must approve before proceeding
const APPROVAL_STEPS = new Set([1, 2, 4])

type StepMap = Record<number, RunStep>

export default function PipelineRunner({
  run,
  client,
  initialSteps,
}: {
  run: Run
  client: Client
  initialSteps: RunStep[]
}) {
  const initialMap: StepMap = {}
  initialSteps.forEach(s => { initialMap[s.step_number] = s })

  const [steps, setSteps] = useState<StepMap>(initialMap)
  const [streamingStep, setStreamingStep] = useState<number | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [activeStep, setActiveStep] = useState(
    run.current_step > 0 ? run.current_step : 1
  )

  // Approval/selection state
  const [selectedNews, setSelectedNews] = useState('')
  const [selectedAngle, setSelectedAngle] = useState('')
  const [editedCopy, setEditedCopy] = useState('')
  const [approvalNotes, setApprovalNotes] = useState<Record<number, string>>({})

  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [streamingText])

  const getStepInput = useCallback((step: number): Record<string, string> => {
    switch (step) {
      case 1: return {}
      case 2: return { newsBriefing: selectedNews || steps[1]?.output || '' }
      case 3: return {
        selectedNews: selectedNews || steps[1]?.output || '',
        selectedAngle: selectedAngle || steps[2]?.output || '',
      }
      case 4: return { carouselCopy: steps[3]?.output || '' }
      case 5: return { carouselHumanized: editedCopy || steps[4]?.output || '' }
      case 6: return { carouselHumanized: editedCopy || steps[4]?.output || '' }
      case 7: return {
        carouselHumanized: editedCopy || steps[4]?.output || '',
        reelScript: steps[5]?.output || '',
        storiesSequence: steps[6]?.output || '',
      }
      default: return {}
    }
  }, [steps, selectedNews, selectedAngle, editedCopy])

  async function runStep(step: number) {
    setStreamingStep(step)
    setStreamingText('')
    setActiveStep(step)

    const input = getStepInput(step)
    let fullOutput = ''

    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: run.id, step, input }),
      })

      if (!res.ok) throw new Error('Failed to start step')
      if (!res.body) throw new Error('No stream body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) {
              fullOutput += data.text
              setStreamingText(fullOutput)
            }
            if (data.done) {
              setSteps(prev => ({
                ...prev,
                [step]: {
                  ...(prev[step] || {} as RunStep),
                  step_number: step,
                  output: data.output,
                  status: 'completed',
                } as RunStep,
              }))
              // Auto-preenche os campos de aprovação
              if (step === 1) setSelectedNews(data.output)
              if (step === 2) setSelectedAngle(data.output)
              if (step === 4) setEditedCopy(data.output)
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      // Garante que o output fica guardado mesmo que o evento done falhe
      if (fullOutput) {
        setSteps(prev => ({
          ...prev,
          [step]: {
            ...(prev[step] || {} as RunStep),
            step_number: step,
            output: fullOutput,
            status: 'completed',
          } as RunStep,
        }))
        if (step === 1 && !selectedNews) setSelectedNews(fullOutput)
        if (step === 2 && !selectedAngle) setSelectedAngle(fullOutput)
        if (step === 4 && !editedCopy) setEditedCopy(fullOutput)
      }
      setStreamingStep(null)
    }
  }

  const step1Done = steps[1]?.status === 'completed'
  const step2Done = steps[2]?.status === 'completed'
  const step3Done = steps[3]?.status === 'completed'
  const step4Done = steps[4]?.status === 'completed'
  const step5Done = steps[5]?.status === 'completed'
  const step6Done = steps[6]?.status === 'completed'
  const step7Done = steps[7]?.status === 'completed'

  function canRunStep(step: number): boolean {
    if (streamingStep !== null) return false
    switch (step) {
      case 1: return !steps[1] || steps[1].status === 'failed'
      case 2: return step1Done && !!selectedNews
      case 3: return step2Done && !!selectedAngle
      case 4: return step3Done
      case 5: return step4Done
      case 6: return step4Done
      case 7: return step5Done && step6Done
      default: return false
    }
  }

  const activeStepData = steps[activeStep]
  const isStreaming = streamingStep === activeStep
  const displayText = isStreaming ? streamingText : (activeStepData?.output || '')

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Left: steps list */}
      <div className="w-72 border-r flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>PIPELINE</p>
          <p className="font-semibold text-white text-sm truncate">{run.topic || `Roteiro — ${client.name}`}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {PIPELINE_STEPS.map((s, idx) => {
            const stepData = steps[s.number]
            const status = streamingStep === s.number ? 'running' : (stepData?.status || 'pending')
            const isActive = activeStep === s.number
            const needsApproval = APPROVAL_STEPS.has(s.number) && status === 'completed'

            return (
              <button key={s.number} onClick={() => setActiveStep(s.number)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors"
                style={{
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                }}>
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <StepIcon status={status} icon={s.icon} />
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="w-px h-4 mt-1" style={{ background: 'var(--border)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none" style={{ color: isActive ? 'white' : 'var(--text)' }}>
                    {s.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{s.agent}</p>
                  {needsApproval && (
                    <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: '#f59e0b20', color: 'var(--warning)' }}>
                      Aguarda aprovação
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: step detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-semibold text-white">
              {PIPELINE_STEPS[activeStep - 1]?.icon} {PIPELINE_STEPS[activeStep - 1]?.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {PIPELINE_STEPS[activeStep - 1]?.desc}
            </p>
          </div>
          <div className="flex gap-2">
            {canRunStep(activeStep) && (
              <button onClick={() => runStep(activeStep)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}>
                {steps[activeStep] ? '↺ Regenerar' : '▶ Executar'}
              </button>
            )}
            {streamingStep === activeStep && (
              <div className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                A gerar...
              </div>
            )}
          </div>
        </div>

        {/* Approval UI for step 1 */}
        {activeStep === 1 && step1Done && !streamingStep && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-2 text-white">Seleciona a notícia/tema para o roteiro:</p>
            <textarea
              value={selectedNews}
              onChange={e => setSelectedNews(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              placeholder="Cola aqui a notícia/tendência selecionada do output do Nuno..."
            />
            {selectedNews && (
              <button onClick={() => { setActiveStep(2); runStep(2) }}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--success)' }}>
                ✓ Confirmar e gerar ângulos →
              </button>
            )}
          </div>
        )}

        {/* Approval UI for step 2 */}
        {activeStep === 2 && step2Done && !streamingStep && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-2 text-white">Seleciona o ângulo aprovado:</p>
            <textarea
              value={selectedAngle}
              onChange={e => setSelectedAngle(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              placeholder="Cola aqui o ângulo escolhido do output do Carlos..."
            />
            {selectedAngle && (
              <button onClick={() => { setActiveStep(3); runStep(3) }}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--success)' }}>
                ✓ Confirmar e gerar carrossel →
              </button>
            )}
          </div>
        )}

        {/* Approval UI for step 4 */}
        {activeStep === 4 && step4Done && !streamingStep && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-2 text-white">Revisa e edita o copy humanizado:</p>
            <textarea
              value={editedCopy || steps[4]?.output || ''}
              onChange={e => setEditedCopy(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none font-mono text-xs"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setActiveStep(5); runStep(5) }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--success)' }}>
                ✓ Aprovado → Gerar Reel
              </button>
              <button onClick={() => { setActiveStep(6); runStep(6) }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                → Gerar Stories
              </button>
            </div>
          </div>
        )}

        {/* Step 3 done → auto-proceed prompt */}
        {activeStep === 3 && step3Done && !step4Done && !streamingStep && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => { setActiveStep(4); runStep(4) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
              → Humanizar copy com Vítor
            </button>
          </div>
        )}

        {/* Step 5+6 done → review prompt */}
        {step5Done && step6Done && !step7Done && !streamingStep && (
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => { setActiveStep(7); runStep(7) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}>
              → Revisão final com Tereza
            </button>
          </div>
        )}

        {/* Output area */}
        <div ref={outputRef} className="flex-1 overflow-y-auto px-6 py-6">
          {!displayText && !streamingStep && (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <p className="text-4xl mb-3">{PIPELINE_STEPS[activeStep - 1]?.icon}</p>
                <p className="font-medium text-white">{PIPELINE_STEPS[activeStep - 1]?.name}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {canRunStep(activeStep) ? 'Clica em Executar para começar' : 'Aguarda os passos anteriores'}
                </p>
              </div>
            </div>
          )}

          {displayText && (
            <div className="agent-output whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {displayText}
              {isStreaming && <span className="inline-block w-2 h-4 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--accent)' }} />}
            </div>
          )}
        </div>

        {/* Step navigation */}
        <div className="px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveStep(s => Math.max(1, s - 1))}
            disabled={activeStep === 1}
            className="text-sm disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>
            ← Anterior
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Passo {activeStep} de {PIPELINE_STEPS.length}
          </span>
          <button
            onClick={() => setActiveStep(s => Math.min(PIPELINE_STEPS.length, s + 1))}
            disabled={activeStep === PIPELINE_STEPS.length}
            className="text-sm disabled:opacity-30" style={{ color: 'var(--text-muted)' }}>
            Próximo →
          </button>
        </div>
      </div>
    </div>
  )
}

function StepIcon({ status, icon }: { status: string; icon: string }) {
  if (status === 'running') {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs animate-spin"
        style={{ background: 'var(--accent)20', border: '2px solid var(--accent)', borderTopColor: 'transparent' }}>
      </div>
    )
  }
  if (status === 'completed') {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
        style={{ background: 'var(--success)20', border: '1px solid var(--success)', color: 'var(--success)' }}>
        ✓
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
        style={{ background: 'var(--danger)20', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
        ✗
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {icon}
    </div>
  )
}
