import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyFirebaseToken } from './services/firebase'
import { upsertUser, getUser } from './db'
import instances from './controllers/instances'
import agents from './controllers/agents'

export type Env = {
  Bindings: {
    DB: D1Database
    SANDBOX_WORKER_URL: string
    FIREBASE_PROJECT_ID: string
    ADMIN_TOKEN: string
  }
  Variables: {
    userId: string
    firebaseToken: string // Raw Firebase ID token for identity service calls
  }
}

const app = new Hono<Env>()

// CORS
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('.pages.dev') ||
        origin.includes('cobot') ||
        origin.includes('agents.cobot.gg') ||
        origin.includes('cobot.gg')
      ) {
        return origin
      }
      return ''
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
)

// Public health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'cobot-api' }))

// Auth middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  try {
    const firebaseUser = await verifyFirebaseToken(
      token,
      c.env.FIREBASE_PROJECT_ID || 'your-firebase-project',
    )

    // Auto-upsert user in D1
    await upsertUser(
      c.env.DB,
      firebaseUser.userId,
      firebaseUser.email,
      undefined,
      firebaseUser.loginMethod,
    )

    c.set('userId', firebaseUser.userId)
    c.set('firebaseToken', token)
    await next()
  } catch (err) {
    console.error('Auth failed:', err)
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}

app.use('/instances/*', authMiddleware)
app.use('/users/*', authMiddleware)
app.use('/agents/*', authMiddleware)

// Instance routes
app.route('/instances', instances)

// Agent routes (proxied to identity service)
app.route('/agents', agents)

// User profile
app.get('/users/me', async (c) => {
  const userId = c.get('userId')
  const user = await getUser(c.env.DB, userId)
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }
  return c.json({ user })
})

export default app
