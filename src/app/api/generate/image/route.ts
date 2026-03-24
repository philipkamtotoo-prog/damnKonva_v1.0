import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/crypto'

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
    const { projectId, prompt, negativePrompt, size, n, image } = await req.json()

    const config = await prisma.apiConfig.findFirst({ where: { type: 'image' } })
    if (!config || !config.baseUrl || !config.apiKeyEncrypted) {
      return NextResponse.json({ error: '系统尚未配置生图 API，请联系管理员在指控中心设置。' }, { status: 400 })
    }

    const apiKey = decrypt(config.apiKeyEncrypted)
    const baseUrl = config.baseUrl.replace(/\/+$/, '')

    const nInt = Number(n) || 1
    const sizeStr = size?.trim() || '1024x1024'
    const [widthStr, heightStr] = sizeStr.split('x')
    const width = Math.max(256, Math.min(2048, Number(widthStr) || 1024))
    const height = Math.max(256, Math.min(2048, Number(heightStr) || 1024))

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
      const openaiRes = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: combinedPrompt,
          n: nInt,
          size: sizeStr,
          response_format: 'url',
          ...(image ? { image } : {})
        }),
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.error('OpenAI Interface Error:', errText)
        throw new Error(`上游生成服务异常(${openaiRes.status}): ${errText.substring(0, 200)}`)
      }

      const openaiData = await openaiRes.json()
      urls = openaiData.data?.map((d: any) => d.url || d.b64_json).filter(Boolean) || []

      if (urls.length === 0) throw new Error('服务成功返回但未提取到有效媒体路径')
    }

    // ── 入库 ──────────────────────────────────────────────────────────────
    const createdAssets = []
    for (const imageUrl of urls) {
      const asset = await prisma.asset.create({
        data: {
          projectId,
          type: 'image',
          name: `图片: ${prompt.slice(0, 10)}...`,
          status: 'success',
          prompt,
          negativePrompt: negativePrompt || null,
          thumbnailUrl: imageUrl,
          originalUrl: imageUrl,
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
