'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Objective, KeyResult, Profile } from '@/types/database'

type ObjectiveWithKRs = Objective & { keyResults: KeyResult[] }

const PERIODS = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'Anual 2026']

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ProgressBar({ value, target, color = 'var(--lavanda)' }: { value: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : color }} />
      </div>
      <span className="text-xs font-semibold w-9 text-right shrink-0"
        style={{ color: pct >= 100 ? 'var(--success)' : 'var(--text-muted)' }}>
        {pct}%
      </span>
    </div>
  )
}

export default function GoalsView({
  initialObjectives,
  initialKeyResults,
  profiles,
}: {
  initialObjectives: Objective[]
  initialKeyResults: KeyResult[]
  profiles: Profile[]
}) {
  const [objectives, setObjectives] = useState(initialObjectives)
  const [keyResults, setKeyResults] = useState(initialKeyResults)
  const [activePeriod, setActivePeriod] = useState(PERIODS[1])

  // Objective modal
  const [showObjForm, setShowObjForm] = useState(false)
  const [oTitle, setOTitle] = useState('')
  const [oDesc, setODesc] = useState('')
  const [oOwner, setOOwner] = useState('')
  const [oPeriod, setOPeriod] = useState(PERIODS[1])
  const [oDue, setODue] = useState('')
  const [oSaving, setOSaving] = useState(false)

  // KR modal
  const [showKRForm, setShowKRForm] = useState<string | null>(null) // objective_id
  const [krTitle, setKRTitle] = useState('')
  const [krTarget, setKRTarget] = useState('100')
  const [krUnit, setKRUnit] = useState('%')
  const [krSaving, setKRSaving] = useState(false)

  // KR inline edit
  const [editingKR, setEditingKR] = useState<string | null>(null)
  const [editVal, setEditVal] = useState('')

  const filteredObjectives = objectives.filter(o => o.period === activePeriod && o.status !== 'cancelled')

  const objectivesWithKRs: ObjectiveWithKRs[] = filteredObjectives.map(o => ({
    ...o,
    keyResults: keyResults.filter(kr => kr.objective_id === o.id),
  }))

  function objectiveProgress(krs: KeyResult[]) {
    if (krs.length === 0) return 0
    const total = krs.reduce((sum, kr) => sum + Math.min(100, (kr.current_value / kr.target_value) * 100), 0)
    return Math.round(total / krs.length)
  }

  async function saveObjective() {
    if (!oTitle.trim()) return
    setOSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('objectives').insert({
      title: oTitle,
      description: oDesc || null,
      owner_id: oOwner || null,
      period: oPeriod,
      due_date: oDue || null,
      created_by: user?.id,
    }).select().single()

    if (!error && data) {
      setObjectives(prev => [data as Objective, ...prev])
      setActivePeriod(oPeriod)
      setShowObjForm(false)
      setOTitle(''); setODesc(''); setOOwner(''); setOPeriod(PERIODS[1]); setODue('')
    }
    setOSaving(false)
  }

  async function saveKR() {
    if (!krTitle.trim() || !showKRForm) return
    setKRSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('key_results').insert({
      objective_id: showKRForm,
      title: krTitle,
      target_value: Number(krTarget) || 100,
      unit: krUnit || '%',
      current_value: 0,
    }).select().single()

    if (!error && data) {
      setKeyResults(prev => [...prev, data as KeyResult])
      setShowKRForm(null)
      setKRTitle(''); setKRTarget('100'); setKRUnit('%')
    }
    setKRSaving(false)
  }

  async function updateKRValue(kr: KeyResult, newVal: number) {
    const supabase = createClient()
    await supabase.from('key_results').update({ current_value: newVal }).eq('id', kr.id)
    setKeyResults(prev => prev.map(k => k.id === kr.id ? { ...k, current_value: newVal } : k))
    setEditingKR(null)
  }

  async function toggleObjectiveStatus(obj: Objective) {
    const newStatus = obj.status === 'completed' ? 'active' : 'completed'
    const supabase = createClient()
    await supabase.from('objectives').update({ status: newStatus }).eq('id', obj.id)
    setObjectives(prev => prev.map(o => o.id === obj.id ? { ...o, status: newStatus } : o))
  }

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  const completedCount = objectivesWithKRs.filter(o => o.status === 'completed').length
  const totalProgress = objectivesWithKRs.length > 0
    ? Math.round(objectivesWithKRs.reduce((sum, o) => sum + objectiveProgress(o.keyResults), 0) / objectivesWithKRs.length)
    : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Metas & OKR</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {objectivesWithKRs.length} objetivos · {completedCount} concluídos · progresso geral {totalProgress}%
          </p>
        </div>
        <button onClick={() => setShowObjForm(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
          style={{ background: 'var(--accent)' }}>
          + Novo Objetivo
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setActivePeriod(p)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: activePeriod === p ? 'var(--lavanda)' : 'var(--surface)',
              color: activePeriod === p ? '#08080F' : 'var(--text-muted)',
              border: `1px solid ${activePeriod === p ? 'var(--lavanda)' : 'var(--border)'}`,
            }}>
            {p}
          </button>
        ))}
      </div>

      {/* Overall progress */}
      {objectivesWithKRs.length > 0 && (
        <div className="rounded-xl px-5 py-4 flex items-center gap-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex-1">
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Progresso geral — {activePeriod}</p>
            <ProgressBar value={totalProgress} target={100} />
          </div>
          <div className="text-3xl font-bold shrink-0"
            style={{ fontFamily: 'var(--font-barlow)', color: totalProgress >= 100 ? 'var(--success)' : 'var(--lavanda)' }}>
            {totalProgress}%
          </div>
        </div>
      )}

      {/* Objectives */}
      {objectivesWithKRs.length === 0 ? (
        <div className="rounded-xl p-16 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-semibold text-white">Sem objetivos para {activePeriod}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cria o primeiro objetivo para começar a acompanhar os resultados</p>
          <button onClick={() => setShowObjForm(true)}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + Novo Objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {objectivesWithKRs.map(obj => {
            const pct = objectiveProgress(obj.keyResults)
            const owner = profiles.find(p => p.id === obj.owner_id)
            const isDone = obj.status === 'completed'

            return (
              <div key={obj.id} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--surface)', border: `1px solid ${isDone ? 'var(--success)30' : 'var(--border)'}` }}>

                {/* Objective header */}
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleObjectiveStatus(obj)}
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={{
                        borderColor: isDone ? 'var(--success)' : 'var(--border)',
                        background: isDone ? 'var(--success)' : 'transparent',
                      }}>
                      {isDone && <span className="text-white text-xs leading-none">✓</span>}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-base" style={{ color: isDone ? 'var(--text-muted)' : 'var(--cream)', textDecoration: isDone ? 'line-through' : 'none' }}>
                          {obj.title}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {obj.period}
                        </span>
                        {obj.due_date && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            até {new Date(obj.due_date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {obj.description && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{obj.description}</p>
                      )}

                      {/* Progress */}
                      <div className="mt-3">
                        <ProgressBar value={pct} target={100} />
                      </div>
                    </div>

                    {owner && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        title={owner.name || ''}
                        style={{ background: owner.avatar_color, color: '#08080F' }}>
                        {(owner.name || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Results */}
                {obj.keyResults.length > 0 && (
                  <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    {obj.keyResults.map((kr: KeyResult, i: number) => {
                      const krPct = kr.target_value > 0 ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100)) : 0
                      const isEditingThis = editingKR === kr.id
                      return (
                        <div key={kr.id}
                          className="flex items-center gap-4 px-5 py-3 border-b last:border-0"
                          style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)20' }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-xs"
                            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm" style={{ color: 'var(--text)' }}>{kr.title}</p>
                            <div className="mt-1.5">
                              <ProgressBar value={kr.current_value} target={kr.target_value} />
                            </div>
                          </div>
                          {/* Current value editor */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isEditingThis ? (
                              <>
                                <input
                                  type="number"
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  className="w-20 px-2 py-1 rounded text-sm text-center outline-none"
                                  style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--text)' }}
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') updateKRValue(kr, Number(editVal))
                                    if (e.key === 'Escape') setEditingKR(null)
                                  }}
                                />
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {kr.target_value}{kr.unit}</span>
                                <button onClick={() => updateKRValue(kr, Number(editVal))}
                                  className="px-2 py-1 rounded text-xs font-semibold text-white"
                                  style={{ background: 'var(--success)' }}>✓</button>
                              </>
                            ) : (
                              <button onClick={() => { setEditingKR(kr.id); setEditVal(String(kr.current_value)) }}
                                className="text-sm px-2 py-1 rounded transition-colors hover:opacity-80"
                                style={{ color: krPct >= 100 ? 'var(--success)' : 'var(--lavanda)', background: 'var(--surface-2)' }}>
                                {kr.current_value}<span style={{ color: 'var(--text-muted)' }}>/{kr.target_value}{kr.unit}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add KR */}
                {!isDone && (
                  <div className="px-5 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                    {showKRForm === obj.id ? (
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="Resultado-chave *" value={krTitle} onChange={e => setKRTitle(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                          style={inputStyle} autoFocus
                          onKeyDown={e => e.key === 'Escape' && setShowKRForm(null)} />
                        <input type="number" placeholder="Meta" value={krTarget} onChange={e => setKRTarget(e.target.value)}
                          className="w-20 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                          style={inputStyle} />
                        <input type="text" placeholder="%" value={krUnit} onChange={e => setKRUnit(e.target.value)}
                          className="w-14 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                          style={inputStyle} />
                        <button onClick={saveKR} disabled={!krTitle.trim() || krSaving}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                          style={{ background: 'var(--accent)' }}>
                          {krSaving ? '...' : 'Add'}
                        </button>
                        <button onClick={() => setShowKRForm(null)}
                          className="px-2 py-1.5 rounded-lg text-xs"
                          style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setShowKRForm(obj.id); setKRTitle(''); setKRTarget('100'); setKRUnit('%') }}
                        className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
                        style={{ color: 'var(--text-muted)' }}>
                        + Adicionar resultado-chave
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Objective Modal */}
      {showObjForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>Novo Objetivo</h2>
              <button onClick={() => setShowObjForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Objetivo *" value={oTitle} onChange={e => setOTitle(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />

            <textarea placeholder="Descrição (opcional)" value={oDesc} onChange={e => setODesc(e.target.value)}
              rows={2} className={inputClass} style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} />

            <div className="grid grid-cols-2 gap-3">
              {/* Período */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Período</p>
                <select value={oPeriod} onChange={e => setOPeriod(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {/* Prazo */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Prazo</p>
                <input type="date" value={oDue} onChange={e => setODue(e.target.value)}
                  className={inputClass} style={inputStyle} />
              </div>
            </div>

            {/* Responsável */}
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Responsável</p>
              <div className="flex flex-wrap gap-2">
                {profiles.map(p => (
                  <button key={p.id} onClick={() => setOOwner(oOwner === p.id ? '' : p.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: oOwner === p.id ? p.avatar_color + '25' : 'var(--surface-2)',
                      border: `1px solid ${oOwner === p.id ? p.avatar_color : 'var(--border)'}`,
                      color: oOwner === p.id ? p.avatar_color : 'var(--text-muted)',
                    }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: oOwner === p.id ? p.avatar_color : 'var(--border)', color: '#08080F' }}>
                      {(p.name || '?')[0].toUpperCase()}
                    </div>
                    {p.name?.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={saveObjective} disabled={!oTitle.trim() || oSaving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {oSaving ? 'A criar...' : 'Criar objetivo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
