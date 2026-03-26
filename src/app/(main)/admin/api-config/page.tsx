'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PROVIDERS = [
  { key: 'volcano', label: '火山云', color: 'from-orange-500 to-red-600', tag: 'Volcano' },
  { key: 'ksyun', label: '金山云', color: 'from-blue-500 to-indigo-600', tag: 'Ksyun' },
]

const TYPES = ['image', 'video']

const PROVIDER_TIPS: Record<string, string> = {
  volcano: 'https://ark.cn-beijing.volces.com',
  ksyun: 'https://kspmas.ksyun.com',
}

const MODEL_HINTS: Record<string, string> = {
  volcano_image: 'doubao-seedream-5-0-260128',
  volcano_video: 'doubao-seedance-1-5-pro-251215',
  ksyun_image: 'doubao-seedream-4.5',
  ksyun_video: 'doubao-seedream-4.5-i2v',
}

function makeEmpty(type: string, provider: string) {
  return { type, provider, baseUrl: '', apiKey: '', defaultModel: '', enabled: false, isNew: true }
}

export default function ApiConfigPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<Record<string, Record<string, any>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(async r => {
        if (!r.ok) { if (r.status === 403) router.push('/projects'); throw new Error('Load failed') }
        return r.json()
      })
      .then(data => {
        const grouped: Record<string, Record<string, any>> = {}
        for (const type of TYPES) {
          grouped[type] = {}
          for (const p of PROVIDERS) {
            const found = data.find((d: any) => d.type === type && d.provider === p.key)
            grouped[type][p.key] = found
              ? { ...found, apiKey: found.apiKeyEncrypted ? '********' : '', isNew: false }
              : makeEmpty(type, p.key)
          }
        }
        setConfigs(grouped)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const toggleEnabled = (type: string, provider: string) => {
    setConfigs(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      for (const p of PROVIDERS) next[type][p.key].enabled = (p.key === provider)
      return next
    })
  }

  const updateField = (type: string, provider: string, field: string, value: any) => {
    setConfigs(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next[type][provider][field] = value
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const items: any[] = []
    for (const type of TYPES) {
      for (const p of PROVIDERS) items.push(configs[type][p.key])
    }
    await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    setSaving(false)
    alert('保存成功，API 已切换')
  }

  if (loading) return <div className="text-white p-8 font-sans bg-zinc-950 min-h-screen">连接最高指控中心中...</div>

  return (
    <div className="min-h-screen bg-zinc-950 font-sans p-6 text-white">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
          <h1 className="text-2xl font-bold tracking-widest text-emerald-400">大模型路由中枢控制台</h1>
          <button onClick={() => router.push('/projects')} className="text-zinc-400 hover:text-white transition-colors text-sm">← 返回画板</button>
        </div>

        {/* Per-type blocks */}
        {TYPES.map(type => (
          <div key={type} className="mb-10">
            <h2 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {type === 'image' ? '图片生成' : '视频生成'} API
            </h2>

            <div className="space-y-4">
              {PROVIDERS.map(p => {
                const conf = configs[type]?.[p.key] || makeEmpty(type, p.key)
                const hintKey = `${p.key}_${type}`
                return (
                  <div key={p.key} className={`relative border rounded-xl overflow-hidden transition-all ${conf.enabled ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'border-zinc-800 opacity-70'}`}>
                    {/* Provider banner */}
                    <div className={`bg-gradient-to-r ${p.color} px-4 py-2 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-sm">{p.label}</span>
                        <span className="text-white/60 text-xs font-mono">{p.tag}</span>
                      </div>
                      {/* Enable toggle */}
                      <button
                        onClick={() => toggleEnabled(type, p.key)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${conf.enabled ? 'bg-white/30' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow ${conf.enabled ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Fields */}
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-zinc-400 mb-1">Base URL</label>
                        <input
                          type="text"
                          value={conf.baseUrl || ''}
                          onChange={e => updateField(type, p.key, 'baseUrl', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder={PROVIDER_TIPS[p.key]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1">API Key</label>
                        <input
                          type="password"
                          value={conf.apiKey || ''}
                          onChange={e => updateField(type, p.key, 'apiKey', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="不修改请留空"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 mb-1">默认模型</label>
                        <input
                          type="text"
                          value={conf.defaultModel || ''}
                          onChange={e => updateField(type, p.key, 'defaultModel', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder={MODEL_HINTS[hintKey] || '例如: dall-e-3'}
                        />
                      </div>
                    </div>

                    {/* Active badge */}
                    {conf.enabled && (
                      <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider">ACTIVE</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-3 px-8 rounded-xl transition-all border border-emerald-500/50 text-sm tracking-wider"
        >
          {saving ? '⚡ 正在保存并切换路由...' : '🛡️ 验证并保存全部配置'}
        </button>
      </div>
    </div>
  )
}
