import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-domain.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-firebase-project',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
