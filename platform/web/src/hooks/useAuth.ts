import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setReady(true)
    })
    return unsubscribe
  }, [])

  const logout = () => signOut(auth)

  return {
    user,
    ready,
    authenticated: !!user,
    logout,
  }
}
