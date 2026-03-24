import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return await verifyToken(token)
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { assets: true } }
      }
    })
    return NextResponse.json(projects)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name } = await req.json()
    if (!name || name.trim().length === 0 || name.length > 50) {
      return NextResponse.json({ error: '项目名称长度需在 1-50 字之间' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        createdBy: user.userId
      }
    })

    return NextResponse.json(project)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
