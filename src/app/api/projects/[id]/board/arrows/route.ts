import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: arrowId, fromItemId, toItemId } = await req.json()
    const { id: projectId } = await params

    const existing = await prisma.arrowLink.findUnique({ where: { id: arrowId } })
    if (existing) return NextResponse.json({ arrow: existing })

    const arrow = await prisma.arrowLink.create({
      data: {
        id: arrowId,
        projectId,
        fromItemId,
        toItemId,
        createdBy: user.userId
      }
    })

    return NextResponse.json({ arrow })
  } catch (err: any) {
    console.error('Arrow POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const arrowId = url.searchParams.get('arrowId')

    if (!arrowId) return NextResponse.json({ error: 'Missing arrowId' }, { status: 400 })

    await prisma.arrowLink.delete({
      where: { id: arrowId }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Arrow DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
