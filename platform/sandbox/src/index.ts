/**
 * Cobot AI Sandbox - Multi-Tenant OpenClaw Container Gateway
 *
 * Each tenant gets an isolated Sandbox running a full OpenClaw instance
 * with their own Telegram bot token and user ID.
 *
 * Architecture:
 *   Admin -> POST /boot { tenant, bot_token, user_id } -> stores in KV, boots container
 *   Telegram -> OpenClaw native polling (per-tenant bot token)
 *   R2 -> persistent storage for config + workspace (tar-based sync every 5min + SIGTERM)
 *
 * Admin endpoints require Authorization: Bearer <ADMIN_TOKEN>
 */

import { getSandbox, Sandbox, type SandboxOptions } from '@cloudflare/sandbox'
import type { Process } from '@cloudflare/sandbox'

export { Sandbox }

const OPENCLAW_PORT = 18789
const STARTUP_TIMEOUT_MS = 180_000
const R2_MOUNT_PATH = '/data/cobot'
const HEARTBEAT_THRESHOLD_MS = 5 * 60 * 1000 // 5 min (accounts for KV eventual consistency)

interface GatewayEnv {
  Sandbox: DurableObjectNamespace<Sandbox>
  TENANT_CONFIGS: KVNamespace
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  OPENCLAW_GATEWAY_TOKEN?: string
  ADMIN_TOKEN?: string
  WORKER_URL?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  CF_ACCOUNT_ID?: string
  R2_BUCKET_NAME?: string
}

interface TenantConfig {
  tenantId: string
  telegramBotToken: string
  telegramUserId: string
  createdAt: string
}

