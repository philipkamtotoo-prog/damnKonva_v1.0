import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { projectId, prompt, negativePrompt, referenceImages } = await req.json()

    const config = await prisma.apiConfig.findFirst({ where: { type: 'video', enabled: true } })
    if (!config || !config.baseUrl || !config.apiKeyEncrypted) {
      return NextResponse.json({ error: '系统尚未配置视频生成 API，请联系管理员在指控中心设置。' }, { status: 400 })
    }
    if (!config.defaultModel) {
      return NextResponse.json({ error: '视频 API 缺少默认模型配置，请在指控中心设置默认模型。' }, { status: 400 })
    }

    const apiKey = decrypt(config.apiKeyEncrypted)
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 解密失败，请检查 JWT_SECRET 环境变量是否与加密时一致。' }, { status: 500 })
    }
    const rawBaseUrl = config.baseUrl

    // 稳健 URL 清洗：取 origin，丢弃管理员误填的多余路径
    let origin: string
    try {
      origin = new URL(rawBaseUrl).origin
    } catch {
      throw new Error(`baseUrl 配置无效: ${rawBaseUrl}`)
    }

    const model = config.defaultModel
    const postUrl = `${origin}/api/v3/contents/generations/tasks`
    console.log('视频 POST 请求 URL:', postUrl)

    const finalPrompt = prompt + (negativePrompt ? ` 必须避免：${negativePrompt}` : '')
    const contentArray: any[] = [{ type: 'text', text: finalPrompt }]

    if (referenceImages && Array.isArray(referenceImages)) {
      const totalImages = referenceImages.slice(0, 10)
      // 多张图时每张必须指定 role；单张图不传 role 让火山自动判断
      totalImages.forEach((img: any) => {
        const imageObj: any = { type: 'image_url', image_url: { url: img.url } }
        if (totalImages.length > 1) {
          if (img.frameType === 'start') imageObj.role = 'first_frame'
          else if (img.frameType === 'end') imageObj.role = 'last_frame'
          else if (img.frameType === 'ref') imageObj.role = 'reference_image'
        }
        contentArray.push(imageObj)
      })
    }

    const volcanoRes = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, content: contentArray, watermark: false }),
    })

    if (!volcanoRes.ok) {
      const errText = await volcanoRes.text()
      console.error('火山引擎提交失败:', volcanoRes.status, errText)
      throw new Error(`火山引擎请求失败(${volcanoRes.status}): ${errText.substring(0, 300)}`)
    }

    const data = await volcanoRes.json()
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))

    // 撒网式提取 taskId
    const taskId = data.id || data.task_id || data.data?.task_id || data.data?.id

    if (!taskId) {
      console.error('未找到 taskId，火山原始返回:', JSON.stringify(data))
      throw new Error('火山接口已接收，但未返回有效的任务 ID')
    }

    return NextResponse.json({ success: true, taskId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Video generation failed' }, { status: 500 })
  }
}
