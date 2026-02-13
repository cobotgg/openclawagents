import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const { ready, authenticated } = useAuth()
  const [mode, setMode] = useState<'select' | 'phone' | 'otp'>('select')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  useEffect(() => {
    if (ready && authenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [ready, authenticated, navigate])

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign-in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const setupRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })
    }
    return recaptchaRef.current
  }

  const handlePhoneSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const recaptcha = setupRecaptcha()
      const formatted = phone.startsWith('+') ? phone : `+${phone}`
      const result = await signInWithPhoneNumber(auth, formatted, recaptcha)
      confirmationRef.current = result
      setMode('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
      recaptchaRef.current = null
    } finally {
      setLoading(false)
    }
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await confirmationRef.current!.confirm(otp)
    } catch (err: any) {
      setError(err.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
          Cobot AI
        </h1>
        <p className="text-gray-400">Sign in to manage your AI agents</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {mode === 'select' && (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 rounded-full font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={() => setMode('phone')}
              disabled={loading}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/15 rounded-full font-bold transition-colors text-white disabled:opacity-50"
            >
              Continue with Phone
            </button>
          </>
        )}

        {mode === 'phone' && (
          <form onSubmit={handlePhoneSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                required
                autoFocus
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US)</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 rounded-full font-bold transition-colors text-black disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <button
              type="button"
              onClick={() => setMode('select')}
              className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Back
            </button>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={handleOtpVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Verification Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                required
                autoFocus
                maxLength={6}
                className="w-full px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 font-mono text-center text-2xl tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to {phone}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 rounded-full font-bold transition-colors text-black disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('phone'); setOtp('') }}
              className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Resend code
            </button>
          </form>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      <div id="recaptcha-container" />

      <button
        onClick={() => navigate('/')}
        className="mt-8 text-gray-500 hover:text-gray-300 text-sm transition-colors"
      >
        &larr; Back to home
      </button>
    </div>
  )
}
