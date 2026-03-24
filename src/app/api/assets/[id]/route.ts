import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    await prisma.asset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
