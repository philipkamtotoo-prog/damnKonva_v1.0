import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { cookies } from 'next/headers'
import { downloadAndSaveAsset } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    const projectId = searchParams.get('projectId')
    const prompt = searchParams.get('prompt') || ''
    if (!taskId) return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 })

    const config = await prisma.apiConfig.findFirst({ where: { type: 'video', enabled: true } })
    if (!config || !config.baseUrl || !config.apiKeyEncrypted) {
      return NextResponse.json({ error: '系统尚未配置视频生成 API' }, { status: 400 })
    }

    const apiKey = decrypt(config.apiKeyEncrypted)
    const rawBaseUrl = config.baseUrl

    let origin: string
    try {
      origin = new URL(rawBaseUrl).origin
    } catch {
      throw new Error(`baseUrl 配置无效: ${rawBaseUrl}`)
    }

    if (config.provider === 'ksyun') {
      // 金山云可灵：rawBaseUrl 已含模型路径，直接拼接接口路径
      const isMulti = searchParams.get('multi') === 'true'
      const path = isMulti
        ? `/v1/videos/multi-image2video/${taskId}`
        : `/v1/videos/image2video/${taskId}`
      const res = await fetch(`${rawBaseUrl}${path}`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`金山云状态查询失败(${res.status}): ${(await res.text()).substring(0, 200)}`)
      const d = await res.json()
      const status = d.data?.task_status

      if (status === 'succeed' || status === 'succeeded') {
        const videoUrl = d.data?.task_result?.videos?.[0]?.url
        if (!videoUrl) throw new Error('金山云任务成功但未获取到视频URL')
        let localVideoUrl = videoUrl
        try {
          localVideoUrl = await downloadAndSaveAsset(videoUrl, 'video')
        } catch (dlErr) {
          console.warn('视频下载失败，使用原始 URL:', dlErr)
        }
        let asset = null
        if (projectId) {
          try {
            asset = await prisma.asset.create({
              data: {
                projectId,
                type: 'video',
                name: '视频生成',
                status: 'success',
                originalUrl: localVideoUrl,
                thumbnailUrl: localVideoUrl,
                prompt,
                createdBy: user.userId,
                params: JSON.stringify({ taskId, provider: 'ksyun' }),
              },
            })
          } catch (dbErr: any) {
            console.warn('视频 asset 入库失败:', dbErr.message)
          }
        }
        return NextResponse.json({ status: 'succeed', videoUrl: localVideoUrl, assetId: asset?.id })
      } else if (status === 'failed') {
        return NextResponse.json({ status: 'failed', error: d.data?.task_status_msg || '金山云视频生成失败' })
      }
      return NextResponse.json({ status: 'processing' })
    }

    // ── 火山引擎 ────────────────────────────────────────────────────────────
    const taskPath = `/api/v3/contents/generations/tasks/${taskId}`
    const volcanoRes = await fetch(`${origin}${taskPath}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!volcanoRes.ok) {
      const errText = await volcanoRes.text()
      throw new Error(`火山引擎状态查询失败(${volcanoRes.status}): ${errText.substring(0, 200)}`)
    }

    const data = await volcanoRes.json()

    const rawStatus: string = data.status || data.task_status || data.state || ''
    const status = rawStatus.toLowerCase()

    if (status === 'succeed' || status === 'succeeded' || status === 'success' || status === 'completed' || status === 'done') {
      const rawUrl =
        data.content?.video_url ||
        data.content?.url ||
        data.output?.video_url ||
        data.output?.url ||
        data.video_url ||
        data.url ||
        data.data?.video_url ||
        data.data?.url

      const isPathTraversal = (url: string) => {
        try {
          return new URL(url).pathname.split('/').some(seg => seg === '..')
        } catch { return false }
      }

      const videoUrl = rawUrl && !isPathTraversal(rawUrl) ? rawUrl : undefined

      if (!videoUrl) {
        console.error('视频生成成功但未提取到有效 URL，火山原始返回:', JSON.stringify(data))
        return NextResponse.json({ status: 'failed', error: '视频生成成功但未获取到有效地址' })
      }

      // 下载视频到本地，避免临时链接过期
      let localVideoUrl = videoUrl
      try {
        localVideoUrl = await downloadAndSaveAsset(videoUrl, 'video')
      } catch (dlErr) {
        console.warn('视频下载失败，使用原始 URL:', dlErr)
      }

      // 视频生成成功 → 写入 asset 记录
      let asset = null
      if (projectId) {
        try {
          asset = await prisma.asset.create({
            data: {
              projectId,
              type: 'video',
              name: '视频生成',
              status: 'success',
              originalUrl: localVideoUrl,
              thumbnailUrl: localVideoUrl,
              prompt,
              createdBy: user.userId,
              params: JSON.stringify({ taskId, model: data.model || '' }),
            },
          })
        } catch (dbErr: any) {
          console.warn('视频 asset 入库失败（不影响视频返回）:', dbErr.message)
        }
      }

      return NextResponse.json({ status: 'succeed', videoUrl: localVideoUrl, assetId: asset?.id })
    } else if (status === 'failed' || status === 'error' || status === 'fail') {
      const errMsg = data.error?.message || data.reason || '视频生成失败'
      return NextResponse.json({ status: 'failed', error: errMsg })
    } else {
      return NextResponse.json({ status: 'processing' })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { prompt, negativePrompt, referenceImages } = await req.json()

    const config = await prisma.apiConfig.findFirst({ where: { type: 'video', enabled: true } })
    if (!config || !config.baseUrl || !config.apiKeyEncrypted) {
      return NextResponse.json({ error: '系统尚未配置视频生成 API，请联系管理员。' }, { status: 400 })
    }
    const apiKey = decrypt(config.apiKeyEncrypted)
    const rawBaseUrl = config.baseUrl

    let origin: string
    try {
      origin = new URL(rawBaseUrl).origin
    } catch {
      throw new Error(`baseUrl 配置无效: ${rawBaseUrl}`)
    }

    const model = config.defaultModel || 'doubao-seedance-1-5-pro-251215'
    const finalPrompt = prompt + (negativePrompt ? ` 必须避免：${negativePrompt}` : '')

    if (config.provider === 'ksyun') {
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

    // ── 火山引擎 ────────────────────────────────────────────────────────────
    const postUrl = `${origin}/api/v3/contents/generations/tasks`
    console.log('视频 POST 请求 URL:', postUrl)
    const contentArray: any[] = [{ type: 'text', text: finalPrompt }]

    if (referenceImages && Array.isArray(referenceImages)) {
      referenceImages.slice(0, 10).forEach((img: any) => {
        const imageObj: any = { type: 'image_url', image_url: { url: img.url } }
        if (img.frameType === 'start') imageObj.role = 'first_frame'
        else if (img.frameType === 'end') imageObj.role = 'last_frame'
        else if (img.frameType === 'ref') imageObj.role = 'reference_image'
        contentArray.push(imageObj)
      })
    }

    const res = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, content: contentArray }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const taskId = data.id || data.task_id || data.data?.id
    return NextResponse.json({ success: true, taskId })
  } catch (err: any) {
    console.error('视频任务创建失败:', err)
    return NextResponse.json({ error: err.message || 'Video Task Creation failed' }, { status: 500 })
  }
}
