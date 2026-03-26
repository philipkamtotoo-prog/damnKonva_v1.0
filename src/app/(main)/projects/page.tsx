'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Project = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count: { assets: number }
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetchProjects()
    fetch('/api/auth/me').then(r => r.json()).then(data => { if (!data.error) setUser(data) })
  }, [])

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('【警告 1/3】确定要删除这个项目吗？这将不可逆！')) return
    if (!confirm('【警告 2/3】删除项目将连带彻底清除所有关联的白板卡片、连线和生成的素材图片，确定继续？')) return
    if (!confirm('【最终警告 3/3】最后一次确认：您真的要彻底抹除此项目吗？')) return
    
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) fetchProjects()
      else alert('删除失败')
    } catch (e) {
      alert('网络错误')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setIsModalOpen(false)
      setNewProjectName('')
      fetchProjects()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans relative" style={{ backgroundImage: "url('/主页背景.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* 深色遮罩保证文字可读 */}
      <div className="absolute inset-0 bg-black/60"></div>
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
              <span className="text-emerald-400 text-xl font-black">葱</span>
            </div>
            <h1 className="text-2xl font-black tracking-widest text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">葱の白板帝国</h1>
          </div>
          
          <div className="flex items-center gap-1">
            {user && (
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden mr-4 shadow-inner">
                <div className="px-4 py-2 border-r border-zinc-800 flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-300">👤 {user.username}</span>
                  {user.isApiAdmin && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">ADMIN</span>}
                </div>
                
                {user.isApiAdmin && (
                  <>
                    <button onClick={() => router.push('/admin/api-config')} className="px-4 py-2 text-sm text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-all font-medium border-r border-zinc-800">
                      ⚙️ API通道设置
                    </button>
                    <button onClick={() => router.push('/admin/users')} className="px-4 py-2 text-sm text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-all font-medium border-r border-zinc-800">
                      👥 系统账号分配
                    </button>
                  </>
                )}
                
                <button onClick={handleLogout} className="px-4 py-2 text-sm text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium">
                  退出登录 🚪
                </button>
              </div>
            )}
            
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-lg active:scale-95"
            >
              + 新建项目
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-center py-20 flex items-center justify-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500/50 animate-ping"></div>
            <span>正在加载疆土...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-zinc-500 text-center py-20 border-2 border-dashed border-zinc-800 rounded-xl cursor-copy hover:border-zinc-700 transition-colors" onClick={() => setIsModalOpen(true)}>
            还没有任何项目，点击新建吧
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] rounded-xl p-6 cursor-pointer transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-0 bg-emerald-500 transition-all duration-300 group-hover:h-full"></div>
                
                {user?.isApiAdmin && (
                  <button onClick={(e) => handleDeleteProject(e, p.id)} className="absolute top-4 right-4 text-red-500/0 group-hover:text-red-500/70 hover:!text-white hover:!bg-red-500 px-3 py-1 rounded transition-all text-xs z-10 font-bold border border-red-500/0 hover:border-red-500">
                    删除
                  </button>
                )}
                
                <h2 className="text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors mb-4 truncate pr-16">{p.name}</h2>
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <div className="space-y-1">
                    <p>素材: <span className="text-zinc-300 font-medium">{p._count.assets}</span> 个</p>
                    <p>更新: {new Date(p.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-zinc-700 group-hover:text-emerald-500 transition-colors font-medium transform group-hover:translate-x-1 duration-200">
                    进入 &rarr;
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-xl font-bold mb-6 text-zinc-100">新建项目</h3>
            <form onSubmit={handleCreate}>
              {error && <div className="text-red-400 text-sm mb-4 bg-red-400/10 p-3 rounded-lg border border-red-500/20">{error}</div>}
              <input
                type="text"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="项目名称 (1-50字)"
                maxLength={50}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all mb-8 placeholder:text-zinc-600"
                autoFocus
                required
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-zinc-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 px-6 py-2.5 rounded-lg text-white font-medium transition-colors"
                >
                  {creating ? '开辟中...' : '确认创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
