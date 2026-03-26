'use client'

export default function AssetDetailModal({ asset, onClose }: { asset: any, onClose: () => void }) {
  if (!asset) return null

  const isVideo = asset.type === 'video' || String(asset.originalUrl || '').toLowerCase().includes('.mp4')
  const videoSrc = isVideo && asset.originalUrl ? `/api/proxy/video?url=${encodeURIComponent(asset.originalUrl)}` : asset.originalUrl

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full w-8 h-8 flex items-center justify-center transition-colors z-10"
        >
          ✕
        </button>

        <div className="flex-1 bg-black/50 p-6 flex items-center justify-center min-h-[300px]">
          {isVideo ? (
            <video
              src={videoSrc}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <img src={asset.originalUrl || asset.thumbnailUrl || 'https://via.placeholder.com/800'} className="max-w-full max-h-full object-contain" alt={asset.name} />
          )}
        </div>

        <div className="w-full md:w-80 p-6 flex flex-col gap-6 overflow-y-auto bg-zinc-900 border-l border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 mb-1">{asset.name || 'Untitled'}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-emerald-400 border border-zinc-700 uppercase tracking-wider">{asset.type || 'image'}</span>
              <span className="text-zinc-500">{new Date(asset.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Prompt</label>
              <div className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800 break-words">
                {asset.prompt || 'None'}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Negative Prompt</label>
              <div className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800 break-words">
                {asset.negativePrompt || 'None'}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Parameters</label>
              <div className="text-xs text-zinc-400 bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono">
                {asset.params ? JSON.stringify(JSON.parse(asset.params), null, 2) : 'No extra params'}
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              Created by: <span className="text-zinc-300">{asset.createdBy || 'System'}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-zinc-800">
            <button
              onClick={() => {
                const link = document.createElement('a')
                link.href = isVideo ? videoSrc : asset.originalUrl
                link.download = `${asset.name || 'asset'}.${isVideo ? 'mp4' : 'png'}`
                link.target = '_blank'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              📥 下载{isVideo ? '视频' : '原文件'}
            </button>
            <button
              onClick={async () => {
                if (confirm('确定彻底删除该素材吗？')) {
                  await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
                  const { useWhiteboardStore } = await import('@/store/whiteboard')
                  useWhiteboardStore.getState().triggerAssetUpdate()
                  onClose()
                }
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium py-2.5 rounded-lg border border-red-500/20 transition-colors"
            >
              删除素材
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
