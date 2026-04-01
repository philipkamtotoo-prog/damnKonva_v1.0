'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWhiteboardStore } from '@/store/whiteboard'
import AssetGridSidebar from '@/components/whiteboard/AssetGridSidebar'
import AssetDetailModal from '@/components/whiteboard/AssetDetailModal'
import GeneratePanel from '@/components/whiteboard/GeneratePanel'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

const CanvasEngine = dynamic(() => import('@/components/whiteboard/CanvasEngine'), { ssr: false })

// 只读模式提示 Banner
const LockBanner = () => {
  const { isReadOnly, lockOwner } = useWhiteboardStore()
  if (!isReadOnly) return null
  return (
    <div className="fixed top-14 inset-x-0 z-50 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-3 shadow-sm">
      <span className="text-amber-600 text-sm flex items-center gap-1">
        <span aria-hidden>🔒</span>
        <span>此项目正被 <strong className="text-amber-700">{lockOwner}</strong> 编辑，你当前为只读预览模式</span>
      </span>
      <span className="text-amber-400 text-xs">可缩放、滚动、预览、下载</span>
    </div>
  )
}

// 连线模式引导提示
const LinkingGuide = ({ visible }: { visible: boolean }) => {
  if (!visible) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium flex items-center gap-2 pointer-events-none"
         style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
      <span>👆</span>
      <span>点击第二个元素完成连线</span>
      <span className="text-zinc-400 text-xs ml-1">按 Esc 取消</span>
    </div>
  )
}

