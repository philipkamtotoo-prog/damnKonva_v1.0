import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    // Forward Range header if present (critical for video seeking / 206 Partial Content)
    const headers: HeadersInit = {}
    const range = req.headers.get('range')
    if (range) headers['Range'] = range

    const res = await fetch(url, { headers })

    // Build response headers — always add CORS, forward Content-Type / Content-Length / Range
    const responseHeaders = new Headers()
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Range')

    const contentType = res.headers.get('Content-Type')
    if (contentType) responseHeaders.set('Content-Type', contentType)

    const contentLength = res.headers.get('Content-Length')
    if (contentLength) responseHeaders.set('Content-Length', contentLength)

    const contentRange = res.headers.get('Content-Range')
    if (contentRange) responseHeaders.set('Content-Range', contentRange)

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    })
  } catch (err) {
    return new NextResponse('Proxy fetch failed: ' + String(err), { status: 502 })
  }
}
