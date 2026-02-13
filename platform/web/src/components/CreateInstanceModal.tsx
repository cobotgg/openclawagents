import { useState } from 'react'
import { createInstance } from '../lib/api'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function CreateInstanceModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [botToken, setBotToken] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const instance = await createInstance({
        name: name.trim(),
        telegram_bot_token: botToken.trim(),
        telegram_user_id: userId.trim(),
      })
      setSuccess(
        instance.telegram_bot_username
          ? `Bot @${instance.telegram_bot_username} is being deployed!`
          : 'Instance is being deployed!',
      )
      setTimeout(onCreated, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create instance')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-6">Deploy New Instance</h2>

        {success ? (
          <div className="bg-green-900/20 border border-green-800 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-2">🚀</div>
            <p className="text-green-400">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Instance Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My AI Agent"
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
              />
            </div>

            {/* Bot Token */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Create a bot via{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:underline"
                >
                  @BotFather
                </a>{' '}
                on Telegram
              </p>
            </div>

            {/* User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Your Telegram User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="123456789"
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your ID from{' '}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:underline"
                >
                  @userinfobot
                </a>{' '}
                on Telegram
              </p>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full font-bold transition-colors disabled:opacity-50"
            >
              {loading ? 'Deploying...' : 'Deploy Instance'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
