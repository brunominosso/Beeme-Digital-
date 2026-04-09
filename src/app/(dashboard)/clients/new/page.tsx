import ClientForm from '@/components/ClientForm'

export default function NewClientPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Novo cliente</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Preenche o perfil do cliente para contextualizar os agentes</p>
      </div>
      <ClientForm />
    </div>
  )
}
