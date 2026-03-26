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
  const safeConfigs = configs.map(c => ({
    ...c,
    apiKeyEncrypted: c.apiKeyEncrypted ? '********' : ''
  }))
  return NextResponse.json(safeConfigs)
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    const user = token ? await verifyToken(token) : null
    if (!user || !user.isApiAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const items = await req.json()

    // 按 type 分组，同 type 下只允许一个 enabled
    const byType: Record<string, any[]> = {}
    for (const item of items) {
      const key = item.type
      if (!byType[key]) byType[key] = []
      byType[key].push(item)
    }

    for (const [, typeItems] of Object.entries(byType)) {
      // 先禁用同 type 下所有 provider
      const type = typeItems[0].type
      await prisma.apiConfig.updateMany({
        where: { type },
        data: { enabled: false },
      })

      // 再逐个 upsert
      for (const item of typeItems) {
        const isNewKey = item.apiKey && item.apiKey !== '********'
        // 新 key 优先；无新 key 时查旧值；都没有则为 ''
        const existing = isNewKey ? null : await prisma.apiConfig.findUnique({
          where: { type_provider: { type: item.type, provider: item.provider || 'volcano' } },
        })
        const encrypted = isNewKey ? encrypt(item.apiKey) : (existing?.apiKeyEncrypted ?? '')

        const data: any = {
          type: item.type,
          provider: item.provider || 'volcano',
          baseUrl: item.baseUrl,
          defaultModel: item.defaultModel,
          enabled: item.enabled === true,
          updatedBy: user.userId,
          apiKeyEncrypted: encrypted,
        }

        await prisma.apiConfig.upsert({
          where: { type_provider: { type: item.type, provider: item.provider || 'volcano' } },
          create: data,
          update: data,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('PUT /api/admin/config error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
