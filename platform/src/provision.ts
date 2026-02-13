/**
 * Cobot AI - Tenant Provisioning
 *
 * Deploys a tenant Worker per user via Cloudflare Workers API.
 * Each tenant Worker validates Telegram webhooks and forwards to the
 * Gateway Worker via Service Binding. The Gateway runs per-tenant
 * OpenClaw containers in isolated Sandbox DOs.
 */

import type { PlatformEnv, TenantInfo, ProvisionRequest, ProvisionResponse } from './types'
import { generateTenantWorkerCode } from './tenant-worker-template'

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashBotToken(token: string): Promise<string> {
  const hash = await sha256(token)
  return hash.slice(0, 32)
}

async function generateWebhookSecret(tenantId: string, platformSecret: string): Promise<string> {
  const hash = await sha256(tenantId + ':' + platformSecret)
  return hash.slice(0, 32)
}

async function validateBotToken(
  token: string
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = (await res.json()) as {
      ok: boolean
      result?: { username: string }
      description?: string
    }
    if (data.ok && data.result) {
      return { valid: true, username: data.result.username }
    }
    return { valid: false, error: data.description || 'Invalid bot token' }
  } catch {
    return { valid: false, error: 'Failed to connect to Telegram API' }
  }
}

async function setupTelegramWebhook(
  botToken: string,
  workerUrl: string,
  webhookSecret: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const params = new URLSearchParams({
      url: workerUrl,
      secret_token: webhookSecret,
      allowed_updates: JSON.stringify(['message']),
      drop_pending_updates: 'true',
    })
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?${params}`
    )
    const data = (await res.json()) as { ok: boolean; description?: string }
    if (data.ok) {
      return { success: true }
    }
    return { success: false, error: data.description || 'Failed to set webhook' }
  } catch {
    return { success: false, error: 'Failed to connect to Telegram API' }
  }
}

async function removeTelegramWebhook(botToken: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`)
  } catch {
    // Best-effort cleanup
  }
}

async function deployTenantWorker(
  env: PlatformEnv,
  tenant: TenantInfo
): Promise<string> {
  const { CF_ACCOUNT_ID: accountId, CF_API_TOKEN: apiToken } = env
  if (!accountId || !apiToken) {
    throw new Error('CF_ACCOUNT_ID and CF_API_TOKEN are required')
  }

  const workerCode = generateTenantWorkerCode()
  const workerName = tenant.workerName

  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2025-05-06',
    compatibility_flags: ['nodejs_compat'],
    bindings: [
      { type: 'plain_text', name: 'TELEGRAM_USER_ID', text: tenant.telegramUserId },
      { type: 'plain_text', name: 'TENANT_ID', text: tenant.id },
      // Service Binding to the Container Worker (per-tenant OpenClaw)
      {
        type: 'service',
        name: 'SANDBOX',
        service: 'cobotclaw-sandbox',
        environment: 'production',
      },
    ],
  }

  const formData = new FormData()
  formData.append('metadata', JSON.stringify(metadata))
  formData.append(
    'worker.mjs',
    new Blob([workerCode], { type: 'application/javascript+module' }),
    'worker.mjs'
  )

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    }
  )

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Worker deploy failed: ${error}`)
  }

  // Set secrets on the tenant Worker (only what's needed for webhook validation + fallback)
  const secrets: Record<string, string> = {
    WEBHOOK_SECRET: tenant.webhookSecret,
    TELEGRAM_BOT_TOKEN: tenant.telegramBotToken,
  }

  for (const [name, value] of Object.entries(secrets)) {
    const secretRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/secrets`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, text: value, type: 'secret_text' }),
      }
    )
    if (!secretRes.ok) {
      console.warn(`Failed to set secret ${name}:`, await secretRes.text())
    }
  }

  // Enable workers.dev subdomain
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    }
  )

  return `https://${workerName}.${env.WORKERS_SUBDOMAIN}.workers.dev`
}

async function deleteTenantWorker(env: PlatformEnv, workerName: string): Promise<void> {
  const { CF_ACCOUNT_ID: accountId, CF_API_TOKEN: apiToken } = env
  if (!accountId || !apiToken) return

  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    )
  } catch {
    // Best-effort cleanup
  }
}

