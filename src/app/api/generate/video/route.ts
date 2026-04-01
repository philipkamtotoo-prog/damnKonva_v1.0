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

    // 火山引擎只需要 origin，金山云需要完整路径（含模型名）
    let origin: string
    try {
      origin = new URL(rawBaseUrl).origin
    } catch {
      throw new Error(`baseUrl 配置无效: ${rawBaseUrl}`)
    }

    const model = config.defaultModel
    const finalPrompt = prompt + (negativePrompt ? ` 必须避免：${negativePrompt}` : '')

    if (config.provider === 'ksyun') {
      // ── 金山云可灵：rawBaseUrl 已含模型路径（如 /kling-v2-6），直接拼接接口路径 ──
      const stripData = (url: string) => url.includes(',') ? url.split(',')[1] : url

      if (referenceImages && referenceImages.length >= 2) {
        const body = {
          model_name: 'kling-v2-6', // 多图支持 kling-v2-6
          image_list: referenceImages.slice(0, 4).map((i: any) => ({ image: stripData(i.url) })),
          prompt: finalPrompt,
          negative_prompt: negativePrompt || '',
          duration: '5',
          mode: 'pro',
        }
        const res = await fetch(`${rawBaseUrl}/v1/videos/multi-image2video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`金山云(多图)请求失败(${res.status}): ${(await res.text()).substring(0, 300)}`)
        const d = await res.json()
        const taskId = d.data?.task_id
        if (!taskId) throw new Error(`金山云未返回taskId: ${JSON.stringify(d)}`)
        return NextResponse.json({ success: true, taskId, multi: true })
      } else if (referenceImages && referenceImages.length === 1) {
        const body = {
          model_name: 'kling-v2-6', // 单图支持 kling-v2-6
          image: stripData(referenceImages[0].url),
          prompt: finalPrompt,
          negative_prompt: negativePrompt || '',
          duration: '5',
          mode: 'pro',
        }
        const res = await fetch(`${rawBaseUrl}/v1/videos/image2video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`金山云(单图)请求失败(${res.status}): ${(await res.text()).substring(0, 300)}`)
        const d = await res.json()
        const taskId = d.data?.task_id
        if (!taskId) throw new Error(`金山云未返回taskId: ${JSON.stringify(d)}`)
        return NextResponse.json({ success: true, taskId, multi: false })
      } else {
        throw new Error('金山云视频生成至少需要1张参考图')
      }
    }

    // ── 火山引擎（原逻辑）───────────────────────────────────────────────────
    const postUrl = `${origin}/api/v3/contents/generations/tasks`
    console.log('视频 POST 请求 URL:', postUrl)

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
