import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user || !user.isApiAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const configs = await prisma.apiConfig.findMany()
  // decode or just hide API key
  const safeConfigs = configs.map(c => ({
    ...c,
    apiKeyEncrypted: c.apiKeyEncrypted ? '********' : ''
  }))
  return NextResponse.json(safeConfigs)
}

export async function PUT(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user || !user.isApiAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const items = await req.json()
  
  for (const item of items) {
    const data: any = {
      baseUrl: item.baseUrl,
      defaultModel: item.defaultModel,
      updatedBy: user.userId
    }
    // Only update encrypted hash if the user entered a fresh API Key
    if (item.apiKey && item.apiKey !== '********') {
      data.apiKeyEncrypted = encrypt(item.apiKey)
    }

    if (item.id) {
      await prisma.apiConfig.update({ where: { id: item.id }, data })
    } else {
      await prisma.apiConfig.create({ data: { ...data, type: item.type } })
    }
  }

  return NextResponse.json({ success: true })
}
