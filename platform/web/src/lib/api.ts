import type { Instance, User, Agent } from '../ts/Interfaces'
import { auth } from './firebase'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getFirebaseToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = await getFirebaseToken()

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as any).error || `Request failed: ${res.status}`)
  }

  return res.json()
}

export async function listInstances(): Promise<Instance[]> {
  const data = await apiFetch('/instances')
  return (data as any).instances
}

export async function createInstance(params: {
  name: string
  telegram_bot_token: string
  telegram_user_id: string
}): Promise<Instance> {
  const data = await apiFetch('/instances', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return (data as any).instance
}

export async function restartInstance(id: string): Promise<void> {
  await apiFetch(`/instances/${id}/restart`, { method: 'POST' })
}

export async function deleteInstance(id: string): Promise<void> {
  await apiFetch(`/instances/${id}`, { method: 'DELETE' })
}

export async function getMe(): Promise<User> {
  const data = await apiFetch('/users/me')
  return (data as any).user
}

// Agent API (proxied to identity service)

export async function listAgents(): Promise<Agent[]> {
  const data = await apiFetch('/agents')
  return (data as any).agents
}

export async function createAgent(params: {
  name: string
  description: string
  system_prompt: string
  capabilities: string[]
}): Promise<Agent> {
  const data = await apiFetch('/agents', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return (data as any).agent
}
