import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: projectId } = await params
    const body = await req.json()

    const existing = await prisma.whiteboardItem.findUnique({ where: { id: body.id } })
    if (existing) return NextResponse.json({ item: existing })

    const item = await prisma.whiteboardItem.create({
      data: {
        id: body.id,
        projectId,
        itemType: body.itemType,
        x: body.x ?? 0,
        y: body.y ?? 0,
        width: body.width ?? null,
        height: body.height ?? null,
        zIndex: body.zIndex ?? 0,
        content: body.content ?? null,
        refId: body.refId ?? null,
        fontSize: body.fontSize ?? null,
        createdBy: payload.userId,
      }
    })

    return NextResponse.json({ item })
  } catch (err: any) {
    console.error('Items POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
