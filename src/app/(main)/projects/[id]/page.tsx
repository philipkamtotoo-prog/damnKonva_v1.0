'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWhiteboardStore } from '@/store/whiteboard'
import AssetGridSidebar from '@/components/whiteboard/AssetGridSidebar'
import AssetDetailModal from '@/components/whiteboard/AssetDetailModal'
import GeneratePanel from '@/components/whiteboard/GeneratePanel'
import Link from 'next/link'

const CanvasEngine = dynamic(() => import('@/components/whiteboard/CanvasEngine'), { ssr: false })

// 只读模式提示 Banner
const LockBanner = () => {
  const { isReadOnly, lockOwner } = useWhiteboardStore()
  if (!isReadOnly) return null
  return (
    <div className="fixed top-14 inset-x-0 z-50 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-3 shadow-sm">
      <span className="text-amber-600 text-sm">
        🔒 此项目正被 <strong className="text-amber-700">{lockOwner}</strong> 编辑，你当前为只读预览模式
      </span>
      <span className="text-amber-400 text-xs">可缩放、滚动、预览、下载</span>
    </div>
  )
}

export default function WhiteboardPage() {
  const params = useParams()
  const router = useRouter()
  const { camera, setCamera, items, addItem, isLinkingMode, setIsLinkingMode, isReadOnly, setReadOnly } = useWhiteboardStore()
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeAsset, setActiveAsset] = useState<any>(null)
  const [projectName, setProjectName] = useState('')
  const lockRenewalRef = useRef<NodeJS.Timeout | null>(null)

  // 获取当前用户信息
  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (data.user?.isApiAdmin) setIsAdmin(true)
    }).catch(console.error)
  }, [])

  // 获取项目名称
  useEffect(() => {
    if (!params.id) return
    fetch(`/api/projects/${params.id}`).then(res => res.json()).then(data => {
      if (data.name) setProjectName(data.name)
    }).catch(console.error)
  }, [params.id])

  // 锁定管理：获取锁定、续期、释放
  useEffect(() => {
    // 获取锁定
    const acquireLock = async () => {
      try {
        const res = await fetch(`/api/projects/${params.id}/lock`, { method: 'POST' })
        const data = await res.json()
        if (data.success) {
          setReadOnly(false)
        } else {
          setReadOnly(true, data.lockedBy)
        }
      } catch {
        setReadOnly(true, '未知用户')
      }
    }
    acquireLock()

    // 定时续期：每 2 分钟一次（只读时不续期）
    lockRenewalRef.current = setInterval(async () => {
      if (useWhiteboardStore.getState().isReadOnly) return
      try {
        await fetch(`/api/projects/${params.id}/lock`, { method: 'POST' })
      } catch { /* 忽略续期失败 */ }
    }, 2 * 60 * 1000)

    return () => {
      if (lockRenewalRef.current) clearInterval(lockRenewalRef.current)
    }
  }, [params.id, setReadOnly])

  // 离开页面时释放锁定
  useEffect(() => {
    const releaseLock = async () => {
      try {
        await fetch(`/api/projects/${params.id}/lock`, { method: 'DELETE' })
      } catch { /* 忽略错误 */ }
    }
    window.addEventListener('beforeunload', releaseLock)
    return () => {
      window.removeEventListener('beforeunload', releaseLock)
      releaseLock()
    }
  }, [params.id])

  // 核心修复：计算中心点时，必须刨除左侧边栏(256px)和右侧面板(384px)的宽度
  const getCenter = () => {
    const canvasWidth = typeof window !== 'undefined' ? window.innerWidth - 256 - 384 : 800
    const canvasHeight = typeof window !== 'undefined' ? window.innerHeight - 56 - 40 : 600 // -40 = main pt-10
    const cx = -camera.x / camera.scale + canvasWidth / 2 / camera.scale
    const cy = -camera.y / camera.scale + canvasHeight / 2 / camera.scale
    return { cx, cy }
  }

  const handleAddText = () => {
    if (isReadOnly) return
    const { cx, cy } = getCenter()
    addItem({ id: crypto.randomUUID(), itemType: 'text', x: cx, y: cy, zIndex: 10 })
  }

  const handleAddNote = () => {
    if (isReadOnly) return
    const { cx, cy } = getCenter()
    addItem({ id: crypto.randomUUID(), itemType: 'note', x: cx, y: cy, zIndex: 10 })
  }

  return (
    <div key={params.id as string} className="flex flex-col h-screen w-screen overflow-hidden bg-white text-zinc-900 font-sans">
      <header className="h-14 border-b border-zinc-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 shadow-sm relative">
        <div className="flex gap-4 items-center">
          <button onClick={() => router.push('/projects')} className="text-zinc-500 hover:text-emerald-600 transition-colors text-sm font-medium flex items-center gap-1">
            &larr; 项目
          </button>
          <div className="h-4 w-px bg-zinc-300"></div>
          <span className="font-bold text-zinc-800 tracking-wide text-sm truncate max-w-[200px]">{projectName || `项目 ${params.id}`}</span>
        </div>
        
        <div className="flex gap-2 items-center absolute left-1/2 -translate-x-1/2">
          <button onClick={handleAddText} disabled={isReadOnly} className={`text-xs px-3 py-1.5 rounded border transition-colors ${isReadOnly ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
            ＋ 新建文本框
          </button>
          <button onClick={handleAddNote} disabled={isReadOnly} className={`text-xs px-3 py-1.5 rounded border transition-colors ${isReadOnly ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
            ＋ 新建便签
          </button>
          {isReadOnly ? (
            <span className="text-xs px-3 py-1.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed">
              ＋ 上传图片
            </span>
          ) : (
            <label className="text-xs bg-white hover:bg-zinc-50 px-3 py-1.5 rounded text-zinc-700 transition-colors border border-zinc-200 cursor-pointer">
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const base64 = ev.target?.result as string
                    const { cx, cy } = getCenter()
                    addItem({ id: crypto.randomUUID(), itemType: 'asset', content: base64, x: cx - 150, y: cy - 100, width: 300, height: 200, zIndex: 10 })
                  }
                  reader.readAsDataURL(file)
                  e.target.value = ''
                }}
              />
              ＋ 上传图片
            </label>
          )}
          {isReadOnly ? (
            <span className={`text-xs px-3 py-1.5 rounded border transition-all border-zinc-200 text-zinc-400`}>
              ↗ 箭头连线
            </span>
          ) : (
            <button
              onClick={() => setIsLinkingMode(!isLinkingMode)}
              className={`text-xs px-3 py-1.5 rounded transition-all border ${isLinkingMode ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold animate-pulse' : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
            >
              {isLinkingMode ? '取消连线 (Esc)' : '↗ 箭头连线'}
            </button>
          )}
        </div>

        <div className="flex gap-3 items-center">
          {isAdmin && (
            <button onClick={() => router.push('/admin/api-config')} className="text-xs font-medium text-amber-600 hover:text-amber-500 px-2 flex items-center gap-1">
              ⚙️ 管理配置
            </button>
          )}
          <button onClick={() => setCamera({ scale: 1 })} className="text-xs font-mono bg-white hover:bg-emerald-50 px-2 py-1.5 rounded-md text-emerald-600 transition-all border border-zinc-200 w-12 text-center">
            {Math.round(camera.scale * 100)}%
          </button>
        </div>
      </header>
      
      <LockBanner />

      <main className="flex-1 relative flex overflow-hidden pt-10">
        {/* 左侧资产库：固定宽度 256px (w-64) */}
        <div className="w-64 shrink-0 flex flex-col border-r border-zinc-200 bg-white relative z-10">
          <AssetGridSidebar key={`assets-${params.id}`} onAssetClick={(a: any) => setActiveAsset(a)} />
        </div>

        {/* 中间白板：自适应剩余空间 */}
        <div className="flex-1 relative overflow-hidden bg-zinc-50">
           <CanvasEngine key={`board-${params.id}`} />
        </div>

        {/* 右侧生成面板：固定宽度 384px (w-96)，强制防挤压 */}
        <div className="w-96 shrink-0 flex flex-col border-l border-zinc-200 bg-white relative z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.02)]">
          <GeneratePanel />
        </div>
      </main>

      <AssetDetailModal asset={activeAsset} onClose={() => setActiveAsset(null)} />
    </div>
  )
}
