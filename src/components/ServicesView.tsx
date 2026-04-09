'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Service } from '@/types/database'

const PRICE_TYPE_LABEL: Record<string, string> = {
  monthly:  '/mês',
  one_time: 'único',
  hourly:   '/hora',
  custom:   'sob consulta',
}

const PRICE_TYPE_COLOR: Record<string, string> = {
  monthly:  'var(--lavanda)',
  one_time: '#f59e0b',
  hourly:   '#10b981',
  custom:   'var(--text-muted)',
}

const DEFAULT_CATEGORIES = ['Gestão de Tráfego', 'Social Media', 'Design', 'Produção de Conteúdo', 'Consultoria', 'Outro']

export default function ServicesView({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)

  // Form
  const [fName, setFName]         = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fPrice, setFPrice]       = useState('')
  const [fPriceType, setFPriceType] = useState('monthly')
  const [fCategory, setFCategory] = useState('')
  const [fCatCustom, setFCatCustom] = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  function openNew() {
    setEditingId(null)
    setFName(''); setFDesc(''); setFPrice(''); setFPriceType('monthly')
    setFCategory(DEFAULT_CATEGORIES[0]); setFCatCustom('')
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(s: Service) {
    setEditingId(s.id)
    setFName(s.name)
    setFDesc(s.description || '')
    setFPrice(s.price != null ? String(s.price) : '')
    setFPriceType(s.price_type || 'monthly')
    setFCategory(DEFAULT_CATEGORIES.includes(s.category || '') ? (s.category || '') : 'custom')
    setFCatCustom(DEFAULT_CATEGORIES.includes(s.category || '') ? '' : (s.category || ''))
    setSaveError('')
    setShowForm(true)
  }

  async function saveService() {
    if (!fName.trim()) return
    setSaving(true); setSaveError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const category = fCategory === 'custom' ? fCatCustom : fCategory

    if (editingId) {
      const { error } = await supabase.from('services').update({
        name: fName, description: fDesc || null,
        price: fPrice ? Number(fPrice) : null,
        price_type: fPriceType, category: category || null,
      }).eq('id', editingId)
      if (error) { setSaveError(error.message); setSaving(false); return }
      setServices(prev => prev.map(s => s.id === editingId
        ? { ...s, name: fName, description: fDesc || null, price: fPrice ? Number(fPrice) : null, price_type: fPriceType, category: category || null }
        : s))
    } else {
      const { data, error } = await supabase.from('services').insert({
        name: fName, description: fDesc || null,
        price: fPrice ? Number(fPrice) : null,
        price_type: fPriceType, category: category || null,
        created_by: user?.id,
      }).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      if (data) setServices(prev => [...prev, data as Service])
    }

    setSaving(false); setShowForm(false)
  }

  async function toggleActive(s: Service) {
    const supabase = createClient()
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))
  }

  async function deleteService(id: string) {
    const supabase = createClient()
    await supabase.from('services').delete().eq('id', id)
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const usedCategories = Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[]
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...usedCategories]))
  const allCats = categories

  const visible = services.filter(s => {
    if (!showInactive && !s.active) return false
    if (filterCat !== 'all' && s.category !== filterCat) return false
    return true
  })

  const grouped = allCats.reduce<Record<string, Service[]>>((acc, cat) => {
    const items = visible.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})
  const uncategorized = visible.filter(s => !s.category)

  const activeCount = services.filter(s => s.active).length
  const totalMonthly = services
    .filter(s => s.active && s.price_type === 'monthly' && s.price)
    .reduce((sum, s) => sum + (s.price || 0), 0)

  const inputClass = "w-full px-3 py-2 rounded-lg text-sm outline-none"
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cream)' }}>Produtos & Serviços</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {activeCount} serviços ativos
            {totalMonthly > 0 && ` · Potencial mensal: R$ ${totalMonthly.toLocaleString('pt-BR')}`}
          </p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
          style={{ background: 'var(--accent)' }}>
          + Novo Serviço
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat('all')}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filterCat === 'all' ? 'var(--lavanda)' : 'var(--surface)',
              color: filterCat === 'all' ? '#08080F' : 'var(--text-muted)',
              border: `1px solid ${filterCat === 'all' ? 'var(--lavanda)' : 'var(--border)'}`,
            }}>
            Todos
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: filterCat === cat ? 'var(--lavanda)' : 'var(--surface)',
                color: filterCat === cat ? '#08080F' : 'var(--text-muted)',
                border: `1px solid ${filterCat === cat ? 'var(--lavanda)' : 'var(--border)'}`,
              }}>
              {cat}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer ml-auto" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3 h-3" />
          Mostrar inativos
        </label>
      </div>

      {/* Empty */}
      {visible.length === 0 && (
        <div className="rounded-xl p-16 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-4xl mb-3">📦</p>
          <p className="font-semibold text-white">Sem serviços ainda</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Adiciona os serviços que a Beeme Digital oferece</p>
          <button onClick={openNew}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            + Novo Serviço
          </button>
        </div>
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h2 className="label-caps mb-3">{cat}</h2>
          <div className="grid grid-cols-2 gap-3">
            {items.map(s => <ServiceCard key={s.id} service={s} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteService} />)}
          </div>
        </div>
      ))}

      {uncategorized.length > 0 && (
        <div>
          <h2 className="label-caps mb-3">Sem categoria</h2>
          <div className="grid grid-cols-2 gap-3">
            {uncategorized.map(s => <ServiceCard key={s.id} service={s} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteService} />)}
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--cream)' }}>
                {editingId ? 'Editar serviço' : 'Novo serviço'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <input type="text" placeholder="Nome do serviço *" value={fName} onChange={e => setFName(e.target.value)}
              className={inputClass} style={inputStyle} autoFocus />

            <textarea placeholder="Descrição (o que inclui, como funciona...)" value={fDesc} onChange={e => setFDesc(e.target.value)}
              rows={3} className={inputClass} style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} />

            {/* Preço */}
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Preço (R$)</p>
                <input type="number" placeholder="0,00" value={fPrice} onChange={e => setFPrice(e.target.value)}
                  className={inputClass} style={inputStyle} />
              </div>
              <div className="flex-1">
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Tipo</p>
                <select value={fPriceType} onChange={e => setFPriceType(e.target.value)}
                  className={inputClass} style={inputStyle}>
                  <option value="monthly">Mensal</option>
                  <option value="one_time">Valor único</option>
                  <option value="hourly">Por hora</option>
                  <option value="custom">Sob consulta</option>
                </select>
              </div>
            </div>

            {/* Categoria */}
            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Categoria</p>
              <select value={fCategory} onChange={e => setFCategory(e.target.value)}
                className={inputClass} style={inputStyle}>
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="custom">Outra (escrever)</option>
              </select>
              {fCategory === 'custom' && (
                <input type="text" placeholder="Nome da categoria" value={fCatCustom} onChange={e => setFCatCustom(e.target.value)}
                  className={`${inputClass} mt-2`} style={inputStyle} autoFocus />
              )}
            </div>

            {saveError && (
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger)15', color: 'var(--danger)' }}>
                Erro: {saveError}
              </p>
            )}

            <button onClick={saveService} disabled={!fName.trim() || saving}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'A guardar...' : editingId ? 'Guardar alterações' : 'Criar serviço'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceCard({
  service: s,
  onEdit,
  onToggle,
  onDelete,
}: {
  service: Service
  onEdit: (s: Service) => void
  onToggle: (s: Service) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const typeColor = PRICE_TYPE_COLOR[s.price_type || 'monthly']

  return (
    <div className="rounded-xl p-4 group transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${s.active ? 'var(--border)' : 'var(--border-soft)'}`,
        opacity: s.active ? 1 : 0.5,
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ color: s.active ? 'var(--cream)' : 'var(--text-muted)' }}>
            {s.name}
          </p>
          {s.category && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.category}</span>
          )}
        </div>

        {/* Preço */}
        {s.price != null && s.price_type !== 'custom' ? (
          <div className="shrink-0 text-right">
            <p className="font-bold text-sm" style={{ color: typeColor }}>
              R$ {Number(s.price).toLocaleString('pt-BR')}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {PRICE_TYPE_LABEL[s.price_type || 'monthly']}
            </p>
          </div>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded shrink-0"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            {PRICE_TYPE_LABEL['custom']}
          </span>
        )}
      </div>

      {s.description && (
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          {s.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => onEdit(s)}
          className="text-xs px-2 py-1 rounded"
          style={{ color: 'var(--accent)', background: 'var(--surface-2)' }}>
          ✎ Editar
        </button>
        <button onClick={() => onToggle(s)}
          className="text-xs px-2 py-1 rounded"
          style={{ color: s.active ? 'var(--warning)' : 'var(--success)', background: 'var(--surface-2)' }}>
          {s.active ? 'Desativar' : 'Ativar'}
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="text-xs px-2 py-1 rounded ml-auto"
            style={{ color: 'var(--danger)', background: 'var(--surface-2)' }}>
            🗑
          </button>
        ) : (
          <div className="flex gap-1 ml-auto">
            <button onClick={() => onDelete(s.id)}
              className="text-xs px-2 py-1 rounded font-semibold"
              style={{ background: 'var(--danger)', color: 'white' }}>
              Confirmar
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)', background: 'var(--surface-2)' }}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
