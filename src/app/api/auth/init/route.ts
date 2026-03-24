import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function GET() {
  try {
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      return NextResponse.json({ message: 'Database already initialized' })
    }

    const hashedPassword = await hashPassword('admin123')
    
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hashedPassword,
        isApiAdmin: true
      }
    })

    return NextResponse.json({ message: 'Database initialized with default admin:admin123' })
  } catch (error) {
    return NextResponse.json({ error: 'Init failed' }, { status: 500 })
  }
}
