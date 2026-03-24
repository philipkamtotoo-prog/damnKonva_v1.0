'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWhiteboardStore } from '@/store/whiteboard'
import AssetGridSidebar from '@/components/whiteboard/AssetGridSidebar'
import AssetDetailModal from '@/components/whiteboard/AssetDetailModal'
import GeneratePanel from '@/components/whiteboard/GeneratePanel'
import Link from 'next/link'

const CanvasEngine = dynamic(() => import('@/components/whiteboard/CanvasEngine'), { ssr: false })

export default function WhiteboardPage() {
  const params = useParams()
  const router = useRouter()
  const { camera, setCamera, items, addItem, isLinkingMode, setIsLinkingMode } = useWhiteboardStore()
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeAsset, setActiveAsset] = useState<any>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      if (data.user?.isApiAdmin) setIsAdmin(true)
    }).catch(console.error)
  }, [])

  const handleAddText = () => {
    const cx = -camera.x / camera.scale + window.innerWidth / 2 / camera.scale
    const cy = -camera.y / camera.scale + window.innerHeight / 2 / camera.scale
    addItem({ id: crypto.randomUUID(), itemType: 'text', x: cx, y: cy, zIndex: 10 })
  }

  const handleAddNote = () => {
    const cx = -camera.x / camera.scale + window.innerWidth / 2 / camera.scale
    const cy = -camera.y / camera.scale + window.innerHeight / 2 / camera.scale
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
          <span className="font-bold text-zinc-800 tracking-wide text-sm truncate max-w-[150px]">#{params.id}</span>
        </div>
        
        <div className="flex gap-2 items-center absolute left-1/2 -translate-x-1/2">
          <button onClick={handleAddText} className="text-xs bg-white hover:bg-zinc-50 px-3 py-1.5 rounded text-zinc-700 transition-colors border border-zinc-200">
            ＋ 新建文本框
          </button>
          <button onClick={handleAddNote} className="text-xs bg-white hover:bg-zinc-50 px-3 py-1.5 rounded text-zinc-700 transition-colors border border-zinc-200">
            ＋ 新建便签
          </button>
          <label className="text-xs bg-white hover:bg-zinc-50 px-3 py-1.5 rounded text-zinc-700 transition-colors border border-zinc-200 cursor-pointer">
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => {
                  const base64 = ev.target?.result as string
                  const cx = -camera.x / camera.scale + window.innerWidth / 2 / camera.scale
                  const cy = -camera.y / camera.scale + window.innerHeight / 2 / camera.scale
                  addItem({ id: crypto.randomUUID(), itemType: 'asset', content: base64, x: cx - 150, y: cy - 100, width: 300, height: 200, zIndex: 10 })
                }
                reader.readAsDataURL(file)
                e.target.value = ''
              }}
            />
            ＋ 上传图片
          </label>
          <button 
            onClick={() => setIsLinkingMode(!isLinkingMode)} 
            className={`text-xs px-3 py-1.5 rounded transition-all border ${isLinkingMode ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold animate-pulse' : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}
          >
            {isLinkingMode ? '取消连线 (Esc)' : '↗ 箭头连线'}
          </button>
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
      
      <main className="flex-1 relative flex overflow-hidden">
        <AssetGridSidebar key={`assets-${params.id as string}`} onAssetClick={(a: any) => setActiveAsset(a)} />
        <div className="flex-1 relative">
           <CanvasEngine key={`board-${params.id as string}`} />
        </div>
        <GeneratePanel />
      </main>

      <AssetDetailModal asset={activeAsset} onClose={() => setActiveAsset(null)} />
    </div>
  )
}
