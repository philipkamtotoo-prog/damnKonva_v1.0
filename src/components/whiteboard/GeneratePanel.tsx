'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useWhiteboardStore } from '@/store/whiteboard'

export default function GeneratePanel() {
  const params = useParams()
  const { addItem, camera, triggerAssetUpdate } = useWhiteboardStore()
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image')
  
  // New Prompt Structures
  const [prompt, setPrompt] = useState('')
  const [stylePrompt, setStylePrompt] = useState('')
  const [characterPrompt, setCharacterPrompt] = useState('')
  const [actionPrompt, setActionPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)

  const [size, setSize] = useState('1024x1024')
  const [amount, setAmount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { selectedId, items } = useWhiteboardStore()

  const handleUseSelected = async () => {
    if (!selectedId) return alert('请先在画板中点击选中一张作为参考图的内容')
    const item = items.find(i => i.id === selectedId)
    if (item && item.itemType === 'asset' && item.content) {
      try {
        setLoading(true)
        const res = await fetch(item.content)
        const blob = await res.blob()
        const reader = new FileReader()
        reader.onload = (ev) => {
          setReferenceImage(ev.target?.result as string)
          setLoading(false)
        }
        reader.readAsDataURL(blob)
      } catch(err) {
        alert('受跨域安控限制，无法将该白板图转换为本地代码，请右键下载后使用 [本地文件] 方式上传。')
        setLoading(false)
      }
    } else {
      alert('请确保选中的是一张图像素材卡片')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setReferenceImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Assemble prompts safely
    const parts = []
    if (prompt.trim()) parts.push(prompt.trim())
    if (stylePrompt.trim()) parts.push(`Style: ${stylePrompt.trim()}`)
    if (characterPrompt.trim()) parts.push(`Character: ${characterPrompt.trim()}`)
    if (actionPrompt.trim()) parts.push(`Action/Setting: ${actionPrompt.trim()}`)
    
    const combinedPrompt = parts.join(', ')
    if (!combinedPrompt) {
      alert("至少填写一项提示词 (核心/风格/角色/动作)")
      return
    }

    let sanitizedSize = size.toLowerCase().replace(/[*X×，,]/gi, 'x').replace(/\s+/g, '')
    if (!/^\d+x\d+$/.test(sanitizedSize)) {
      alert("尺寸格式不正确，务必使用 宽x高 格式，例如 1024x1024 或 512x512")
      return
    }

    setLoading(true)
    setProgress(0)
    abortControllerRef.current = new AbortController()

    try {
      const centerX = -camera.x / camera.scale + window.innerWidth / 2 / camera.scale
      const centerY = -camera.y / camera.scale + window.innerHeight / 2 / camera.scale

      const [w, h] = sanitizedSize.split('x').map(Number)
      const ratio = isNaN(w) || isNaN(h) ? 1 : w / h
      const baseW = 300
      const baseH = 300 / ratio

      for (let i = 0; i < amount; i++) {
        if (abortControllerRef.current?.signal.aborted) break
        setProgress(i + 1)
        
        const res = await fetch(`/api/generate/${activeTab}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             projectId: params.id, 
             prompt: combinedPrompt, 
             negativePrompt, 
             size: sanitizedSize, 
             n: 1,
             image: referenceImage
          }),
          signal: abortControllerRef.current.signal
        })
        const data = await res.json()
        
        if (!res.ok) throw new Error(data.error)

        triggerAssetUpdate()

        const assetsToAdd = data.assets || [data.asset]
        assetsToAdd.forEach((asset: any) => {
          if (asset) {
             addItem({
              id: crypto.randomUUID(),
              itemType: 'asset',
              refId: asset.id,
              content: asset.originalUrl,
              x: centerX - (baseW/2) + (i * (baseW + 20)),
              y: centerY - (baseH/2),
              width: baseW,
              height: baseH,
              zIndex: 10
            })
          }
        })
      }
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Just silent abort
      } else {
        alert('Generation Failed: ' + err.message)
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
  }

  return (
    <div className="w-80 border-l border-zinc-200 bg-white flex flex-col h-full shrink-0 shadow-lg relative z-20">
      <div className="flex bg-zinc-50 border-b border-zinc-200 shrink-0">
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'image' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-white' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          图片生成
        </button>
        <button 
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'video' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-white' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          视频生成
        </button>
      </div>

      <form onSubmit={handleGenerate} className="p-5 flex-1 overflow-y-auto space-y-4">
        {/* Reference Image */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">🔗 参考图 (垫图/图生图)</label>
          {referenceImage ? (
            <div className="relative w-full h-32 bg-zinc-50 rounded-lg border-2 border-zinc-200 overflow-hidden group">
              <img src={referenceImage} alt="Reference" className="w-full h-full object-contain" />
              <button type="button" onClick={() => setReferenceImage(null)} className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow">✕</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer bg-white border border-dashed border-zinc-300 hover:border-emerald-500 rounded-lg p-3 text-center text-xs text-zinc-500 hover:text-emerald-600 transition-colors shadow-sm cursor-pointer">
                <div className="text-lg opacity-50 mb-1">📁</div>
                本地图上传
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
              <button type="button" onClick={handleUseSelected} disabled={loading} className="flex-1 bg-white border border-dashed border-zinc-300 hover:border-emerald-500 rounded-lg p-3 text-center text-xs text-zinc-500 hover:text-emerald-600 transition-colors shadow-sm active:bg-zinc-50">
                <div className="text-lg opacity-50 mb-1">🎯</div>
                画板选中图
              </button>
            </div>
          )}
        </div>

        {/* Core Prompt */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">📝 核心提示词</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} disabled={loading} placeholder="描述核心主干..." className="w-full h-16 bg-white border-2 border-zinc-200 rounded-lg p-2 text-sm text-zinc-900 focus:outline-none focus:border-emerald-500 outline-none resize-none placeholder:text-zinc-300" />
        </div>

        {/* Style */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">🎨 风格定义</label>
          <input type="text" value={stylePrompt} onChange={e => setStylePrompt(e.target.value)} disabled={loading} placeholder="例如：赛博朋克, 水彩画, 极简风" className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-emerald-500 outline-none placeholder:text-zinc-300" />
        </div>

        {/* Character */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">👤 角色锚点</label>
          <input type="text" value={characterPrompt} onChange={e => setCharacterPrompt(e.target.value)} disabled={loading} placeholder="例如：白发少女, 高大骑士" className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-emerald-500 outline-none placeholder:text-zinc-300" />
        </div>

        {/* Action */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">🎬 动作描述与场景</label>
          <input type="text" value={actionPrompt} onChange={e => setActionPrompt(e.target.value)} disabled={loading} placeholder="例如：在雨中奔跑, 坐在夕阳下的长椅上" className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-emerald-500 outline-none placeholder:text-zinc-300" />
        </div>

        {/* Negative */}
        <div className="pt-2 border-t border-zinc-100">
          <label className="block text-[11px] font-bold text-red-500 mb-1 uppercase tracking-wider">🚫 反向提示词 (禁止出现的内容)</label>
          <input type="text" value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} disabled={loading} placeholder="例如：低质量, 模糊, 多余的手提" className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-red-400 focus:ring-1 focus:ring-red-400/20 outline-none placeholder:text-zinc-300" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">自由尺寸参数</label>
            <input type="text" value={size} onChange={e => setSize(e.target.value)} disabled={loading} placeholder="1024x1024" className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-emerald-500 outline-none placeholder:text-zinc-300 font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-500 mb-1 uppercase tracking-wider">生图数量</label>
            <select value={amount} onChange={e => setAmount(Number(e.target.value))} disabled={loading} className="w-full bg-white border-2 border-zinc-200 rounded p-2 text-sm text-zinc-900 focus:border-emerald-500 outline-none font-medium">
              <option value="1">1 张图片</option>
              <option value="2">2 张串流</option>
              <option value="3">3 张串流</option>
              <option value="4">4 张串流</option>
            </select>
          </div>
        </div>

        {/* DALL-E 3 官方尺寸快捷按钮 */}
        <div className="flex gap-2">
          {(['1024x1024', '1792x1024', '1024x1792'] as const).map(s => (
            <button key={s} type="button" onClick={() => setSize(s)} disabled={loading} className={`flex-1 text-[10px] font-mono font-bold py-1.5 px-1 rounded transition-all border ${size === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-zinc-500 border-zinc-200 hover:border-emerald-400 hover:text-emerald-600'}`}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <button type="button" onClick={handleCancel} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 mt-4 rounded-lg transition-all border border-red-500/50 shadow-lg flex items-center justify-center gap-2 animate-pulse">
            🛑 停止串流 {amount > 1 ? `(${progress}/${amount})` : ''}
          </button>
        ) : (
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 mt-4 rounded-lg transition-all border border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] shadow-md group flex items-center justify-center gap-2">
            ✨ 魔法组装并生成
          </button>
        )}
      </form>
    </div>
  )
}
