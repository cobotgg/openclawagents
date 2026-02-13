import { Hono } from 'hono'
import type { Env } from '../index'
import * as identity from '../services/identity'

const app = new Hono<Env>()

/**
 * Helper: exchange the user's Firebase token for an identity service JWT,
 * then return the identity accessToken and userId.
 */
async function getIdentityAuth(c: any): Promise<{ accessToken: string; userId: string }> {
  const firebaseToken = c.get('firebaseToken')
  const tokens = await identity.registerUser(firebaseToken)
  return { accessToken: tokens.accessToken, userId: tokens.userId }
}

// List user's agents
app.get('/', async (c) => {
  try {
    const { accessToken, userId } = await getIdentityAuth(c)
    const offset = parseInt(c.req.query('offset') || '0')
    const limit = parseInt(c.req.query('limit') || '50')
    const data = await identity.listAgents(accessToken, userId, offset, limit)
    return c.json(data)
  } catch (err) {
    console.error('List agents failed:', err)
    return c.json({ error: 'Failed to list agents' }, 503)
  }
})

// Create a new agent
app.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    description: string
    system_prompt: string
    capabilities: string[]
  }>()

  if (!body.name || !body.description || !body.system_prompt) {
    return c.json(
      { error: 'Missing required fields: name, description, system_prompt' },
      400,
    )
  }

  try {
    const { accessToken, userId } = await getIdentityAuth(c)
    const agent = await identity.createAgent(accessToken, userId, {
      name: body.name,
      description: body.description,
      system_prompt: body.system_prompt,
      capabilities: body.capabilities || [],
    })
    return c.json({ agent }, 201)
  } catch (err) {
    console.error('Create agent failed:', err)
    const msg = err instanceof Error ? err.message : 'Failed to create agent'
    return c.json({ error: msg }, 503)
  }
})

export default app
