import { Hono } from 'hono'
import type { Env } from '../index'
import * as db from '../db'
import * as sandbox from '../services/sandbox'
import * as identity from '../services/identity'

const app = new Hono<Env>()

// List user's instances
app.get('/', async (c) => {
  const userId = c.get('userId')
  const instances = await db.listInstances(c.env.DB, userId)

  // Strip bot tokens from response
  const safe = instances.map(({ telegram_bot_token, ...rest }) => rest)
  return c.json({ instances: safe })
})

// Create a new instance
app.post('/', async (c) => {
  const userId = c.get('userId')

  // Rate limit: max 3 instances per user
  const count = await db.countUserInstances(c.env.DB, userId)
  if (count >= 3) {
    return c.json({ error: 'Maximum 3 instances per account' }, 429)
  }

  const body = await c.req.json<{
    name: string
    telegram_bot_token: string
    telegram_user_id: string
  }>()

  if (!body.name || !body.telegram_bot_token || !body.telegram_user_id) {
    return c.json({ error: 'Missing required fields: name, telegram_bot_token, telegram_user_id' }, 400)
  }

  // Validate bot token with Telegram API
  let botUsername: string
  try {
    const botInfo = await sandbox.validateTelegramBot(body.telegram_bot_token)
    botUsername = botInfo.username
  } catch {
    return c.json({ error: 'Invalid Telegram bot token. Create one at @BotFather.' }, 400)
  }

  const instanceId = crypto.randomUUID()
  const tenantId = `t-${instanceId.slice(0, 8)}`

  const config: sandbox.SandboxConfig = {
    sandboxUrl: c.env.SANDBOX_WORKER_URL,
    adminToken: c.env.ADMIN_TOKEN,
  }

  // Save to D1 first
  const instance = await db.createInstance(c.env.DB, {
    id: instanceId,
    user_id: userId,
    name: body.name,
    tenant_id: tenantId,
    telegram_bot_token: body.telegram_bot_token,
    telegram_user_id: body.telegram_user_id,
    telegram_bot_username: botUsername,
    status: 'creating',
  })

  // Boot the container + register agent in identity service (async — don't block response)
  c.executionCtx.waitUntil(
    Promise.all([
      // Boot container
      sandbox
        .bootInstance(config, tenantId, body.telegram_bot_token, body.telegram_user_id)
        .then(() => db.updateInstanceStatus(c.env.DB, instanceId, 'active'))
        .catch(async (err) => {
          console.error('Boot failed for instance', instanceId, err)
          await db.updateInstanceStatus(c.env.DB, instanceId, 'error')
        }),
      // Register agent in identity service
      (async () => {
        try {
          const firebaseToken = c.get('firebaseToken')
          const tokens = await identity.registerUser(firebaseToken)
          await identity.createAgent(tokens.accessToken, tokens.userId, {
            name: body.name,
            description: `OpenClaw instance @${botUsername} (tenant: ${tenantId})`,
            system_prompt: `Telegram bot agent deployed via Cobot AI. Bot: @${botUsername}`,
            capabilities: ['telegram', 'openclaw'],
          })
        } catch (err) {
          console.error('Identity agent creation failed (non-blocking):', err)
        }
      })(),
    ]),
  )

  return c.json(
    {
      instance: {
        id: instance.id,
        name: instance.name,
        tenant_id: instance.tenant_id,
        telegram_bot_username: botUsername,
        status: 'creating',
        created_at: instance.created_at,
      },
    },
    201,
  )
})

// Restart an instance
app.post('/:id/restart', async (c) => {
  const userId = c.get('userId')
  const instanceId = c.req.param('id')

  const instance = await db.getInstance(c.env.DB, instanceId)
  if (!instance || instance.user_id !== userId) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  const config: sandbox.SandboxConfig = {
    sandboxUrl: c.env.SANDBOX_WORKER_URL,
    adminToken: c.env.ADMIN_TOKEN,
  }

  try {
    await sandbox.restartInstance(config, instance.tenant_id)
    await db.updateInstanceStatus(c.env.DB, instanceId, 'active')
    return c.json({ status: 'restarted' })
  } catch (err) {
    console.error('Restart failed:', err)
    return c.json({ error: 'Failed to restart instance' }, 503)
  }
})

// Get instance logs
app.get('/:id/logs', async (c) => {
  const userId = c.get('userId')
  const instanceId = c.req.param('id')

  const instance = await db.getInstance(c.env.DB, instanceId)
  if (!instance || instance.user_id !== userId) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  const config: sandbox.SandboxConfig = {
    sandboxUrl: c.env.SANDBOX_WORKER_URL,
    adminToken: c.env.ADMIN_TOKEN,
  }

  try {
    const logs = await sandbox.getInstanceLogs(config, instance.tenant_id)
    return c.json(logs)
  } catch (err) {
    return c.json({ error: 'Failed to get logs' }, 503)
  }
})

// Delete an instance
app.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const instanceId = c.req.param('id')

  const instance = await db.getInstance(c.env.DB, instanceId)
  if (!instance || instance.user_id !== userId) {
    return c.json({ error: 'Instance not found' }, 404)
  }

  await db.deleteInstance(c.env.DB, instanceId)
  return c.json({ status: 'deleted' })
})

export default app
