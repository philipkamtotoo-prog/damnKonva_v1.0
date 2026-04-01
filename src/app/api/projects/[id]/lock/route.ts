import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { id: projectId } = await params
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const now = new Date()
  const LOCK_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes

  if (project.lockedByUserId && project.lockedByUserId !== user.userId) {
     if (project.lockedAt && now.getTime() - project.lockedAt.getTime() < LOCK_TIMEOUT_MS) {
        return NextResponse.json({ 
           success: false, 
           lockedBy: project.lockedByUsername 
        })
     }
  }

  await prisma.project.update({
     where: { id: projectId },
     data: {
        lockedByUserId: user.userId,
        lockedByUsername: user.username,
        lockedAt: now
     }
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { id: projectId } = await params
  await prisma.project.updateMany({
     where: { id: projectId, lockedByUserId: user.userId },
     data: {
        lockedByUserId: null,
        lockedByUsername: null,
        lockedAt: null
     }
  })

  return NextResponse.json({ success: true })
}