export async function provisionTenant(
  request: ProvisionRequest,
  env: PlatformEnv
): Promise<ProvisionResponse> {
  const { telegramUserId, telegramBotToken } = request

  // Validate inputs
  if (!telegramUserId || !/^\d+$/.test(telegramUserId)) {
    return { success: false, message: 'Invalid Telegram user ID. Must be numeric.' }
  }

  if (!telegramBotToken || !/^\d+:[A-Za-z0-9_-]{30,}$/.test(telegramBotToken)) {
    return { success: false, message: 'Invalid bot token format.' }
  }

  // Check if user already has an active tenant
  const existingTenantId = await env.TELEGRAM_ROUTING.get(telegramUserId)
  if (existingTenantId) {
    const existing = await env.TENANT_REGISTRY.get<TenantInfo>(existingTenantId, {
      type: 'json',
    })
    if (existing?.status === 'active') {
      return {
        success: true,
        tenantId: existingTenantId,
        message: 'You already have an active bot!',
        botUsername: existing.telegramBotUsername,
      }
    }
  }

  // Check if bot token is already in use
  const tokenHash = await hashBotToken(telegramBotToken)
  const existingByToken = await env.BOT_ROUTING.get(tokenHash)
  if (existingByToken) {
    return { success: false, message: 'This bot token is already registered.' }
  }

  // Validate bot token with Telegram
  const validation = await validateBotToken(telegramBotToken)
  if (!validation.valid) {
    return { success: false, message: `Invalid bot token: ${validation.error}` }
  }

  // Generate tenant
  const tenantId = crypto.randomUUID()
  const workerName = `cobot-${tenantId.slice(0, 8)}`
  const webhookSecret = await generateWebhookSecret(tenantId, env.PLATFORM_SECRET)

  const tenant: TenantInfo = {
    id: tenantId,
    telegramUserId,
    telegramBotToken,
    telegramBotUsername: validation.username,
    createdAt: new Date().toISOString(),
    status: 'provisioning',
    workerName,
    webhookSecret,
  }

  try {
    // Store tenant info first (provisioning status)
    await env.TENANT_REGISTRY.put(tenantId, JSON.stringify(tenant))
    await env.TELEGRAM_ROUTING.put(telegramUserId, tenantId)
    await env.BOT_ROUTING.put(tokenHash, tenantId)

    // Deploy the tenant Worker (with Service Binding to cobotclaw-sandbox)
    const workerUrl = await deployTenantWorker(env, tenant)
    tenant.workerUrl = workerUrl

    // Set up Telegram webhook
    const webhookResult = await setupTelegramWebhook(
      telegramBotToken,
      workerUrl,
      webhookSecret
    )
    if (!webhookResult.success) {
      throw new Error(`Webhook setup failed: ${webhookResult.error}`)
    }

    // Mark as active
    tenant.status = 'active'
    await env.TENANT_REGISTRY.put(tenantId, JSON.stringify(tenant))

    // Log provisioning event
    try {
      await env.USAGE_DB.prepare(
        'INSERT INTO events (tenant_id, event_type, metadata) VALUES (?, ?, ?)'
      )
        .bind(tenantId, 'provisioned', JSON.stringify({ workerName, botUsername: validation.username }))
        .run()
    } catch {
      // Non-critical
    }

    return {
      success: true,
      tenantId,
      message: `Your AI assistant @${validation.username} is ready! Open Telegram and send it a message.`,
      botUsername: validation.username,
    }
  } catch (error) {
    // Cleanup on failure
    await env.TENANT_REGISTRY.delete(tenantId)
    await env.TELEGRAM_ROUTING.delete(telegramUserId)
    await env.BOT_ROUTING.delete(tokenHash)
    await deleteTenantWorker(env, workerName)
    await removeTelegramWebhook(telegramBotToken)

    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: `Provisioning failed: ${msg}` }
  }
}

export async function getTenantById(
  tenantId: string,
  env: PlatformEnv
): Promise<TenantInfo | null> {
  return env.TENANT_REGISTRY.get<TenantInfo>(tenantId, { type: 'json' })
}

export async function deleteTenant(
  tenantId: string,
  env: PlatformEnv
): Promise<{ success: boolean; error?: string }> {
  const tenant = await getTenantById(tenantId, env)
  if (!tenant) {
    return { success: false, error: 'Tenant not found' }
  }

  try {
    await deleteTenantWorker(env, tenant.workerName)
    await removeTelegramWebhook(tenant.telegramBotToken)

    const tokenHash = await hashBotToken(tenant.telegramBotToken)
    await env.TENANT_REGISTRY.delete(tenantId)
    await env.TELEGRAM_ROUTING.delete(tenant.telegramUserId)
    await env.BOT_ROUTING.delete(tokenHash)

    try {
      await env.USAGE_DB.prepare(
        'INSERT INTO events (tenant_id, event_type) VALUES (?, ?)'
      )
        .bind(tenantId, 'deleted')
        .run()
    } catch {
      // Non-critical
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
