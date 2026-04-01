import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const items = await prisma.whiteboardItem.findMany({
      where: { projectId: id }
    })
    const arrows = await prisma.arrowLink.findMany({
      where: { projectId: id }
    })
    return NextResponse.json({ items, arrows })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 })
  }
}
