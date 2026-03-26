'use client'

import React, { useState, useMemo } from 'react';
import { useWhiteboardStore } from '@/store/whiteboard';
import { useParams } from 'next/navigation';

export default function GeneratePanel() {
  const params = useParams();
  const projectId = params.id as string;
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  
  // 增加 frameType，让用户自由选择身份
  const [refImages, setRefImages] = useState<{id: string, url: string, source: 'local'|'board', frameType: 'ref'|'start'|'end'}[]>([]);
  
  const [form, setForm] = useState({
    corePrompt: '',
    style: '',
    character: '',
    action: '',
    negativePrompt: '',
    imageSize: '1024x1024',
    videoSize: '2K', // 视频默认 2K
    count: 1
  });

  const { items, selectedId, addItem, triggerAssetUpdate, isReadOnly } = useWhiteboardStore();

  const finalPrompt = useMemo(() => {
    let p = form.corePrompt.trim();
    if (!p) return '';
    if (form.character) p += `。角色设定：${form.character}`;
    if (form.action) p += `。动作与场景：${form.action}`;
    if (form.style) p += `。整体风格：${form.style}`;
    return p;
  }, [form]);

  // Canvas 压缩：将图片 File 压缩为最大 1024 宽高、0.8 质量的 webp Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const MAX = 1024
        let w = img.naturalWidth, h = img.naturalHeight
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas 压缩失败')); return }
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }, 'image/webp', 0.8)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
      img.src = url
    })
  }

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 10) return alert('最多支持 10 张参考图！');
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file)
        setRefImages(prev => [...prev, { id: crypto.randomUUID(), url: base64, source: 'local', frameType: 'ref' }]);
      } catch {
        alert(`图片 ${file.name} 压缩失败，已跳过`);
      }
    }
  };

  const handlePickFromBoard = () => {
    if (!selectedId) return alert('请先在左侧画板点击选中一张图片！');
    const selectedItem = items.find(i => i.id === selectedId);
    if (selectedItem && selectedItem.itemType === 'asset') {
      if (refImages.length >= 10) return alert('最多支持 10 张参考图！');
      setRefImages(prev => [...prev, { id: crypto.randomUUID(), url: selectedItem.content, source: 'board', frameType: 'ref' }]);
    } else {
      alert('选中的元素不是有效的图片！');
    }
  };

  const removeImage = (id: string) => setRefImages(prev => prev.filter(img => img.id !== id));
  
  const changeFrameType = (id: string, newType: 'ref'|'start'|'end') => {
    setRefImages(prev => prev.map(img => img.id === id ? { ...img, frameType: newType } : img));
  };

  const handleGenerate = async () => {
    if (isReadOnly) return
    if (!form.corePrompt) return alert('核心提示词不能为空！');
    setIsGenerating(true);
    setProgressText(`正在提交${mode === 'image' ? '生图' : '视频'}任务...`);

    try {
      if (mode === 'image') {
        // 调用你现有的图片生成接口
        const res = await fetch('/api/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            prompt: finalPrompt,
            negativePrompt: form.negativePrompt,
            size: form.imageSize,
            n: form.count,
            image: refImages.length > 0 ? refImages[0].url : undefined
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        // 返回了 assets 数组，遍历全部加入白板，防止重叠加偏移
        const assets = data.assets ?? []
        assets.forEach((asset: any, index: number) => {
          const url = asset.originalUrl || asset.thumbnailUrl
          if (url) {
            addItem({
              id: crypto.randomUUID(), itemType: 'asset', content: url,
              x: 100 + index * 50, y: 100 + index * 50, width: 400, height: 400, zIndex: 10
            })
          }
        })
        triggerAssetUpdate()
        setProgressText('生图成功！资产已入库并加入画板。');
        
      } else {
        // ========== 视频生成流程 ==========
        // 1. 整理图片顺序：首帧 -> 普通参考 -> 尾帧
        const startFrames = refImages.filter(i => i.frameType === 'start');
        const refFrames = refImages.filter(i => i.frameType === 'ref');
        const endFrames = refImages.filter(i => i.frameType === 'end');
        const sortedImages = [...startFrames, ...refFrames, ...endFrames];

        // 2. 提交任务
        const taskRes = await fetch('/api/generate/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: String(projectId),
            prompt: finalPrompt,
            negativePrompt: form.negativePrompt,
            referenceImages: sortedImages
          })
        });
        const taskData = await taskRes.json();
        if (!taskRes.ok) throw new Error(taskData.error);

        // 没有 taskId 直接抛错，绝对不让 undefined 进入轮询
        if (!taskData.taskId) throw new Error('未能获取视频任务ID，请看后端终端日志');

        setProgressText('视频渲染中，请耐心等待 (约需2-5分钟)...');

        // 3. 轮询状态接口（GET），setTimeout 递归确保后台 tab 也能继续轮询
        let pollCount = 0
        const MAX_POLLS = 300 // 最多 300 次 × 5s = 25 分钟
        const poll = async () => {
          pollCount++
          const params = new URLSearchParams({ taskId: taskData.taskId, projectId: String(projectId), prompt: finalPrompt })
          const pollRes = await fetch(`/api/generate/video/status?${params.toString()}`)
          const pollData = await pollRes.json()

          if (pollData.status === 'succeed') {
            addItem({
              id: crypto.randomUUID(), itemType: 'video', content: pollData.videoUrl,
              x: 100, y: 100, width: 400, height: 225, zIndex: 10
            });
            setIsGenerating(false);
            triggerAssetUpdate();
            setProgressText('视频生成成功！资产已入库并加入画板。');
          } else if (pollData.status === 'failed') {
            setIsGenerating(false);
            setProgressText('');
            alert(`视频合成失败: ${pollData.error}`);
          } else {
            setProgressText(`视频渲染中(${pollCount})，请耐心等待...`);
            if (pollCount < MAX_POLLS) {
              setTimeout(poll, 5000)
            } else {
              setIsGenerating(false);
              setProgressText('');
              alert('视频生成超时，请稍后重试。');
            }
          }
        }
        setTimeout(poll, 3000);
        return; 
      }
    } catch (err: any) {
      alert(`生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgressText(''), 3000);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-zinc-200 overflow-y-auto">
      {isReadOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-600 text-center flex items-center justify-center gap-1">
          🔒 只读模式 · 生成功能已禁用
        </div>
      )}
      <div className="flex border-b border-zinc-200">
        <button className={`flex-1 py-3 font-medium text-sm ${mode === 'image' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:bg-zinc-50'}`} onClick={() => setMode('image')}>图片生成</button>
        <button className={`flex-1 py-3 font-medium text-sm ${mode === 'video' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:bg-zinc-50'}`} onClick={() => setMode('video')}>视频生成</button>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">🔗 参考图 (垫图/首尾帧) {refImages.length}/10</label>
          <div className="flex gap-2 mb-2">
            <label className={`flex-1 border border-dashed rounded p-2 text-center text-xs cursor-pointer ${isReadOnly ? 'border-zinc-200 text-zinc-300 cursor-not-allowed' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'}`}>
              📁 本地图上传
              {!isReadOnly && <input type="file" multiple accept="image/*" className="hidden" onChange={handleLocalUpload} />}
            </label>
            <button className={`flex-1 border border-dashed rounded p-2 text-center text-xs ${isReadOnly ? 'border-zinc-200 text-zinc-300 cursor-not-allowed' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'} ${!isReadOnly ? 'cursor-pointer' : ''}`} onClick={isReadOnly ? undefined : handlePickFromBoard}>
              🎯 画板选中图
            </button>
          </div>
          
          {refImages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {refImages.map((img) => (
                <div key={img.id} className="relative aspect-video bg-zinc-100 rounded overflow-hidden group border border-zinc-200">
                  <img src={img.url} alt="ref" className="w-full h-full object-cover" />

                  {/* 帧类型选择器：放在 overlay 外面，避免被 hover 层遮挡 */}
                  {mode === 'video' && (
                    <div className="absolute top-1 left-1 z-10">
                      <select
                        className="text-[10px] p-0.5 rounded bg-white/90 border-none outline-none text-zinc-700 font-medium"
                        value={img.frameType}
                        onChange={(e) => changeFrameType(img.id, e.target.value as any)}
                      >
                        <option value="ref">普通参考</option>
                        <option value="start">设为首帧</option>
                        <option value="end">设为尾帧</option>
                      </select>
                    </div>
                  )}

                  {/* 黑色 hover 删除层 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button onClick={() => removeImage(img.id)} className="text-white text-xs bg-red-500 px-2 py-1 rounded">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">📝 核心提示词</label>
          <textarea className="w-full border border-zinc-300 rounded p-2 text-sm min-h-20 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="描述核心主干..." value={form.corePrompt} onChange={e => setForm({...form, corePrompt: e.target.value})} />
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">🎨 风格定义</label>
          <input className="w-full border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="例如: 赛博朋克, 水彩画" value={form.style} onChange={e => setForm({...form, style: e.target.value})} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-emerald-700 mb-1">👤 角色锚点</label>
          <input className="w-full border-2 border-emerald-500 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="例如: 白发少女, 高大骑士" value={form.character} onChange={e => setForm({...form, character: e.target.value})} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">🎬 动作描述与场景</label>
          <input className="w-full border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="例如: 在雨中奔跑" value={form.action} onChange={e => setForm({...form, action: e.target.value})} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-red-600 mb-1">🚫 反向提示词 (禁止项)</label>
          <input className="w-full border border-zinc-300 rounded p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="例如: 低质量, 模糊" value={form.negativePrompt} onChange={e => setForm({...form, negativePrompt: e.target.value})} />
        </div>

        <div className="bg-zinc-50 p-2 rounded border border-zinc-200">
          <label className="block text-[10px] text-zinc-400 mb-1">🛠️ 最终组装的正向参数 (预览)</label>
          <p className="text-xs text-zinc-600 break-words">{finalPrompt || '等待输入...'}</p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-zinc-700 mb-1">尺寸限定</label>
            {mode === 'image' ? (
              <select className="w-full border border-zinc-300 rounded p-2 text-sm" value={form.imageSize} onChange={e => setForm({...form, imageSize: e.target.value})}>
                <option value="2048x2048">2048x2048 (1:1 / 2K)</option>
                <option value="2848x1600">2848x1600 (16:9 / 2K)</option>
                <option value="3072x3072">3072x3072 (1:1 / 3K)</option>
                <option value="4096x2304">4096x2304 (16:9 / 3K)</option>
              </select>
            ) : (
              <select className="w-full border border-zinc-300 rounded p-2 text-sm" value={form.videoSize} onChange={e => setForm({...form, videoSize: e.target.value})}>
                <option value="2K">2K 分辨率</option>
                <option value="3K">3K 分辨率</option>
              </select>
            )}
          </div>
          
          {mode === 'image' && (
             <div className="flex-1">
               <label className="block text-xs font-semibold text-zinc-700 mb-1">生图数量</label>
               <select className="w-full border border-zinc-300 rounded p-2 text-sm" value={form.count} onChange={e => setForm({...form, count: Number(e.target.value)})}>
                 <option value={1}>1 张</option>
                 <option value={2}>2 张</option>
                 <option value={4}>4 张</option>
               </select>
             </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || isReadOnly}
          className={`w-full py-3 rounded text-white font-bold text-sm transition-colors ${isGenerating || isReadOnly ? 'bg-emerald-400 cursor-not-allowed opacity-60' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isReadOnly ? '🔒 只读模式，不可生成' : isGenerating ? '生成中...' : '✨ 魔法组装并生成'}
        </button>

        {progressText && (
          <p className="text-center text-xs text-emerald-600 font-medium animate-pulse">{progressText}</p>
        )}
      </div>
    </div>
  );
}
