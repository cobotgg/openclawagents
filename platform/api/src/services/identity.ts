const IDENTITY_API = 'https://your-domain.com/api'

export interface IdentityTokens {
  accessToken: string
  refreshToken: string
  userId: string
}

export interface IdentityAgent {
  id: string
  user_id: string
  name: string
  description: string
  system_prompt: string
  capabilities: string[]
  created_at: string
}

/**
 * Register/login a user with the identity service using a Firebase ID token.
 * The identity service register endpoint is idempotent (get_or_create).
 */
export async function registerUser(firebaseIdToken: string): Promise<IdentityTokens> {
  const res = await fetch(`${IDENTITY_API}/user/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      id_token: firebaseIdToken,
      device: {
        platform: 'web',
        model: 'CobotAI',
        operating_system: 'CloudflareWorker',
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Identity register failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as any
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user_id,
  }
}

/**
 * Create an agent in the identity service.
 */
export async function createAgent(
  identityToken: string,
  userId: string,
  agent: {
    name: string
    description: string
    system_prompt: string
    capabilities: string[]
  },
): Promise<IdentityAgent> {
  const res = await fetch(`${IDENTITY_API}/user/agents/${userId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identityToken}`,
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify(agent),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Identity create agent failed: ${res.status} ${body}`)
  }

  return (await res.json()) as IdentityAgent
}

/**
 * List agents for a user from the identity service.
 */
export async function listAgents(
  identityToken: string,
  userId: string,
  offset = 0,
  limit = 50,
): Promise<{ total_count: number; agents: IdentityAgent[] }> {
  const res = await fetch(
    `${IDENTITY_API}/user/agents/${userId}/?offset=${offset}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${identityToken}`,
        'X-Request-Id': crypto.randomUUID(),
      },
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Identity list agents failed: ${res.status} ${body}`)
  }

  return (await res.json()) as { total_count: number; agents: IdentityAgent[] }
}
