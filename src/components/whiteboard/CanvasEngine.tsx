'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Stage, Layer, Arrow } from 'react-konva'
import { useWhiteboardStore, WhiteboardItem } from '@/store/whiteboard'
import { AssetItem, TextItem, NoteItem, ArrowItem } from './WhiteboardElements'

export default function CanvasEngine() {
  const params = useParams()
  const { camera, setCamera, items, arrows, updateItem, addItem, setItems, deleteItem, bringToFront, sendToBack, deleteArrow, isLinkingMode, setIsLinkingMode, linkingState, setLinkingState, addArrow, selectedId, setSelectedId, setArrows, clearBoard } = useWhiteboardStore()
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  
  const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number, isArrow?: boolean } | null>(null)
  const [editingText, setEditingText] = useState<{ id: string, x: number, y: number, content: string, itemType: string } | null>(null)

  // ResizeObserver: measure canvas container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Clipboard image pasting listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
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
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const syncedItemIds = useRef<Set<string>>(new Set())
  const syncedArrowIds = useRef<Set<string>>(new Set())

  // Load board data (items + arrows) from DB on mount
  useEffect(() => {
    console.log('[CanvasEngine] mount, projectId:', params.id)
    // Critical: clear all local state before loading new project data
    clearBoard()
    syncedItemIds.current.clear()
    syncedArrowIds.current.clear()
    console.log('[CanvasEngine] store cleared, fetching board...')

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

  // Sync new items securely mapped by Set filters preventing reload thrashing
  useEffect(() => {
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
  }, [items])

  // Sync new arrows
  useEffect(() => {
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
  }, [arrows])

  // Delete arrow from DB
  const handleDeleteArrow = async (id: string) => {
    deleteArrow(id)
    try {
      await fetch(`/api/projects/${params.id}/board/arrows?arrowId=${id}`, { method: 'DELETE' })
    } catch (e) {
      console.error('Failed to delete arrow from DB', e)
    }
  }

  // Persist item changes (position, size) to DB immediately
  const handleItemChange = (id: string, updates: Partial<any>) => {
    updateItem(id, updates)
    fetch(`/api/projects/${params.id}/board/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(e => console.error('Failed to persist item change', e))
  }

  // Esc exits linking mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLinkingMode) setIsLinkingMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLinkingMode])



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
    if (isLinkingMode) return
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
    if (linkingState) {
      setLinkingState(null) // Drag dropped onto empty space cancels link segment
    }
  }

  const handleItemMouseDown = (e: any, id: string) => {
    if (isLinkingMode) {
      e.cancelBubble = true
      const item = items.find(i => i.id === id)
      if (item) {
        let w = 240, h = 240
        if (item.itemType === 'asset') { w = item.width || 300; h = item.height || 200 }
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
    if (!isLinkingMode) {
      setSelectedId(id)
    }
  }

  const closeTextEditor = (newContent: string) => {
    if (editingText) updateItem(editingText.id, { content: newContent })
    setEditingText(null)
  }

  return (
    <div ref={containerRef} className={`w-full h-full bg-white overflow-hidden relative ${isLinkingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} 
         style={{ backgroundImage: 'radial-gradient(#e5e5e5 1px, transparent 1px)', backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}>
      
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable={!isLinkingMode}
          scaleX={camera.scale}
          scaleY={camera.scale}
          x={camera.x}
          y={camera.y}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleStageMouseUp}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) setCamera({ ...camera, x: e.target.x(), y: e.target.y() })
          }}
          onClick={(e) => { 
            if (e.target === stageRef.current) {
              setSelectedId(null)
            }
            setContextMenu(null)
            if (editingText) closeTextEditor(editingText.content) 
          }}
        >
          <Layer>
            {arrows.map(arrow => <ArrowItem key={arrow.id} arrow={arrow} items={items} onContextMenu={handleContextMenu} />)}
            
            {linkingState && (
               <Arrow
                 points={[
                   (() => {
                     const it = items.find(i => i.id === linkingState.fromId)
                     if (!it) return 0
                     let tw = 240, th = 240
                     if (it.itemType === 'asset') { tw = it.width || 300; th = it.height || 200 }
                     if (it.itemType === 'text') { tw = 150; th = 30 }
                     return it.x + tw/2
                   })(),
                   (() => {
                     const it = items.find(i => i.id === linkingState.fromId)
                     if (!it) return 0
                     let tw = 240, th = 240
                     if (it.itemType === 'asset') { tw = it.width || 300; th = it.height || 200 }
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
              if (item.itemType === 'asset') return <AssetItem key={item.id} item={item} isSelected={selectedId === item.id} isLinkingMode={isLinkingMode} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onChange={handleItemChange} />
              if (item.itemType === 'text') return <TextItem key={item.id} item={item} isLinkingMode={isLinkingMode} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick} onChange={handleItemChange} />
              if (item.itemType === 'note') return <NoteItem key={item.id} item={item} isLinkingMode={isLinkingMode} onSelect={(e: any) => handleItemClick(e, item.id)} onMouseDown={(e:any)=>handleItemMouseDown(e, item.id)} onMouseUp={(e:any)=>handleItemMouseUp(e, item.id)} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick} onChange={handleItemChange} />
              return null
            })}
          </Layer>
        </Stage>
      )}

      {/* HTML Overlays */}
      {contextMenu && (
        <div className="absolute bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-50 min-w-32 flex flex-col" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {!contextMenu.isArrow && (
            <>
              <button className="text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 text-sm" onClick={() => { bringToFront(contextMenu.id); setContextMenu(null) }}>置顶一层</button>
              <button className="text-left px-4 py-2 hover:bg-zinc-50 text-zinc-700 text-sm" onClick={() => { sendToBack(contextMenu.id); setContextMenu(null) }}>置底一层</button>
              
              {items.find(i => i.id === contextMenu.id)?.itemType === 'asset' && (
                <button className="text-left px-4 py-2 hover:bg-zinc-50 text-emerald-600 font-medium text-sm" onClick={async () => {
                  setContextMenu(null)
                  const item = items.find(i => i.id === contextMenu.id)
                  if (item && item.content) {
                    try {
                      const res = await fetch(item.content)
                      const blob = await res.blob()
                      const blobUrl = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = blobUrl
                      a.download = `asset-${item.id}.png`
                      a.click()
                      URL.revokeObjectURL(blobUrl)
                    } catch (e) {
                      window.open(item.content, '_blank')
                    }
                  }
                }}>下载图片</button>
              )}
              
              <div className="h-px bg-zinc-100 my-1"></div>
            </>
          )}
          <button className="text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm" onClick={() => { contextMenu.isArrow ? handleDeleteArrow(contextMenu.id) : deleteItem(contextMenu.id); setContextMenu(null) }}>删除</button>
        </div>
      )}

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
