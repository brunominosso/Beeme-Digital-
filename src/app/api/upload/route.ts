import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { createClient as createServerClient } from '@/lib/supabase/server'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  // Verifica autenticação
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf',
  ]

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 })
  }

  // Limite de 100 MB por arquivo
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 100 MB)' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video/')
  const resourceType = isVideo ? 'video' : 'image'

  try {
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    const result = await cloudinary.uploader.upload(base64, {
      resource_type: resourceType,
      folder:        'beeme-digital/posts',
      use_filename:  false,
      unique_filename: true,
    })

    return NextResponse.json({
      url:  result.secure_url,
      name: file.name,
      type: file.type,
      size: file.size,
    })
  } catch (err) {
    console.error('[upload] erro Cloudinary:', err)
    return NextResponse.json({ error: 'Erro ao fazer upload. Tente novamente.' }, { status: 500 })
  }
}