export default function WhiteboardPage() {
  const params = useParams()
  const router = useRouter()
  const { camera, setCamera, items, addItem, isLinkingMode, setIsLinkingMode, isReadOnly, setReadOnly, pushHistory, undo, redo, historyIndex, history } = useWhiteboardStore()
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeAsset, setActiveAsset] = useState<any>(null)
  const [projectName, setProjectName] = useState('')
  const [boardLoading, setBoardLoading] = useState(true)
  const lockRenewalRef = useRef<NodeJS.Timeout | null>(null)
  const { error: toastError } = useToast()

  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1

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

  // 撤销/重做键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canUndo, canRedo, undo, redo])

  // 监控 board 加载状态（通过 CanvasEngine 挂载时机）
  useEffect(() => {
    const timer = setTimeout(() => setBoardLoading(false), 800)
    return () => clearTimeout(timer)
  }, [params.id])

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
    pushHistory()
    const { cx, cy } = getCenter()
    addItem({ id: crypto.randomUUID(), itemType: 'text', x: cx, y: cy, zIndex: 10 })
  }

  const handleAddNote = () => {
    if (isReadOnly) return
    pushHistory()
    const { cx, cy } = getCenter()
    addItem({ id: crypto.randomUUID(), itemType: 'note', x: cx, y: cy, zIndex: 10 })
  }

  const handleZoomIn  = () => setCamera({ scale: Math.min(camera.scale * 1.2, 3) })
  const handleZoomOut = () => setCamera({ scale: Math.max(camera.scale / 1.2, 0.25) })
  const handleUndo = () => { if (canUndo) undo() }
  const handleRedo = () => { if (canRedo) redo() }

  return (
    <div key={params.id as string} className="flex flex-col h-screen w-screen overflow-hidden bg-white text-zinc-900 font-sans">
      <header className="h-14 border-b border-zinc-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 shadow-sm relative">
        <div className="flex gap-4 items-center">
          <button onClick={() => router.push('/projects')} aria-label="返回项目列表" className="text-zinc-500 hover:text-emerald-600 transition-colors text-sm font-medium flex items-center gap-1">
            &larr; 项目
          </button>
          <div className="h-4 w-px bg-zinc-300"></div>
          <span className="font-bold text-zinc-800 tracking-wide text-sm truncate max-w-[200px]">{projectName || `项目 ${params.id}`}</span>
        </div>

        <div className="flex gap-2 items-center absolute left-1/2 -translate-x-1/2">
          {/* 撤销 */}
          <Tooltip content="撤销 (Ctrl+Z)" position="bottom">
            <button onClick={handleUndo} disabled={!canUndo || isReadOnly} aria-label="撤销" className={`text-xs w-8 h-8 flex items-center justify-center rounded border transition-colors ${!canUndo || isReadOnly ? 'bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
              ↩
            </button>
          </Tooltip>
          {/* 重做 */}
          <Tooltip content="重做 (Ctrl+Y)" position="bottom">
            <button onClick={handleRedo} disabled={!canRedo || isReadOnly} aria-label="重做" className={`text-xs w-8 h-8 flex items-center justify-center rounded border transition-colors ${!canRedo || isReadOnly ? 'bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
              ↪
            </button>
          </Tooltip>

          <div className="h-5 w-px bg-zinc-300 mx-1"></div>

          <Tooltip content="在画布中心添加文本框" position="bottom">
            <button onClick={handleAddText} disabled={isReadOnly} className={`text-xs px-3 py-1.5 rounded border transition-colors ${isReadOnly ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
              ＋ 新建文本框
            </button>
          </Tooltip>
          <Tooltip content="在画布中心添加便签" position="bottom">
            <button onClick={handleAddNote} disabled={isReadOnly} className={`text-xs px-3 py-1.5 rounded border transition-colors ${isReadOnly ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
              ＋ 新建便签
            </button>
          </Tooltip>
          {isReadOnly ? (
            <span className="text-xs px-3 py-1.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed" aria-label="上传图片（只读模式不可用）">
              ＋ 上传图片
            </span>
          ) : (
            <Tooltip content="从本地上传图片到画布" position="bottom">
              <label className="text-xs bg-white hover:bg-zinc-50 px-3 py-1.5 rounded text-zinc-700 transition-colors border border-zinc-200 cursor-pointer">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const base64 = ev.target?.result as string
                      const { cx, cy } = getCenter()
                      pushHistory()
                      addItem({ id: crypto.randomUUID(), itemType: 'asset', content: base64, x: cx - 150, y: cy - 100, width: 300, height: 200, zIndex: 10 })
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
                ＋ 上传图片
              </label>
            </Tooltip>
          )}
          {isReadOnly ? (
            <span className={`text-xs px-3 py-1.5 rounded border border-zinc-200 bg-zinc-100 text-zinc-400`} aria-label="箭头连线（只读模式不可用）">
              ↗ 箭头连线
            </span>
          ) : (
            <Tooltip content={isLinkingMode ? '取消连线模式' : '绘制箭头连接两个元素'} position="bottom">
              <button
                onClick={() => setIsLinkingMode(!isLinkingMode)}
                className={`text-xs px-3 py-1.5 rounded transition-all border ${isLinkingMode ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold animate-pulse' : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
                aria-pressed={isLinkingMode}
              >
                {isLinkingMode ? '取消连线 (Esc)' : '↗ 箭头连线'}
              </button>
            </Tooltip>
          )}
        </div>

        <div className="flex gap-3 items-center">
          {isAdmin && (
            <button onClick={() => router.push('/admin/api-config')} aria-label="管理 API 配置" className="text-xs font-medium text-amber-600 hover:text-amber-500 px-2 flex items-center gap-1">
              ⚙️ 管理配置
            </button>
          )}
          <Tooltip content="缩小画布" position="bottom">
            <button onClick={handleZoomOut} aria-label="缩小" className="text-xs font-mono bg-white hover:bg-emerald-50 px-2 py-1.5 rounded-md text-emerald-600 transition-all border border-zinc-200 w-8 text-center">
              −
            </button>
          </Tooltip>
          <Tooltip content="重置缩放为 100%" position="bottom">
            <button onClick={() => setCamera({ scale: 1 })} aria-label="重置缩放" className="text-xs font-mono bg-white hover:bg-emerald-50 px-2 py-1.5 rounded-md text-emerald-600 transition-all border border-zinc-200 w-12 text-center">
              {Math.round(camera.scale * 100)}%
            </button>
          </Tooltip>
          <Tooltip content="放大画布" position="bottom">
            <button onClick={handleZoomIn} aria-label="放大" className="text-xs font-mono bg-white hover:bg-emerald-50 px-2 py-1.5 rounded-md text-emerald-600 transition-all border border-zinc-200 w-8 text-center">
              ＋
            </button>
          </Tooltip>
        </div>
      </header>
      
      <LockBanner />

      {/* 连线引导提示 */}
      <LinkingGuide visible={isLinkingMode} />

      <main className="flex-1 relative flex overflow-hidden pt-10">
        {/* 左侧资产库：固定宽度 256px (w-64) */}
        <div className="w-64 shrink-0 flex flex-col border-r border-zinc-200 bg-white relative z-10">
          <AssetGridSidebar key={`assets-${params.id}`} onAssetClick={(a: any) => setActiveAsset(a)} />
        </div>

        {/* 中间白板：自适应剩余空间 */}
        <div className="flex-1 relative overflow-hidden bg-zinc-50">
          {boardLoading && (
            <div className="absolute inset-0 z-40 bg-white/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <span className="animate-spin text-3xl text-emerald-600">⟳</span>
                <span className="text-sm text-zinc-500 animate-pulse">加载画布中...</span>
              </div>
            </div>
          )}
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