function getSandboxOptions(): SandboxOptions {
  return { sleepAfter: '30m' }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function requireAdmin(request: Request, env: GatewayEnv): Response | null {
  if (!env.ADMIN_TOKEN) {
    return Response.json({ error: 'ADMIN_TOKEN not configured' }, { status: 500 })
  }
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

// ---------------------------------------------------------------------------
// Tenant config (KV)
// ---------------------------------------------------------------------------

async function getTenantConfig(env: GatewayEnv, tenantId: string): Promise<TenantConfig | null> {
  const raw = await env.TENANT_CONFIGS.get(`tenant:${tenantId}`)
  return raw ? JSON.parse(raw) : null
}

// ---------------------------------------------------------------------------
// R2 persistent storage
// ---------------------------------------------------------------------------

async function isR2Mounted(sandbox: any): Promise<boolean> {
  try {
    const proc = await sandbox.startProcess(`/bin/bash -c "mount | grep 's3fs on ${R2_MOUNT_PATH}'"`)
    // Poll for completion (mount check is fast)
    for (let i = 0; i < 10; i++) {
      if (proc.status !== 'running') break
      await new Promise(r => setTimeout(r, 200))
    }
    const logs = await proc.getLogs()
    return !!(logs.stdout && logs.stdout.includes('s3fs'))
  } catch {
    return false
  }
}

async function mountR2(sandbox: any, env: GatewayEnv): Promise<boolean> {
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CF_ACCOUNT_ID) {
    console.log('[R2] Storage not configured (missing credentials)')
    return false
  }

  // Check mount table first — avoids redundant mountBucket() calls and error parsing
  if (await isR2Mounted(sandbox)) {
    console.log('[R2] Bucket already mounted at', R2_MOUNT_PATH)
    return true
  }

  const bucketName = env.R2_BUCKET_NAME || 'cobotclaw-data'
  try {
    console.log('[R2] Mounting bucket', bucketName, 'at', R2_MOUNT_PATH)
    await sandbox.mountBucket(bucketName, R2_MOUNT_PATH, {
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
    console.log('[R2] Bucket mounted successfully')
    return true
  } catch (e) {
    // Double-check: mount table is the source of truth (error messages can be misleading)
    if (await isR2Mounted(sandbox)) {
      console.log('[R2] Bucket is mounted despite error (verified via mount table)')
      return true
    }
    console.error('[R2] Mount failed:', e instanceof Error ? e.message : String(e))
    return false
  }
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

async function findGatewayProcess(sandbox: any): Promise<Process | null> {
  try {
    const processes = await sandbox.listProcesses()
    for (const proc of processes) {
      const isGateway =
        proc.command.includes('start-openclaw.sh') ||
        proc.command.includes('openclaw gateway')
      const isCli =
        proc.command.includes('openclaw onboard') ||
        proc.command.includes('openclaw --version')
      if (isGateway && !isCli && (proc.status === 'running' || proc.status === 'starting')) {
        return proc
      }
    }
  } catch (e) {
    console.log('[GATEWAY] Could not list processes:', e)
  }
  return null
}

async function ensureGateway(sandbox: any, env: GatewayEnv, tenantConfig: TenantConfig): Promise<void> {
  const existing = await findGatewayProcess(sandbox)
  if (existing) {
    try {
      await existing.waitForPort(OPENCLAW_PORT, { mode: 'tcp', timeout: STARTUP_TIMEOUT_MS })
      return
    } catch {
      console.log('[GATEWAY] Existing process not reachable, restarting...')
      try { await existing.kill() } catch { /* ignore */ }
    }
  }

  console.log('[GATEWAY] Starting OpenClaw for tenant', tenantConfig.tenantId)

  // Mount R2 for persistent storage (non-blocking if credentials missing)
  const r2Mounted = await mountR2(sandbox, env)
  if (r2Mounted) {
    // Give FUSE mount time to become ready (per CF docs recommendation)
    await new Promise(r => setTimeout(r, 3000))
    console.log('[R2] FUSE mount readiness delay complete')
  }

  // Per-tenant env vars — each container gets its own bot token
  const envVars: Record<string, string> = {
    TELEGRAM_BOT_TOKEN: tenantConfig.telegramBotToken,
    TELEGRAM_DM_POLICY: 'open',
    TENANT_ID: tenantConfig.tenantId,
  }
  if (env.ANTHROPIC_API_KEY) envVars.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  if (env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = env.OPENAI_API_KEY
  if (env.OPENCLAW_GATEWAY_TOKEN) envVars.OPENCLAW_GATEWAY_TOKEN = env.OPENCLAW_GATEWAY_TOKEN
  if (env.WORKER_URL) envVars.WEBHOOK_BASE_URL = env.WORKER_URL

  const process = await sandbox.startProcess('/usr/local/bin/start-openclaw.sh', {
    env: envVars,
  })

  console.log('[GATEWAY] Process started, waiting for port', OPENCLAW_PORT)

  try {
    await process.waitForPort(OPENCLAW_PORT, { mode: 'tcp', timeout: STARTUP_TIMEOUT_MS })
    console.log('[GATEWAY] OpenClaw is ready for tenant', tenantConfig.tenantId)
  } catch (e) {
    console.error('[GATEWAY] Startup failed for tenant', tenantConfig.tenantId)
    try {
      const logs = await process.getLogs()
      console.error('[GATEWAY] stderr:', logs.stderr)
      console.error('[GATEWAY] stdout:', logs.stdout)
    } catch { /* ignore */ }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export default {
  // Cron: set Telegram webhooks ONLY for sleeping containers.
  // Checks heartbeat KV — if the container has sent a heartbeat within
  // HEARTBEAT_THRESHOLD_MS, it's still running and using polling, so skip it.
  async scheduled(_event: ScheduledEvent, env: GatewayEnv, _ctx: ExecutionContext): Promise<void> {
    if (!env.WORKER_URL) return

    // Paginate KV list (1000 keys per page)
    let cursor: string | undefined
    do {
      const list = await env.TENANT_CONFIGS.list({ prefix: 'tenant:', cursor })
      for (const key of list.keys) {
        try {
          const raw = await env.TENANT_CONFIGS.get(key.name)
          if (!raw) continue
          const config: TenantConfig = JSON.parse(raw)

          // Check heartbeat — if recent, container is alive and polling, skip webhook
          const heartbeat = await env.TENANT_CONFIGS.get(`heartbeat:${config.tenantId}`)
          if (heartbeat) {
            const age = Date.now() - new Date(heartbeat).getTime()
            if (age < HEARTBEAT_THRESHOLD_MS) {
              console.log(`[CRON] Skipping ${config.tenantId} — heartbeat ${Math.round(age / 1000)}s ago (alive)`)
              continue
            }
          }

          // Use tenantId in webhook URL (not bot token — security best practice)
          const webhookUrl = `${env.WORKER_URL}/webhook/${config.tenantId}`
          const res = await fetch(
            `https://api.telegram.org/bot${config.telegramBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
          )
          const data = await res.json() as any
          console.log(`[CRON] Set webhook for ${config.tenantId}: ${data.ok ? 'ok' : data.description}`)
        } catch (e) {
          console.error(`[CRON] Failed to set webhook for ${key.name}:`, e)
        }
      }
      cursor = list.list_complete ? undefined : list.cursor
    } while (cursor)
  },

  async fetch(request: Request, env: GatewayEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Public health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'cobot-sandbox' })
    }

    // Container heartbeat — written by the container's sync loop every 30s.
    // Handled HERE (before any DO routing) so it does NOT reset sleepAfter.
    if (url.pathname === '/heartbeat') {
      const tenant = url.searchParams.get('tenant')
      if (tenant) {
        await env.TENANT_CONFIGS.put(`heartbeat:${tenant}`, new Date().toISOString())
      }
      return new Response('ok', { status: 200 })
    }

    // =======================================================================
    // Telegram webhook — wakes sleeping containers on incoming messages
    // Path: /webhook/<tenantId> (no bot token in URL for security)
    // =======================================================================

    if (url.pathname.startsWith('/webhook/')) {
      const webhookId = decodeURIComponent(url.pathname.slice('/webhook/'.length))
      if (!webhookId) return new Response('OK', { status: 200 })

      // webhookId can be a tenantId or a bot token (legacy)
      let tenantId: string | null = await env.TENANT_CONFIGS.get(`bottoken:${webhookId}`)
      let tenantConfig: TenantConfig | null = null
      if (tenantId) {
        tenantConfig = await getTenantConfig(env, tenantId)
      } else {
        // Try as tenantId directly
        tenantConfig = await getTenantConfig(env, webhookId)
        if (tenantConfig) tenantId = webhookId
      }
      if (!tenantId || !tenantConfig) {
        console.log('[WEBHOOK] No tenant found for webhook ID:', webhookId)
        return new Response('OK', { status: 200 })
      }

      const botToken = tenantConfig.telegramBotToken

      // Parse chat ID from the Telegram update (used for status messages)
      let chatId: number | null = null
      try {
        const body = await request.json() as any
        chatId = body?.message?.chat?.id
          || body?.callback_query?.message?.chat?.id
          || null
      } catch { /* ignore parse errors */ }

      const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())
      const existingProc = await findGatewayProcess(sandbox)

      if (existingProc) {
        // Container is already running — delete webhook so polling resumes.
        // This should rarely happen thanks to the heartbeat mechanism.
        // The message that triggered this webhook is consumed by Telegram
        // (200 response), so notify the user to resend.
        await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`).catch(() => {})
        // Refresh heartbeat so cron doesn't immediately re-set the webhook
        await env.TENANT_CONFIGS.put(`heartbeat:${tenantId}`, new Date().toISOString())

        if (chatId) {
          ctx.waitUntil(
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: 'Bot reconnected. Please send your message again.',
              }),
            }).catch(() => {})
          )
        }

        console.log('[WEBHOOK] Container already running for', tenantId, '— deleted webhook, polling resumes')
        return new Response('OK', { status: 200 })
      }

      // Container is sleeping — wake it up synchronously (not waitUntil,
      // which gets killed after ~30s; boot can take up to 180s)

      // CRITICAL: Set heartbeat BEFORE boot — prevents cron from re-setting
      // the webhook during the boot period (which causes permanent 409 Conflict).
      await env.TENANT_CONFIGS.put(`heartbeat:${tenantId}`, new Date().toISOString())

      // Fire-and-forget "waking up" message
      if (chatId) {
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: 'Bot is waking up, please wait...' }),
        }).catch(() => {})
      }

      // Boot synchronously — Workers runtime keeps running until we return
      try {
        await ensureGateway(sandbox, env, tenantConfig)

        if (chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: 'Bot is ready! Please send your message again.' }),
          }).catch(() => {})
        }

        console.log('[WEBHOOK] Container woke up for tenant', tenantId)
      } catch (e) {
        console.error('[WEBHOOK] Failed to wake container:', e)
      } finally {
        // ALWAYS delete webhook so polling can work — even if boot failed.
        // Without this, a stale webhook causes permanent 409 on getUpdates.
        await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`).catch(() => {})
      }

      return new Response('OK', { status: 200 })
    }

    // =======================================================================
    // Admin endpoints — require Authorization: Bearer <ADMIN_TOKEN>
    // =======================================================================

    if (url.pathname === '/boot') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      // Accept tenant from query param, credentials from POST body (keeps tokens out of URLs/logs)
      const tenantId = url.searchParams.get('tenant')
      if (!tenantId) return Response.json({ error: 'Missing ?tenant=' }, { status: 400 })

      // Read credentials from POST body (preferred) or query params (backward compat)
      let botToken = url.searchParams.get('bot_token')
      let userId = url.searchParams.get('user_id')
      if (request.method === 'POST') {
        try {
          const body = await request.json() as Record<string, string>
          botToken = body.botToken || body.bot_token || botToken
          userId = body.userId || body.user_id || userId
        } catch { /* no body or invalid JSON — fall through to query params */ }
      }

      if (botToken && userId) {
        const config: TenantConfig = {
          tenantId,
          telegramBotToken: botToken,
          telegramUserId: userId,
          createdAt: new Date().toISOString(),
        }
        await env.TENANT_CONFIGS.put(`tenant:${tenantId}`, JSON.stringify(config))
        // Reverse mapping for webhook lookup: bot token -> tenant ID
        await env.TENANT_CONFIGS.put(`bottoken:${botToken}`, tenantId)
        console.log(`[BOOT] Stored config for tenant ${tenantId}`)
      }

      const tenantConfig = await getTenantConfig(env, tenantId)
      if (!tenantConfig) {
        return Response.json({
          error: 'No config found. Provide botToken and userId in POST body on first boot.',
        }, { status: 400 })
      }

      try {
        // Set heartbeat BEFORE boot — prevents cron from setting webhook during boot
        await env.TENANT_CONFIGS.put(`heartbeat:${tenantId}`, new Date().toISOString())

        const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())
        await ensureGateway(sandbox, env, tenantConfig)

        // Delete any webhook that cron might have set before heartbeat took effect
        await fetch(`https://api.telegram.org/bot${tenantConfig.telegramBotToken}/deleteWebhook`).catch(() => {})

        return Response.json({ status: 'booted', tenant: tenantId })
      } catch (error) {
        return Response.json({
          status: 'error',
          tenant: tenantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 503 })
      }
    }

    if (url.pathname === '/restart') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = url.searchParams.get('tenant')
      if (!tenantId) return Response.json({ error: 'Missing ?tenant=' }, { status: 400 })

      const tenantConfig = await getTenantConfig(env, tenantId)
      if (!tenantConfig) return Response.json({ error: 'Tenant not found' }, { status: 404 })

      try {
        // Set heartbeat BEFORE restart — prevents cron from setting webhook during boot
        await env.TENANT_CONFIGS.put(`heartbeat:${tenantId}`, new Date().toISOString())

        const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())

        // Kill existing processes
        try {
          const killProc = await sandbox.startProcess('/bin/bash -c "pkill -9 -f openclaw 2>/dev/null; sleep 2; echo done"')
          await killProc.waitForExit(10_000)
        } catch { /* ignore */ }

        const existing = await findGatewayProcess(sandbox)
        if (existing) { try { await existing.kill() } catch { /* ignore */ } }

        await new Promise(r => setTimeout(r, 3000))
        await ensureGateway(sandbox, env, tenantConfig)

        // Delete any webhook that cron might have set before heartbeat took effect
        await fetch(`https://api.telegram.org/bot${tenantConfig.telegramBotToken}/deleteWebhook`).catch(() => {})

        return Response.json({ status: 'restarted', tenant: tenantId })
      } catch (error) {
        return Response.json({
          status: 'error',
          tenant: tenantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 503 })
      }
    }

    if (url.pathname === '/logs') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = url.searchParams.get('tenant')
      if (!tenantId) return Response.json({ error: 'Missing ?tenant=' }, { status: 400 })

      // Check heartbeat first — if stale, container is likely sleeping.
      // Avoids waking it just to check logs (listProcesses wakes the DO).
      const heartbeat = await env.TENANT_CONFIGS.get(`heartbeat:${tenantId}`)
      if (heartbeat) {
        const age = Date.now() - new Date(heartbeat).getTime()
        if (age > HEARTBEAT_THRESHOLD_MS) {
          return Response.json({
            error: 'Container is sleeping',
            lastHeartbeat: heartbeat,
            ageSeconds: Math.round(age / 1000),
          }, { status: 404 })
        }
      } else {
        // No heartbeat ever recorded — check if tenant exists at all
        const config = await getTenantConfig(env, tenantId)
        if (!config) return Response.json({ error: 'Tenant not found' }, { status: 404 })
        return Response.json({ error: 'Container is sleeping (no heartbeat)', }, { status: 404 })
      }

      try {
        const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())
        const proc = await findGatewayProcess(sandbox)
        if (!proc) return Response.json({ error: 'No gateway process found' }, { status: 404 })

        const logs = await proc.getLogs()
        return Response.json({
          status: proc.status,
          command: proc.command,
          stdout: logs.stdout,
          stderr: logs.stderr,
        })
      } catch (error) {
        return Response.json({
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 })
      }
    }

    // Debug: test R2 mount (admin only)
    if (url.pathname === '/debug-mount') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = url.searchParams.get('tenant')
      if (!tenantId) return Response.json({ error: 'Missing ?tenant=' }, { status: 400 })

      const hasR2Creds = !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.CF_ACCOUNT_ID)
      const result: any = {
        hasR2Creds,
        bucketName: env.R2_BUCKET_NAME || 'cobotclaw-data',
        mountPath: R2_MOUNT_PATH,
      }

      if (hasR2Creds) {
        const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())
        result.alreadyMounted = await isR2Mounted(sandbox)
        result.mounted = await mountR2(sandbox, env)
      }

      return Response.json(result)
    }

    // Debug: run a command inside the container (admin only)
    if (url.pathname === '/exec') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = url.searchParams.get('tenant')
      const cmd = url.searchParams.get('cmd')
      const timeoutMs = Math.min(Number(url.searchParams.get('timeout')) || 30_000, 120_000)
      if (!tenantId || !cmd) return Response.json({ error: 'Missing ?tenant= or ?cmd=' }, { status: 400 })

      try {
        const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())
        // Always ensure R2 is mounted (idempotent — handles "already mounted")
        await mountR2(sandbox, env)
        const proc = await sandbox.startProcess(`/bin/bash -c "${cmd.replace(/"/g, '\\"')}"`)
        await proc.waitForExit(timeoutMs)
        const logs = await proc.getLogs()
        return Response.json({ stdout: logs.stdout, stderr: logs.stderr })
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
      }
    }

    if (url.pathname === '/tenants') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenants = []
      let cursor: string | undefined
      do {
        const list = await env.TENANT_CONFIGS.list({ prefix: 'tenant:', cursor })
        for (const key of list.keys) {
          const config = await getTenantConfig(env, key.name.replace('tenant:', ''))
          if (config) {
            tenants.push({
              tenantId: config.tenantId,
              telegramUserId: config.telegramUserId,
              createdAt: config.createdAt,
            })
          }
        }
        cursor = list.list_complete ? undefined : list.cursor
      } while (cursor)
      return Response.json({ tenants })
    }

    // Debug: manually run cron logic and return results (admin only)
    if (url.pathname === '/debug-cron') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const results: any[] = []
      if (!env.WORKER_URL) {
        return Response.json({ error: 'WORKER_URL not set', results })
      }

      let tenantCount = 0
      let cursor: string | undefined
      do {
        const list = await env.TENANT_CONFIGS.list({ prefix: 'tenant:', cursor })
        tenantCount += list.keys.length
        for (const key of list.keys) {
          const entry: any = { key: key.name }
          try {
            const raw = await env.TENANT_CONFIGS.get(key.name)
            if (!raw) { entry.error = 'empty value'; results.push(entry); continue }
            const config: TenantConfig = JSON.parse(raw)
            entry.tenantId = config.tenantId

            const heartbeat = await env.TENANT_CONFIGS.get(`heartbeat:${config.tenantId}`)
            entry.heartbeat = heartbeat
            if (heartbeat) {
              const age = Date.now() - new Date(heartbeat).getTime()
              entry.heartbeatAgeSeconds = Math.round(age / 1000)
              if (age < HEARTBEAT_THRESHOLD_MS) {
                entry.action = 'skip (heartbeat fresh)'
                results.push(entry)
                continue
              }
            }

            // Actually set the webhook (dry_run param to skip)
            const dryRun = url.searchParams.get('dry_run') === 'true'
            const webhookUrl = `${env.WORKER_URL}/webhook/${config.tenantId}`
            entry.webhookUrl = webhookUrl

            if (dryRun) {
              entry.action = 'would set webhook (dry run)'
            } else {
              const res = await fetch(
                `https://api.telegram.org/bot${config.telegramBotToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
              )
              const data = await res.json() as any
              entry.action = data.ok ? 'webhook set' : `failed: ${data.description}`
            }
          } catch (e) {
            entry.error = e instanceof Error ? e.message : String(e)
          }
          results.push(entry)
        }
        cursor = list.list_complete ? undefined : list.cursor
      } while (cursor)
      return Response.json({ workerUrl: env.WORKER_URL, tenantCount, results })
    }

    // =======================================================================
    // Proxy to tenant containers — requires X-Tenant-ID header
    // =======================================================================

    const tenantId = request.headers.get('X-Tenant-ID')
    if (!tenantId) {
      return Response.json({ error: 'Missing X-Tenant-ID header' }, { status: 400 })
    }

    const tenantConfig = await getTenantConfig(env, tenantId)
    if (!tenantConfig) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const sandbox = getSandbox(env.Sandbox, `tenant-${tenantId}`, getSandboxOptions())

    try {
      await ensureGateway(sandbox, env, tenantConfig)
    } catch (error) {
      console.error('[GATEWAY] Failed to start OpenClaw for tenant', tenantId, error)
      return Response.json(
        { error: 'OpenClaw gateway failed to start. Try again in a moment.' },
        { status: 503 }
      )
    }

    // WebSocket proxy
    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    if (isWebSocket) {
      const containerRes = await sandbox.wsConnect(request, OPENCLAW_PORT)
      const containerWs = containerRes.webSocket
      if (!containerWs) return containerRes

      const [clientWs, serverWs] = Object.values(new WebSocketPair())
      serverWs.accept()
      containerWs.accept()

      serverWs.addEventListener('message', (e: MessageEvent) => {
        if (containerWs.readyState === WebSocket.OPEN) containerWs.send(e.data)
      })
      containerWs.addEventListener('message', (e: MessageEvent) => {
        if (serverWs.readyState === WebSocket.OPEN) serverWs.send(e.data)
      })
      serverWs.addEventListener('close', (e: CloseEvent) => {
        try { containerWs.close(e.code, e.reason) } catch { /* already closed */ }
      })
      containerWs.addEventListener('close', (e: CloseEvent) => {
        const reason = e.reason.length > 123 ? e.reason.slice(0, 120) + '...' : e.reason
        try { serverWs.close(e.code, reason) } catch { /* already closed */ }
      })
      // Handle errors — close the peer socket to prevent hanging connections
      serverWs.addEventListener('error', () => {
        try { containerWs.close(1011, 'Client error') } catch { /* ignore */ }
      })
      containerWs.addEventListener('error', () => {
        try { serverWs.close(1011, 'Container error') } catch { /* ignore */ }
      })

      return new Response(null, { status: 101, webSocket: clientWs })
    }

    // HTTP proxy to container
    const httpRes = await sandbox.containerFetch(request, OPENCLAW_PORT)
    return new Response(httpRes.body, {
      status: httpRes.status,
      statusText: httpRes.statusText,
      headers: httpRes.headers,
    })
  },
}
