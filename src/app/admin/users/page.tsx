'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UsersAdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [me, setMe] = useState<any>(null)

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
  }

  useEffect(() => { 
    fetchUsers() 
    fetch('/api/auth/me').then(r => r.json()).then(data => { if (!data.error) setMe(data) })
  }, [])

  const handleCreate = async (e: any) => {
    e.preventDefault()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (res.ok) {
      setUsername(''); setPassword('');
      fetchUsers()
    } else {
      const { error } = await res.json()
      alert(error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确认彻底删除此账号及旗下所有项目和素材？该操作不可逆！')) return
    const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchUsers()
    else {
      const { error } = await res.json()
      alert('删除失败: ' + error)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/projects')} className="text-zinc-500 mb-6 hover:text-emerald-500 transition-colors">&larr; 返回大厅</button>
        <h1 className="text-3xl font-bold mb-8 text-emerald-400">👥 账号管理与分配</h1>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8 shadow-lg">
          <h2 className="text-lg font-bold mb-4 text-zinc-100">添加新系统账号</h2>
          <form className="flex gap-4 items-end" onSubmit={handleCreate}>
             <label className="flex flex-col gap-1 w-1/3">
               <span className="text-xs text-zinc-500 font-bold tracking-wider">用户名</span>
               <input value={username} onChange={e=>setUsername(e.target.value)} required className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none text-white" />
             </label>
             <label className="flex flex-col gap-1 w-1/3">
               <span className="text-xs text-zinc-500 font-bold tracking-wider">初始密码</span>
               <input value={password} onChange={e=>setPassword(e.target.value)} required className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none text-white" />
             </label>
             <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 transition-colors text-white px-4 py-2 h-[38px] w-1/3 rounded-lg text-sm font-bold shadow-md">创建通行证</button>
          </form>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-bold tracking-wider">
              <tr>
                <th className="p-4">账户标识</th>
                <th className="p-4">角色组</th>
                <th className="p-4">开户日期</th>
                <th className="p-4 text-right">危险操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="p-4 font-mono text-zinc-200">{u.username} {me?.id === u.id && <span className="text-emerald-500 text-xs ml-2 font-sans border border-emerald-500/30 px-1 py-0.5 rounded bg-emerald-500/10">当前</span>}</td>
                  <td className="p-4">{u.isApiAdmin ? <span className="text-amber-500 font-bold px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded shadow-sm">👑 Admin</span> : <span className="text-zinc-500 font-medium px-2 py-1 bg-zinc-800/50 rounded border border-zinc-700">Member</span>}</td>
                  <td className="p-4 text-zinc-500">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(u.id)} 
                      disabled={me?.id === u.id}
                      className="text-red-400 hover:text-white hover:bg-red-500 px-3 py-1 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-400 font-medium"
                    >
                      删除销户
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
