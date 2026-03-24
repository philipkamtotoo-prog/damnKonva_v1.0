import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string, itemId: string } }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: projectId, itemId } = await params
    const body = await req.json()
    const updated = await prisma.whiteboardItem.update({
      where: { id: itemId, projectId },
      data: {
        ...(body.x !== undefined && { x: body.x }),
        ...(body.y !== undefined && { y: body.y }),
        ...(body.width !== undefined && { width: body.width }),
        ...(body.height !== undefined && { height: body.height }),
        ...(body.zIndex !== undefined && { zIndex: body.zIndex }),
        ...(body.content !== undefined && { content: body.content }),
      }
    })
    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Item PUT error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string, itemId: string } }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: projectId, itemId } = await params
    await prisma.whiteboardItem.delete({
      where: { id: itemId, projectId }
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Item DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
