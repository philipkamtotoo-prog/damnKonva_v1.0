'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Stage, Layer, Arrow } from 'react-konva'
import { useWhiteboardStore, WhiteboardItem } from '@/store/whiteboard'
import { AssetItem, TextItem, NoteItem, ArrowItem, VideoProxyItem } from './WhiteboardElements'

// ============================================================
// 第二步：HtmlVideoItem — DOM 视频渲染层
// 通过 window 事件 toggle 播放/暂停，坐标跟随 camera + item 位置
// ============================================================
function HtmlVideoItem({ item, camera }: { item: WhiteboardItem; camera: { x: number; y: number; scale: number } }) {
  const vidRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>
      if (custom.detail.id !== item.id) return
      const vid = vidRef.current
      if (!vid) return
      if (vid.paused) {
        vid.play().then(() => {}).catch(() => {})
      } else {
        vid.pause()
      }
    }
    window.addEventListener('whiteboard:video:toggle', handler)
    return () => window.removeEventListener('whiteboard:video:toggle', handler)
  }, [item.id])

  const left = item.x * camera.scale + camera.x
  const top = item.y * camera.scale + camera.y

  return (
    <video
      ref={vidRef}
      src={item.content}
      muted
      loop
      playsInline
      style={{
        position: 'absolute',
        left,
        top,
        width: (item.width || 300) * camera.scale,
        height: (item.height || 200) * camera.scale,
        transformOrigin: 'top left',
        pointerEvents: 'none',
        display: 'block',
        objectFit: 'cover',
      }}
    />
  )
}

