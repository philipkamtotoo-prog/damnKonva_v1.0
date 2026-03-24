import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyToken, hashPassword } from '@/lib/auth'

async function getAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user?.isApiAdmin) return null
  return user
}

export async function GET() {
  if (!await getAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const users = await prisma.user.findMany({ select: { id: true, username: true, isApiAdmin: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  if (!await getAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { username, password } = await req.json()
    if (!username || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) return NextResponse.json({ error: 'Username exists' }, { status: 400 })
    
    const hash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { username, passwordHash: hash, isApiAdmin: false }
    })
    return NextResponse.json({ success: true, id: user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (id === admin.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

    await prisma.arrowLink.deleteMany({ where: { createdBy: id } })
    await prisma.whiteboardItem.deleteMany({ where: { createdBy: id } })
    await prisma.asset.deleteMany({ where: { createdBy: id } })
    await prisma.project.deleteMany({ where: { createdBy: id } })
    await prisma.user.delete({ where: { id } })
    
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
