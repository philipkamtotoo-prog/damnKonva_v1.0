import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from './lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/init')) {
    if (token && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/projects', request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const payload = await verifyToken(token)
  if (!payload) {
    const response = pathname.startsWith('/api/') 
      ? NextResponse.json({ error: 'Token失效' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!payload.isApiAdmin) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: '无权限' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/projects', request.url))
    }
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
