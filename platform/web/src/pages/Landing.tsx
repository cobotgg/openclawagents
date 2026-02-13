import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Landing() {
  const navigate = useNavigate()
  const { authenticated } = useAuth()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black uppercase tracking-tight">
            Cobot AI
          </span>
        </div>
        <button
          onClick={() => navigate(authenticated ? '/dashboard' : '/login')}
          className="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full text-sm font-bold transition-colors"
        >
          {authenticated ? 'Dashboard' : 'Get Started'}
        </button>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl md:text-7xl font-black uppercase mb-6 leading-none tracking-tight">
          Deploy Your Own{' '}
          <span className="text-yellow-400">
            AI Agent
          </span>
          <br />
          in Seconds
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
          Get an isolated AI agent instance connected to your Telegram bot. No servers to manage.
          Your data persists across restarts.
        </p>
        <button
          onClick={() => navigate(authenticated ? '/dashboard' : '/login')}
          className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full text-lg font-bold transition-colors"
        >
          {authenticated ? 'Go to Dashboard' : 'Get Started Free'}
        </button>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 text-left">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-yellow-400/30 transition-colors">
            <h3 className="text-lg font-bold mb-2">Isolated Containers</h3>
            <p className="text-gray-400 text-sm">
              Each instance runs in its own secure container with dedicated resources.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-yellow-400/30 transition-colors">
            <h3 className="text-lg font-bold mb-2">Telegram Native</h3>
            <p className="text-gray-400 text-sm">
              Connect your own Telegram bot. Chat with your AI agent directly.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-yellow-400/30 transition-colors">
            <h3 className="text-lg font-bold mb-2">Persistent Storage</h3>
            <p className="text-gray-400 text-sm">
              Your agent's memory and workspace persist across container restarts.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-gray-500 text-sm">
        Cobot AI &mdash; Powered by OpenClaw + Cloudflare Containers
      </footer>
    </div>
  )
}
