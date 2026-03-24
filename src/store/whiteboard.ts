import { create } from 'zustand'

export type Point = { x: number; y: number }

export type WhiteboardItem = {
  id: string
  itemType: 'asset' | 'text' | 'note'
  x: number
  y: number
  width?: number
  height?: number
  zIndex: number
  content?: string
  refId?: string // asset url or id
  fontSize?: number
  createdBy?: string // author logic
}

export type ArrowLink = {
  id: string
  fromItemId: string
  toItemId: string
}

interface WhiteboardState {
  items: WhiteboardItem[]
  arrows: ArrowLink[]
  camera: { x: number; y: number; scale: number }
  isLinkingMode: boolean
  setIsLinkingMode: (is: boolean) => void
  linkingState: { fromId: string; toX: number; toY: number } | null
  setLinkingState: (state: { fromId: string; toX: number; toY: number } | null) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  lastAssetUpdate: number
  triggerAssetUpdate: () => void
  setCamera: (camera: Partial<{ x: number; y: number; scale: number }>) => void
  addItem: (item: WhiteboardItem) => void
  updateItem: (id: string, updates: Partial<WhiteboardItem>) => void
  deleteItem: (id: string) => void
  setItems: (items: WhiteboardItem[]) => void
  clearBoard: () => void
  addArrow: (arrow: ArrowLink) => void
  deleteArrow: (id: string) => void
  setArrows: (arrows: ArrowLink[]) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  items: [],
  arrows: [],
  camera: { x: 0, y: 0, scale: 1 },
  isLinkingMode: false,
  setIsLinkingMode: (is) => set({ isLinkingMode: is }),
  linkingState: null,
  setLinkingState: (state) => set({ linkingState: state }),
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  lastAssetUpdate: Date.now(),
  triggerAssetUpdate: () => set({ lastAssetUpdate: Date.now() }),
  setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  setItems: (items) => set({ items }),
  clearBoard: () => set({ items: [], arrows: [] }),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((i) => i.id === id ? { ...i, ...updates } : i)
  })),
  deleteItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id),
    arrows: state.arrows.filter(a => a.fromItemId !== id && a.toItemId !== id)
  })),
  addArrow: (arrow) => set((state) => ({ arrows: [...state.arrows, arrow] })),
  deleteArrow: (id) => set((state) => ({ arrows: state.arrows.filter((a) => a.id !== id) })),
  setArrows: (arrows) => set({ arrows }),
  bringToFront: (id) => set((state) => {
    const item = state.items.find(i => i.id === id)
    if (!item) return state
    const maxZ = Math.max(...state.items.map(i => i.zIndex), 0)
    return { items: state.items.map(i => i.id === id ? { ...i, zIndex: maxZ + 1 } : i) }
  }),
  sendToBack: (id) => set((state) => {
    const item = state.items.find(i => i.id === id)
    if (!item) return state
    const minZ = Math.min(...state.items.map(i => i.zIndex), 0)
    return { items: state.items.map(i => i.id === id ? { ...i, zIndex: minZ - 1 } : i) }
  })
}))
