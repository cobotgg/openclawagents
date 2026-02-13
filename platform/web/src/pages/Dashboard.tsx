import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { Instance } from '../ts/Interfaces'
import { listInstances } from '../lib/api'
import InstanceCard from '../components/InstanceCard'
import CreateInstanceModal from '../components/CreateInstanceModal'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchInstances = useCallback(async () => {
    try {
      setError(null)
      const data = await listInstances()
      setInstances(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const displayName = user?.email || user?.phoneNumber || user?.displayName || 'User'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xl font-black uppercase tracking-tight">
            Cobot AI
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{displayName}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-full transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Your Instances</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full text-sm font-bold transition-colors"
          >
            + Deploy New Instance
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchInstances}
              className="mt-3 text-sm text-red-300 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <h2 className="text-xl font-bold mb-2">No instances yet</h2>
            <p className="text-gray-400 mb-6">
              Deploy your first AI agent instance to get started.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full font-bold transition-colors"
            >
              Deploy First Instance
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onRefresh={fetchInstances}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateInstanceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            fetchInstances()
          }}
        />
      )}
    </div>
  )
}
