export interface SandboxConfig {
  sandboxUrl: string
  adminToken: string
}

export async function validateTelegramBot(botToken: string): Promise<{ username: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
  if (!res.ok) {
    throw new Error('Invalid Telegram bot token')
  }
  const data = (await res.json()) as any
  if (!data.ok || !data.result?.username) {
    throw new Error('Could not verify Telegram bot')
  }
  return { username: data.result.username }
}

/**
 * Boot an instance. The sandbox /boot endpoint can take up to 3 minutes
 * because it waits for the container to start. We use AbortController to
 * timeout after 25 seconds — the KV config is stored immediately by the
 * sandbox, so even if we timeout, the container will still boot.
 * A timeout is NOT an error — it just means the container is still starting.
 */
export async function bootInstance(
  config: SandboxConfig,
  tenantId: string,
  botToken: string,
  userId: string,
): Promise<{ status: string; timedOut?: boolean }> {
  const url = new URL('/boot', config.sandboxUrl)
  url.searchParams.set('tenant', tenantId)
  url.searchParams.set('bot_token', botToken)
  url.searchParams.set('user_id', userId)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.adminToken}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Sandbox boot failed: ${res.status} ${body}`)
    }

    return (await res.json()) as { status: string }
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      // Timeout is expected — container is still booting, KV config was stored
      console.log(`[BOOT] Timeout for ${tenantId} — container still starting`)
      return { status: 'booting', timedOut: true }
    }
    throw err
  }
}

export async function restartInstance(
  config: SandboxConfig,
  tenantId: string,
): Promise<{ status: string }> {
  const url = new URL('/restart', config.sandboxUrl)
  url.searchParams.set('tenant', tenantId)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.adminToken}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Sandbox restart failed: ${res.status} ${body}`)
    }

    return (await res.json()) as { status: string }
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      console.log(`[RESTART] Timeout for ${tenantId} — container still restarting`)
      return { status: 'restarting' }
    }
    throw err
  }
}

export async function getInstanceLogs(
  config: SandboxConfig,
  tenantId: string,
): Promise<{ stdout: string; stderr: string; status: string }> {
  const url = new URL('/logs', config.sandboxUrl)
  url.searchParams.set('tenant', tenantId)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${config.adminToken}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to get logs: ${res.status}`)
  }

  return (await res.json()) as { stdout: string; stderr: string; status: string }
}
