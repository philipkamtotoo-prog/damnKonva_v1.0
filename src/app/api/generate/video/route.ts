import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'

const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { projectId, prompt, negativePrompt } = await req.json()
    
    // Simulate generation queue and external inference delay
    await delay(2500)
    
    // Pseudo URL representing an external generative video storage link
    const pseudoUrl = `http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4`
    
    const asset = await prisma.asset.create({
      data: {
        projectId,
        type: 'video',
        name: `视频: ${prompt.slice(0, 10)}...`,
        status: 'success',
        prompt,
        negativePrompt: negativePrompt || null,
        thumbnailUrl: `https://picsum.photos/seed/${Math.random()}/600/400`,
        originalUrl: pseudoUrl,
        createdBy: user.userId
      }
    })

    return NextResponse.json({ success: true, asset })
  } catch (err) {
    return NextResponse.json({ error: 'Video Generation failed' }, { status: 500 })
  }
}
