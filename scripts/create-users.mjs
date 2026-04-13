import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xgyummbjtttkiexduxnh.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const COMMON_PASSWORD = 'BeemeDigital@1'

const USERS = [
  { email: 'Lorenzo@beemedigital.com',  name: 'Lorenzo',  role: 'designer',     avatar_color: '#ec4899' },
  { email: 'Paloma@beemedigital.com',   name: 'Paloma',   role: 'social_media', avatar_color: '#f59e0b' },
  { email: 'Giovanna@beemedigital.com', name: 'Giovanna', role: 'financeiro',   avatar_color: '#10b981' },
  { email: 'Juan@beemedigital.com',     name: 'Juan',     role: 'gestor',       avatar_color: '#6c63ff' },
  { email: 'Humberto@beemedigital.com', name: 'Humberto', role: 'gestor',       avatar_color: '#8b5cf6' },
]

async function run() {
  // 0. Ver todos os perfis existentes
  const { data: allProfiles } = await admin.from('profiles').select('id, name, role')
  console.log('\nPerfis existentes na DB:')
  for (const p of (allProfiles || [])) {
    console.log(`  ${p.id.slice(0,8)}... | ${(p.name || '').padEnd(12)} | ${p.role}`)
  }

  // 1. Listar todos os auth users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 100 })
  const authUsers = authData?.users || []
  console.log(`\nAuth users existentes: ${authUsers.length}`)
  for (const u of authUsers) {
    console.log(`  ${u.id.slice(0,8)}... | ${u.email}`)
  }

  for (const u of USERS) {
    console.log(`\n━━ ${u.name} (${u.email})`)

    // Verificar se auth user já existe
    const existing = authUsers.find(usr => usr.email?.toLowerCase() === u.email.toLowerCase())

    let userId

    if (existing) {
      console.log(`  ✓ Auth user já existe: ${existing.id.slice(0,8)}...`)
      // Actualizar password
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: COMMON_PASSWORD,
        email_confirm: true,
      })
      if (error) console.log(`  ✗ Erro ao actualizar: ${error.message}`)
      else console.log(`  ✓ Password actualizada`)
      userId = existing.id
    } else {
      // Apagar perfis antigos com o mesmo nome (trigger vai re-criar com o ID correcto)
      const conflicts = (allProfiles || []).filter(p => p.name?.toLowerCase() === u.name.toLowerCase())
      for (const old of conflicts) {
        console.log(`  ⚠ Apagando perfil antigo: ${old.id.slice(0,8)}... (${old.name})`)
        await admin.from('profiles').delete().eq('id', old.id)
      }

      // Inserir pending_profile para o trigger usar
      await admin.from('pending_profiles').upsert({
        email: u.email.toLowerCase(),
        name: u.name,
        role: u.role,
        avatar_color: u.avatar_color,
      }, { onConflict: 'email' })
      console.log(`  ✓ pending_profile preparado`)

      // Criar auth user com password
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: COMMON_PASSWORD,
        email_confirm: true,
        user_metadata: { name: u.name },
      })

      if (createErr) {
        console.log(`  ✗ Erro ao criar auth user: ${createErr.message}`)
        // Tentar inserir perfil manualmente mesmo assim usando a API REST
        continue
      }

      console.log(`  ✓ Auth user criado: ${created.user.id.slice(0,8)}...`)
      userId = created.user.id
    }

    // Garantir que o perfil existe e tem os dados correctos
    if (userId) {
      const { error: profileErr } = await admin.from('profiles').upsert({
        id: userId,
        name: u.name,
        role: u.role,
        avatar_color: u.avatar_color,
      }, { onConflict: 'id' })

      if (profileErr) console.log(`  ✗ Erro no perfil: ${profileErr.message}`)
      else console.log(`  ✓ Perfil OK → role: ${u.role}, cor: ${u.avatar_color}`)
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('CREDENCIAIS DE ACESSO')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const u of USERS) {
    console.log(`${u.name.padEnd(10)} ${u.email.padEnd(32)} ${COMMON_PASSWORD}`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

run().catch(console.error)
