import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

/** 根据 Content-Type 或 URL 推断文件扩展名 */
function getExtension(contentType: string | null, url: string): string {
  const ct = contentType || ''
  if (ct.includes('image/png')) return 'png'
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg'
  if (ct.includes('video/mp4') || ct.includes('video/mpeg')) return 'mp4'
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase()
    if (ext === '.jpeg') return 'jpg'
    if (ext === '.png' || ext === '.jpg' || ext === '.mp4') return ext.slice(1)
  } catch { /* ignore */ }
  return 'png'
}

/**
 * 下载远程媒体文件并保存到 public/uploads/
 * @param url 远程 URL（可以是临时链接）
 * @param type 'image' | 'video'
 * @returns 本地永久访问路径，如 '/uploads/xxxx.ext'
 */
export async function downloadAndSaveAsset(url: string, type: 'image' | 'video'): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败(${res.status}): ${url}`)

  const contentType = res.headers.get('content-type')
  const ext = getExtension(contentType, url)
  const filename = `${randomUUID()}.${ext}`
  const filePath = path.join(UPLOADS_DIR, filename)

  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  return `/uploads/${filename}`
}
