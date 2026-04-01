import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/crypto'
import { downloadAndSaveAsset } from '@/lib/storage'
import fs from 'fs'
import path from 'path'

/** 将本地 /uploads/ 路径转为 Base64 Data URI */
async function resolveLocalImage(image: string): Promise<string> {
  if (!image || !image.startsWith('/uploads/')) return image
  const filePath = path.join(process.cwd(), 'public', image)
  if (!fs.existsSync(filePath)) {
    console.warn(`本地垫图文件不存在: ${filePath}`)
    return image
  }
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  const mime = mimeMap[ext] || 'image/png'
  const base64 = buffer.toString('base64')
  return `data:${mime};base64,${base64}`
}

/** 判断是否为 Anthropic/Claude 系列模型 */
function isAnthropicModel(model: string): boolean {
  const m = model.toLowerCase()
  return m.includes('claude') || m.startsWith('anthropic/')
}

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const user = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { projectId, prompt, negativePrompt, size, n, image: rawImage } = await req.json()

    const config = await prisma.apiConfig.findFirst({ where: { type: 'image', enabled: true } })
    if (!config || !config.baseUrl || !config.apiKeyEncrypted) {
      return NextResponse.json({ error: '系统尚未配置生图 API，请联系管理员在指控中心设置。' }, { status: 400 })
    }

    // 本地垫图文件转为 Base64 Data URI
    const image = await resolveLocalImage(rawImage || '')

    const apiKey = decrypt(config.apiKeyEncrypted)
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 解密失败，请检查 JWT_SECRET 环境变量是否与加密时一致。' }, { status: 500 })
    }
    const baseUrl = config.baseUrl.replace(/\/+$/, '')

    const nInt = Number(n) || 1
    const sizeStr = size?.trim() || '1024x1024'
    // 火山引擎接受大分辨率（如 2560x1440 / 3840x2160），不再用 DALL-E 的 2048 上限截断
    const [widthStr, heightStr] = sizeStr.split('x')
    const width = Number(widthStr) || 1024
    const height = Number(heightStr) || 1024

    const model = config.defaultModel || 'dall-e-3'
    const combinedPrompt = prompt + (negativePrompt ? ` (Avoid strictly: ${negativePrompt})` : '')
    let urls: string[] = []

    if (isAnthropicModel(model)) {
      // ── Anthropic Messages API + generate_image 工具 ──────────────────
      const anthropicRes = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          n: nInt,
          messages: [
            {
              role: 'user',
              content: [
                ...(image ? [{
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: image.substring(image.indexOf(':') + 1, image.indexOf(';')),
                    data: image.split(',')[1]
                  }
                }] : []),
                {
                  type: 'text',
                  text: combinedPrompt,
                },
                {
                  type: 'tool_use',
                  id: 'img_req_1',
                  name: 'generate_image',
                  input: {
                    prompt: combinedPrompt,
                    width,
                    height,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              name: 'generate_image',
              description: 'Generate an image from a text prompt.',
              input: {
                type: 'object',
                properties: {
                  prompt: { type: 'string', description: 'The prompt for image generation.' },
                  width: {
                    type: 'integer',
                    description: 'Width of the image (256–2048)',
                    default: 1024,
                  },
                  height: {
                    type: 'integer',
                    description: 'Height of the image (256–2048)',
                    default: 1024,
                  },
                },
                required: ['prompt'],
              },
            },
          ],
        }),
      })

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text()
        console.error('Anthropic API Error:', errText)
        throw new Error(`Anthropic 服务异常(${anthropicRes.status}): ${errText.substring(0, 200)}`)
      }

      const anthropicData = await anthropicRes.json()

      // 解析 Anthropic 响应：tool_result 中的 content 即图片 URL
      const toolResults = anthropicData.content?.filter(
        (c: any) => c.type === 'tool_result'
      ) || []
      urls = toolResults
        .map((t: any) => {
          if (!t.content) return null
          // content 可能是 string (URL) 或 array (多张)
          if (typeof t.content === 'string') return t.content
          if (Array.isArray(t.content)) {
            return t.content.map((c: any) => (typeof c === 'string' ? c : c.source?.uri || c.uri)).filter(Boolean)
          }
          return t.content.uri || null
        })
        .flat()
        .filter(Boolean) as string[]

      if (urls.length === 0) {
        console.error('Anthropic raw response:', JSON.stringify(anthropicData).substring(0, 500))
        throw new Error('Anthropic 服务成功返回但未提取到有效媒体路径')
      }
    } else {
      // ── OpenAI /images/generations 格式 ──────────────────────────────
      // Ksyun/火山要求最小 3,686,400 像素，宽×高 < 该值时自动放大
      const MIN_PIXELS = 3686400
      const pixels = width * height
      const safeW = pixels < MIN_PIXELS ? Math.max(width, Math.ceil(Math.sqrt(MIN_PIXELS))) : width
      const safeH = pixels < MIN_PIXELS ? Math.max(height, Math.ceil(Math.sqrt(MIN_PIXELS))) : height
      const safeSize = `${safeW}x${safeH}`

      // 稳健 URL 清洗：取 origin（协议+域名），丢弃管理员填的多余路径
      const imgUrl = (() => {
        const pathSuffix = '/images/generations'
        const clean = baseUrl.replace(/\/+$/, '')
        if (clean.includes(pathSuffix)) return clean
        return `${clean}${pathSuffix}`
      })()

      const singleReqBody = {
        model,
        prompt: combinedPrompt,
        size: safeSize,
        response_format: 'url',
        ...(image ? { image } : {}),
      }

      if (nInt === 1) {
        // 单图：直接请求
        const openaiRes = await fetch(imgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(singleReqBody),
        })
        if (!openaiRes.ok) {
          const errText = await openaiRes.text()
          console.error('生图请求失败:', openaiRes.status, errText)
          throw new Error(`上游生图服务异常(${openaiRes.status}): ${errText.substring(0, 300)}`)
        }
        const openaiData = await openaiRes.json()
        const rawData = openaiData.data || []
        const validItems = rawData.filter((d: any) => !d.error)
        urls = validItems.map((d: any) => d.url || d.b64_json).filter(Boolean)
      } else {
        // 多图：并发 n 次请求，火山单次只返回 1 张
        const requests = Array.from({ length: nInt }, () =>
          fetch(imgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(singleReqBody),
          })
        )
        const results = await Promise.allSettled(requests)
        let successCount = 0, failCount = 0
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const res = result.value
            if (!res.ok) {
              failCount++
              console.error('某张图请求失败:', res.status, await res.text())
              continue
            }
            const data = await res.json()
            const validItems = (data.data || []).filter((d: any) => !d.error)
            const extracted = validItems.map((d: any) => d.url || d.b64_json).filter(Boolean)
            urls.push(...extracted)
            successCount++
          } else {
            failCount++
            console.error('某张图请求异常:', result.reason)
          }
        }
        console.log(`多图并发: 请求 ${nInt} 张，成功 ${successCount} 张，失败 ${failCount} 张`)
        if (urls.length === 0) throw new Error('所有图片生成均失败')
      }
    }

    // ── 入库 ──────────────────────────────────────────────────────────────
    const createdAssets = []
    for (const imageUrl of urls) {
      let localUrl = imageUrl
      try {
        // base64 格式无需下载，直接使用
        if (!imageUrl.startsWith('data:')) {
          localUrl = await downloadAndSaveAsset(imageUrl, 'image')
        }
      } catch (dlErr) {
        console.warn('图片下载失败，使用原始 URL:', dlErr)
      }

      const asset = await prisma.asset.create({
        data: {
          projectId,
          type: 'image',
          name: `图片: ${prompt.slice(0, 10)}...`,
          status: 'success',
          prompt,
          negativePrompt: negativePrompt || null,
          thumbnailUrl: localUrl,
          originalUrl: localUrl,
          createdBy: user.userId,
          params: JSON.stringify({ size: sizeStr, model }),
        },
      })
      createdAssets.push(asset)
    }

    return NextResponse.json({ success: true, assets: createdAssets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
