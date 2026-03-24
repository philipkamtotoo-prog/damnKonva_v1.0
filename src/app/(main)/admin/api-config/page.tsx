'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ApiConfigPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(async r => {
        if (!r.ok) {
           if (r.status === 403) router.push('/projects')
           throw new Error('Load failed')
        }
        return r.json()
      })
      .then(data => {
        // Ensure both 'image' and 'video' config objects exist for the form regardless of DB state
        const img = data.find((d: any) => d.type === 'image') || { type: 'image', baseUrl: '', apiKey: '', defaultModel: '' }
        const vid = data.find((d: any) => d.type === 'video') || { type: 'video', baseUrl: '', apiKey: '', defaultModel: '' }
        img.apiKey = img.apiKeyEncrypted ? '********' : ''
        vid.apiKey = vid.apiKeyEncrypted ? '********' : ''
        setConfigs([img, vid])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs)
    })
    setSaving(false)
    alert('保存全局配置成功')
  }

  if (loading) return <div className="text-white p-8 font-sans bg-zinc-950 min-h-screen">连接最高指控中心中...</div>

  return (
    <div className="min-h-screen bg-zinc-950 font-sans p-8 text-white relative">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-10 pb-4 border-b border-zinc-800">
          <h1 className="text-2xl font-bold tracking-widest text-emerald-400">大模型路由中枢控制台</h1>
          <button onClick={() => router.push('/projects')} className="text-zinc-400 hover:text-white transition-colors">&larr; 返回帝国主城</button>
        </div>
        
        <div className="space-y-8">
          {configs.map((conf, i) => (
            <div key={conf.type} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 py-1 px-4 bg-zinc-800 text-[10px] text-zinc-500 rounded-bl-lg font-mono tracking-widest uppercase">OpenAI Compatible</div>
              <h2 className="text-xl font-bold mb-6 capitalize text-zinc-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                {conf.type} Generative API
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 mb-2 tracking-wider">Base URL (基础接口)</label>
                  <input 
                    type="text" 
                    value={conf.baseUrl || ''} 
                    onChange={e => {
                      const newC = [...configs]; newC[i].baseUrl = e.target.value; setConfigs(newC)
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all placeholder:text-zinc-700"
                    placeholder="例如: https://api.openai.com/v1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2 tracking-wider">API Key (密钥)</label>
                  <input 
                    type="password" 
                    value={conf.apiKey || ''} 
                    onChange={e => {
                      const newC = [...configs]; newC[i].apiKey = e.target.value; setConfigs(newC)
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all placeholder:text-zinc-700"
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2 tracking-wider">Model (默认模型)</label>
                  <input 
                    type="text" 
                    value={conf.defaultModel || ''} 
                    onChange={e => {
                      const newC = [...configs]; newC[i].defaultModel = e.target.value; setConfigs(newC)
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition-all placeholder:text-zinc-700"
                    placeholder="例如: dall-e-3"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="mt-10 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/30 text-white font-medium py-3 px-8 rounded-lg transition-all border border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] shadow-[0_0_5px_rgba(16,185,129,0.1)] flex items-center justify-center gap-2 w-full md:w-auto"
        >
          {saving ? '正在高强度加密保存...' : '🛡️ 验证并保存全部配置'}
        </button>
      </div>
    </div>
  )
}
