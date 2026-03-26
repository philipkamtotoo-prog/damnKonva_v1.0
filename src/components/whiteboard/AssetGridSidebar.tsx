'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useWhiteboardStore } from '@/store/whiteboard'

interface Asset {
  id: string
  type: string
  name: string
  status: string
  thumbnailUrl?: string
  originalUrl?: string
  prompt?: string
  negativePrompt?: string
  params?: string
  createdBy?: string
  createdAt: string
}

export default function AssetGridSidebar({ onAssetClick }: { onAssetClick?: (asset: Asset) => void }) {
  const params = useParams()
  const { addItem, camera, lastAssetUpdate, isReadOnly } = useWhiteboardStore()
  const [assets, setAssets] = useState<Asset[]>([])
  
  useEffect(() => {
    if (!params.id) return
    setAssets([]) // clear stale assets immediately on project switch
    fetch(`/api/projects/${params.id}/assets`)
      .then(r => r.json())
      .then(data => setAssets(data.assets ?? []))
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, lastAssetUpdate]) // lastAssetUpdate 仅作触发器，不在体内使用

  const dragToBoard = (asset: Asset) => {
    if (isReadOnly) return
    // Drop target implementation - place at center of camera
    const centerX = -camera.x / camera.scale + window.innerWidth / 2 / camera.scale
    const centerY = -camera.y / camera.scale + window.innerHeight / 2 / camera.scale
    // 核心修复：如果是视频资产，设为 'video'，否则是 'asset'
    const isVideo = asset.type === 'video' || String(asset.originalUrl || '').toLowerCase().includes('.mp4')
    addItem({
      id: crypto.randomUUID(),
      itemType: isVideo ? 'video' : 'asset',
      refId: asset.id,
      content: asset.originalUrl,
      x: centerX - 150,
      y: centerY - 100,
      width: isVideo ? 480 : 300,
      height: isVideo ? 270 : 200,
      zIndex: 10
    })
  }

  return (
    <div className="w-64 border-r border-zinc-200 bg-zinc-50 flex flex-col h-full shrink-0">
      {isReadOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-600 text-center flex items-center justify-center gap-1">
          🔒 只读模式 · 拖放功能已禁用
        </div>
      )}
      <div className="p-4 border-b border-zinc-200 shrink-0 flex justify-between items-center bg-white shadow-sm z-10">
        <h2 className="text-sm font-bold text-zinc-900 tracking-wide">素材图库网格</h2>
        <span className="text-xs text-zinc-500 font-mono">{assets.length} items</span>
      </div>
      
      <div className="flex-1 overflow-y-auto min-h-0 p-4 pb-24">
        {assets.length === 0 ? (
          <div className="text-zinc-400 text-xs text-center py-8">空空如也，请先生成素材</div>
        ) : (
          <div className="columns-2 gap-3 space-y-3">
            {assets.map(asset => (
              <div 
                key={asset.id} 
                className="break-inside-avoid bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden relative hover:border-emerald-500 transition-all group flex flex-col"
              >
                 <div className="flex-1 cursor-pointer relative" onClick={() => onAssetClick?.(asset)} title="点击查看详情">
                   {(() => {
                     const isVideoType = asset.type === 'video'
                     if (asset.thumbnailUrl || asset.originalUrl) {
                       if (isVideoType) {
                         return (
                           <>
                             <video
                               src={asset.originalUrl || asset.thumbnailUrl || ''}
                               muted
                               autoPlay
                               loop
                               playsInline
                               className="w-full h-auto object-contain block"
                             />
                             <span className="absolute top-1 right-1 text-xs bg-black/60 text-white px-1 rounded font-bold">🎬</span>
                           </>
                         )
                       }
                       return <img src={asset.thumbnailUrl || asset.originalUrl || ''} alt={asset.name} className="w-full h-auto object-contain block" />
                     }
                     return (
                       <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs text-center p-2 break-all group-hover:text-emerald-600">
                         {asset.name || 'Untitled'}
                       </div>
                     )
                   })()}
                 </div>
                 
                 {/* Action Bar */}
                 <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur text-[10px] px-2 py-1 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity border-t border-zinc-100">
                   <span className="truncate text-zinc-500 w-1/2">{new Date(asset.createdAt).toLocaleDateString()}</span>
                   <button onClick={(e) => { e.stopPropagation(); dragToBoard(asset); }} className={`text-emerald-600 hover:text-white px-2 py-0.5 rounded text-xs font-bold leading-none cursor-pointer transition-colors shadow-sm ${isReadOnly ? 'opacity-40 cursor-not-allowed bg-emerald-50' : 'bg-emerald-50 hover:bg-emerald-500'}`}>
                     {isReadOnly ? '🔒 只读' : '+ 放入白板'}
                   </button>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
