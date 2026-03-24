import { useState, useEffect, useRef } from 'react'
import { Text, Rect, Group, Image as KonvaImage, Circle, Arrow, Transformer } from 'react-konva'
import { useWhiteboardStore } from '@/store/whiteboard'

const usePreloadImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | undefined>()
  useEffect(() => {
    if (!url) return
    const img = new window.Image()
    // By removing crossOrigin, we avoid CORS issues that prevent rendering images from arbitrary upstream proxy links
    img.src = url
    img.onload = () => setImage(img)
    img.onerror = () => { console.error('Image load failed for', url); setImage(img) }
  }, [url])
  return [image]
}

export const AssetItem = ({ item, isSelected, onSelect, onMouseDown, onMouseUp, onContextMenu, onChange, isLinkingMode }: any) => {
  const [img] = usePreloadImage(item.content)
  const shapeRef = useRef<any>(null)
  const trRef = useRef<any>(null)

  useEffect(() => {
    if (img && item.width && item.height) {
      const actualRatio = img.width / img.height
      const currentRatio = item.width / item.height
      if (Math.abs(actualRatio - currentRatio) > 0.05) {
        useWhiteboardStore.getState().updateItem(item.id, { height: item.width / actualRatio })
      }
    }
  }, [img, item.width, item.height, item.id])

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Group
        ref={shapeRef}
        x={item.x} y={item.y}
        width={item.width || 300}
        height={item.height || 200}
        draggable={!isLinkingMode}
        onClick={onSelect}
        onTap={onSelect}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu(e, item.id) }}
        onDragEnd={(e) => onChange(item.id, { x: e.target.x(), y: e.target.y() })}
        onTransformEnd={(e) => {
          const node = shapeRef.current
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange(item.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(20, node.width() * scaleX),
            height: Math.max(20, node.height() * scaleY)
          })
        }}
      >
        <Rect width={item.width || 300} height={item.height || 200} fill="#f4f4f5" shadowColor="#000" shadowBlur={10} shadowOpacity={0.1} />
        {img ? (
          <KonvaImage image={img} width={item.width || 300} height={item.height || 200} />
        ) : (
          <Text x={10} y={10} text="Loading..." fill="#71717a" fontSize={12} />
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

export const TextItem = ({ item, onSelect, onMouseDown, onMouseUp, onContextMenu, onDoubleClick, onChange, isLinkingMode }: any) => {
  return (
    <Text
      x={item.x} y={item.y}
      text={item.content || '双击编辑文本块'}
      fontSize={parseFloat(String(item.fontSize)) || 24}
      fill="#18181b"
      fontFamily="sans-serif"
      draggable={!isLinkingMode}
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onDblClick={(e) => onDoubleClick(e, item)}
      onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu(e, item.id) }}
      onDragEnd={(e) => onChange(item.id, { x: e.target.x(), y: e.target.y() })}
      padding={12}
    />
  )
}

export const NoteItem = ({ item, onSelect, onMouseDown, onMouseUp, onContextMenu, onDoubleClick, onChange, isLinkingMode }: any) => {
  return (
    <Group
      x={item.x} y={item.y}
      draggable={!isLinkingMode}
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onDblClick={(e) => onDoubleClick(e, item)}
      onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu(e, item.id) }}
      onDragEnd={(e) => onChange(item.id, { x: e.target.x(), y: e.target.y() })}
    >
      <Rect width={240} height={240} fill="#fef08a" shadowColor="#000" shadowBlur={15} shadowOpacity={0.1} cornerRadius={4} stroke="#fde047" strokeWidth={1} />
      <Text x={20} y={20} width={200} height={180} align="center" verticalAlign="middle" text={item.content || '双击编辑便签...'} fontSize={32} fill="#18181b" fontStyle="bold" lineHeight={1.2} />
      <Text x={16} y={210} text={`By: ${item.createdBy || 'admin'}`} fontSize={11} fill="#a1a1aa" fontStyle="italic" />
    </Group>
  )
}

export const ArrowItem = ({ arrow, items, onContextMenu }: any) => {
  const from = items.find((i: any) => i.id === arrow.fromItemId)
  const to = items.find((i: any) => i.id === arrow.toItemId)
  if (!from || !to) return null

  const getCenter = (item: any) => {
    let w = 240, h = 240
    if (item.itemType === 'asset') { w = item.width || 300; h = item.height || 200 }
    if (item.itemType === 'text') { w = 150; h = 30 }
    return { x: item.x + w / 2, y: item.y + h / 2 }
  }

  const p1 = getCenter(from)
  const p2 = getCenter(to)

  return (
    <>
      {/* 起点圆点 */}
      <Circle x={p1.x} y={p1.y} radius={6} fill="#06b6d4" shadowColor="#06b6d4" shadowBlur={8} shadowOpacity={0.6} listening={false} />
      {/* 终点圆点 */}
      <Circle x={p2.x} y={p2.y} radius={6} fill="#06b6d4" shadowColor="#06b6d4" shadowBlur={8} shadowOpacity={0.6} listening={false} />
      {/* 箭头线 */}
      <Arrow
        points={[p1.x, p1.y, p2.x, p2.y]}
        stroke="#06b6d4"
        fill="#06b6d4"
        strokeWidth={6}
        tension={0.2}
        pointerLength={16}
        pointerWidth={16}
        shadowColor="#06b6d4"
        shadowBlur={12}
        shadowOpacity={0.5}
        onContextMenu={(e) => { e.evt.preventDefault(); onContextMenu(e, arrow.id, true) }}
      />
    </>
  )
}
