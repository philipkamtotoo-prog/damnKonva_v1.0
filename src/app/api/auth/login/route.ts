import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { comparePassword, signToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      isApiAdmin: user.isApiAdmin
    })

    const cookieStore = await cookies()
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        isApiAdmin: user.isApiAdmin
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
