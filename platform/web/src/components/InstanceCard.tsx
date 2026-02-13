import { useState } from 'react'
import type { Instance } from '../ts/Interfaces'
import { restartInstance, deleteInstance } from '../lib/api'

const statusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  creating: { label: 'Creating', color: 'bg-yellow-400', pulse: true },
  active: { label: 'Active', color: 'bg-green-500' },
  stopped: { label: 'Stopped', color: 'bg-gray-500' },
  error: { label: 'Error', color: 'bg-red-500' },
}

interface Props {
  instance: Instance
  onRefresh: () => void
}

export default function InstanceCard({ instance, onRefresh }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const status = statusConfig[instance.status] || statusConfig.error

  const handleRestart = async () => {
    setActionLoading('restart')
    try {
      await restartInstance(instance.id)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restart')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setActionLoading('delete')
    try {
      await deleteInstance(instance.id)
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setActionLoading(null)
      setConfirmDelete(false)
    }
  }

  const createdDate = new Date(instance.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-yellow-400/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-lg truncate">{instance.name}</h3>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}
          />
          <span className="text-xs text-gray-400">{status.label}</span>
        </div>
      </div>

      {/* Bot info */}
      {instance.telegram_bot_username && (
        <a
          href={`https://t.me/${instance.telegram_bot_username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          @{instance.telegram_bot_username}
        </a>
      )}

      {/* Meta */}
      <div className="mt-3 text-xs text-gray-500">
        <span>Created {createdDate}</span>
        <span className="mx-2">&middot;</span>
        <span className="font-mono">{instance.tenant_id}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
        <button
          onClick={handleRestart}
          disabled={actionLoading !== null}
          className="flex-1 px-3 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-full transition-colors disabled:opacity-50"
        >
          {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
        <button
          onClick={handleDelete}
          disabled={actionLoading !== null}
          className={`px-3 py-2 text-sm rounded-full transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-white/10 hover:bg-white/15 text-red-400'
          }`}
        >
          {actionLoading === 'delete'
            ? 'Deleting...'
            : confirmDelete
              ? 'Confirm Delete'
              : 'Delete'}
        </button>
      </div>
    </div>
  )
}
