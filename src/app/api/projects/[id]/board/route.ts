import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
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