export default function CanvasEngine() {
  const params = useParams()
  const { camera, setCamera, items, arrows, updateItem, addItem, setItems, deleteItem, bringToFront, sendToBack, deleteArrow, isLinkingMode, setIsLinkingMode, linkingState, setLinkingState, addArrow, selectedId, setSelectedId, setArrows, clearBoard, isReadOnly, lastAssetUpdate } = useWhiteboardStore()
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number, isArrow?: boolean } | null>(null)
  const [editingText, setEditingText] = useState<{ id: string, x: number, y: number, content: string, itemType: string } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isReadOnly) return
      const clipboardItems = e.clipboardData?.items
      if (!clipboardItems) return
      for (const item of clipboardItems) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = (event) => {
            const base64 = event.target?.result as string
            const cameraState = useWhiteboardStore.getState().camera
            const stage = stageRef.current
            const pointer = stage?.getPointerPosition() || { x: window.innerWidth / 2, y: window.innerHeight / 2 }
            const realX = (pointer.x - cameraState.x) / cameraState.scale
            const realY = (pointer.y - cameraState.y) / cameraState.scale

            useWhiteboardStore.getState().addItem({
              id: crypto.randomUUID(),
              itemType: 'asset',
              content: base64,
              x: realX - 150,
              y: realY - 100,
              width: 300,
              height: 200,
              zIndex: 10
            })
          }
          reader.readAsDataURL(file)
        }
      }
    }
    document.addEventListener('paste', handlePaste)

    const saveOnUnload = async () => {
      const state = useWhiteboardStore.getState()
      const allItems = state.items
      if (!allItems.length) return
      await Promise.all(allItems.map(itm =>
        fetch(`/api/projects/${params.id}/board/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itm)
        })
      ))
    }
    window.addEventListener('beforeunload', saveOnUnload)

    return () => {
      document.removeEventListener('paste', handlePaste)
      window.removeEventListener('beforeunload', saveOnUnload)
    }
  }, [])

  const syncedItemIds = useRef<Set<string>>(new Set())
  const syncedArrowIds = useRef<Set<string>>(new Set())

  // 项目切换时：清空并重新拉取全量数据
  useEffect(() => {
    clearBoard()
    syncedItemIds.current.clear()
    syncedArrowIds.current.clear()

    fetch(`/api/projects/${params.id}/board`)
      .then(r => r.json())
      .then(data => {
        if (data.items) {
          data.items.forEach((i: any) => syncedItemIds.current.add(i.id))
          setItems(data.items)
        }
        if (data.arrows) {
          data.arrows.forEach((a: any) => syncedArrowIds.current.add(a.id))
          setArrows(data.arrows.map((a: any) => ({
            id: a.id,
            fromItemId: a.fromItemId,
            toItemId: a.toItemId,
          })))
        }
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // lastAssetUpdate 变化时（生成新资产后）：从服务器增量合并 items，不覆盖本地未同步的新 items
  useEffect(() => {
    if (!params.id) return
    fetch(`/api/projects/${params.id}/board`)
      .then(r => r.json())
      .then(data => {
        if (!data.items || data.items.length === 0) return
        // 用 Map 按 id 去重：服务器数据优先，本地新加的（id 不在服务器）保留
        const serverIds = new Set(data.items.map((i: any) => i.id))
        const currentItems = useWhiteboardStore.getState().items
        // 合并：保留本地有但服务器没有的 items（新生成的），其余用服务器数据
        const merged = [
          ...currentItems.filter((ci) => !serverIds.has(ci.id)),
          ...data.items,
        ]
        setItems(merged)
        data.items.forEach((i: any) => syncedItemIds.current.add(i.id))
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssetUpdate])

  useEffect(() => {
    const state = useWhiteboardStore.getState()
    if (state.isReadOnly) return

    items.forEach(async (item) => {
      if (!syncedItemIds.current.has(item.id)) {
        syncedItemIds.current.add(item.id)
        try {
          await fetch(`/api/projects/${params.id}/board/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          })
        } catch (e) {
          syncedItemIds.current.delete(item.id)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, params.id])

  useEffect(() => {
    const state = useWhiteboardStore.getState()
    if (state.isReadOnly) return

    arrows.forEach(async (arrow) => {
      if (!syncedArrowIds.current.has(arrow.id)) {
        syncedArrowIds.current.add(arrow.id)
        try {
          await fetch(`/api/projects/${params.id}/board/arrows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(arrow),
          })
        } catch (e) {
          syncedArrowIds.current.delete(arrow.id)
        }
      }
    })
  }, [arrows, params.id])

  const handleDeleteArrow = async (id: string) => {
    deleteArrow(id)
    try {
      await fetch(`/api/projects/${params.id}/board/arrows?arrowId=${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Failed to delete arrow from DB', e)
    }
  }

  const handleDeleteItem = async (id: string) => {
    deleteItem(id)
    try {
      await fetch(`/api/projects/${params.id}/board/items/${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Failed to delete item from DB', e)
    }
  }

  const handleItemChange = async (id: string, updates: Partial<any>) => {
    updateItem(id, updates)
    await fetch(`/api/projects/${params.id}/board/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(e => console.error('Failed to persist item change', e))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLinkingMode) setIsLinkingMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLinkingMode, setIsLinkingMode])

  const handleWheel = (e: any) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const scaleBy = 1.1
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale }
    let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
    newScale = Math.max(0.25, Math.min(newScale, 3.0))
    setCamera({ scale: newScale, x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale })
    setContextMenu(null)
    setEditingText(null)
  }

  const handleContextMenu = (e: any, id: string, isArrow = false) => {
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (pointer) setContextMenu({ id, x: pointer.x, y: pointer.y, isArrow })
  }

  const handleDoubleClick = (e: any, item: WhiteboardItem) => {
    if (isLinkingMode || isReadOnly) return
    const stage = stageRef.current
    if (!stage) return
    const screenX = item.x * camera.scale + camera.x
    const screenY = item.y * camera.scale + camera.y
    setEditingText({ id: item.id, x: screenX, y: screenY, content: item.content || '', itemType: item.itemType })
    setContextMenu(null)
  }

  const handleMouseMove = (e: any) => {
    if (linkingState) {
      const stage = stageRef.current
      const pointer = stage.getPointerPosition()
      if (pointer) {
        const pt = { x: (pointer.x - stage.x()) / camera.scale, y: (pointer.y - stage.y()) / camera.scale }
        setLinkingState({ ...linkingState, toX: pt.x, toY: pt.y })
      }
    }
  }

  const handleStageMouseUp = (e: any) => {
    if (linkingState) setLinkingState(null)
  }

  const handleItemMouseDown = (e: any, id: string) => {
    if (isLinkingMode) {
      e.cancelBubble = true
      const item = items.find(i => i.id === id)
      if (item) {
        let w = 240, h = 240
        if (item.itemType === 'asset' || item.itemType === 'video') { w = item.width || 300; h = item.height || 200 }
        if (item.itemType === 'text') { w = 150; h = 30 }
        setLinkingState({ fromId: id, toX: item.x + w/2, toY: item.y + h/2 })
      }
    }
  }

  const handleItemMouseUp = (e: any, id: string) => {
    if (linkingState) {
      e.cancelBubble = true
      if (linkingState.fromId !== id) {
        addArrow({ id: crypto.randomUUID(), fromItemId: linkingState.fromId, toItemId: id })
      }
      setLinkingState(null)
      setIsLinkingMode(false)
    }
  }

  const handleItemClick = (e: any, id: string) => {
    if (!isLinkingMode) setSelectedId(id)
  }

  const closeTextEditor = (newContent: string) => {
    if (editingText) {
      updateItem(editingText.id, { content: newContent })
      handleItemChange(editingText.id, { content: newContent })
    }
    setEditingText(null)
  }

  return (
    <div ref={containerRef} className={`w-full h-full bg-white overflow-hidden relative ${isReadOnly ? 'cursor-not-allowed' : isLinkingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
         style={{ backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)', backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}>

      {/* Konva Stage */}
      {size.width > 0 && (
        <Stage
          ref={stageRef} width={size.width} height={size.height}
          draggable={!isReadOnly && !isLinkingMode} scaleX={camera.scale} scaleY={camera.scale}
          x={camera.x} y={camera.y}
          onWheel={handleWheel} onMouseMove={handleMouseMove} onMouseUp={handleStageMouseUp}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) setCamera({ ...camera, x: e.target.x(), y: e.target.y() })
          }}
          onClick={(e) => {
            if (e.target === stageRef.current) setSelectedId(null)
            setContextMenu(null)
            if (editingText) closeTextEditor(editingText.content)
          }}
        >
          {/* 静态渲染层：连线、图片、便签、视频替身 */}
          <Layer>
            {arrows.map(arrow => <ArrowItem key={arrow.id} arrow={arrow} items={items} onContextMenu={handleContextMenu} />)}

            {linkingState && (
              <Arrow
                points={[
                  (() => {
                    const it = items.find(i => i.id === linkingState.fromId)
                    if (!it) return 0
                    let tw = 240, th = 240
                    if (it.itemType === 'asset' || it.itemType === 'video') { tw = it.width || 300; th = it.height || 200 }
                    if (it.itemType === 'text') { tw = 150; th = 30 }
                    return it.x + tw/2
                  })(),
                  (() => {
                    const it = items.find(i => i.id === linkingState.fromId)
                    if (!it) return 0
                    let tw = 240, th = 240
                    if (it.itemType === 'asset' || it.itemType === 'video') { tw = it.width || 300; th = it.height || 200 }
                    if (it.itemType === 'text') { tw = 150; th = 30 }
                    return it.y + th/2
                  })(),
                  linkingState.toX, linkingState.toY
                ]}
                stroke="#f97316" fill="#f97316" strokeWidth={5} dash={[10, 5]} pointerLength={16} pointerWidth={16}
                listening={false}
              />
            )}

            {items.sort((a,b) => a.zIndex - b.zIndex).map(item => {
              if (item.itemType === 'asset') return <AssetItem key={item.id} item={item} isSelected={selectedId === item.id} isLinkingMode={isLinkingMode} isReadOnly={isReadOnly} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onChange={handleItemChange} />
              if (item.itemType === 'text') return <TextItem key={item.id} item={item} isSelected={selectedId === item.id} isLinkingMode={isLinkingMode} isReadOnly={isReadOnly} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick} onChange={handleItemChange} />
              if (item.itemType === 'note') return <NoteItem key={item.id} item={item} isSelected={selectedId === item.id} isLinkingMode={isLinkingMode} isReadOnly={isReadOnly} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick} onChange={handleItemChange} />
              if (item.itemType === 'video') return <VideoProxyItem key={item.id} item={item} isSelected={selectedId === item.id} isLinkingMode={isLinkingMode} isReadOnly={isReadOnly} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onChange={handleItemChange} />
              return null
            })}
          </Layer>
        </Stage>
      )}

      {/* ============================================================
          第二步：HtmlVideoOverlay — DOM 视频渲染层（脱离 Konva 管线）
          坐标严格跟随 camera 和 item 位置，pointer-events: none 穿透鼠标
          ============================================================ */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
        {items.filter(i => i.itemType === 'video').map(item => (
          <HtmlVideoItem key={item.id} item={item} camera={camera} />
        ))}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div className="absolute bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-50 min-w-32 flex flex-col" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {!contextMenu.isArrow && !isReadOnly && (
            <>
              <button className="text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 text-sm" onClick={() => { bringToFront(contextMenu.id); setContextMenu(null) }}>置顶一层</button>
              <button className="text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 text-sm" onClick={() => { sendToBack(contextMenu.id); setContextMenu(null) }}>置底一层</button>
            </>
          )}

          {!contextMenu.isArrow && (
            <>
              {['asset', 'video'].includes(items.find(i => i.id === contextMenu.id)?.itemType || '') && (
                <button className="text-left px-4 py-2 hover:bg-zinc-50 text-emerald-600 font-medium text-sm" onClick={async () => {
                  setContextMenu(null)
                  const item = items.find(i => i.id === contextMenu.id)
                  if (item && item.content) {
                    try {
                      const targetUrl = item.content
                      const res = await fetch(targetUrl)
                      const blob = await res.blob()
                      const blobUrl = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = blobUrl
                      a.download = `大葱画板导出_${item.id.slice(0,6)}.${item.itemType === 'video' ? 'mp4' : 'png'}`
                      a.click()
                      URL.revokeObjectURL(blobUrl)
                    } catch {
                      window.open(item.content, '_blank')
                    }
                  }
                }}>下载素材</button>
              )}
            </>
          )}

          {!contextMenu.isArrow && !isReadOnly && <div className="h-px bg-zinc-100 my-1"></div>}
          {!isReadOnly && (
            <button className="text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm" onClick={() => { contextMenu.isArrow ? handleDeleteArrow(contextMenu.id) : handleDeleteItem(contextMenu.id); setContextMenu(null) }}>删除</button>
          )}
        </div>
      )}

      {/* 便签/文本编辑器 */}
      {editingText && (
        <textarea
          autoFocus
          className="absolute z-50 bg-white/95 text-zinc-900 font-sans p-2 rounded shadow-2xl border-2 border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          style={{
            left: editingText.x, top: editingText.y,
            transform: `scale(${camera.scale})`, transformOrigin: 'top left',
            minWidth: editingText.itemType === 'note' ? 200 : 150, minHeight: editingText.itemType === 'note' ? 180 : 40,
            fontSize: editingText.itemType === 'note' ? 16 : 24
          }}
          value={editingText.content}
          onChange={(e) => setEditingText({ ...editingText, content: e.target.value })}
          onBlur={(e) => closeTextEditor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') closeTextEditor(editingText.content) }}
        />
      )}
    </div>
  )
}
