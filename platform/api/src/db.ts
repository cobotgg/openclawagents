import type { D1Database } from '@cloudflare/workers-types'

export interface User {
  id: string
  email: string | null
  wallet_address: string | null
  login_method: string | null
  created_at: string
}

export interface Instance {
  id: string
  user_id: string
  name: string
  tenant_id: string
  telegram_bot_token: string
  telegram_user_id: string
  telegram_bot_username: string | null
  status: string
  created_at: string
}

export async function upsertUser(
  db: D1Database,
  userId: string,
  email?: string,
  walletAddress?: string,
  loginMethod?: string,
): Promise<User> {
  await db
    .prepare(
      `INSERT INTO users (id, email, wallet_address, login_method)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET
         email = COALESCE(?2, users.email),
         wallet_address = COALESCE(?3, users.wallet_address),
         login_method = COALESCE(?4, users.login_method)`,
    )
    .bind(userId, email || null, walletAddress || null, loginMethod || null)
    .run()

  return (await db.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first()) as User
}

export async function getUser(db: D1Database, userId: string): Promise<User | null> {
  return (await db.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first()) as User | null
}

export async function createInstance(
  db: D1Database,
  instance: Omit<Instance, 'created_at'>,
): Promise<Instance> {
  await db
    .prepare(
      `INSERT INTO instances (id, user_id, name, tenant_id, telegram_bot_token, telegram_user_id, telegram_bot_username, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      instance.id,
      instance.user_id,
      instance.name,
      instance.tenant_id,
      instance.telegram_bot_token,
      instance.telegram_user_id,
      instance.telegram_bot_username,
      instance.status,
    )
    .run()

  return (await db.prepare('SELECT * FROM instances WHERE id = ?1').bind(instance.id).first()) as Instance
}

export async function listInstances(db: D1Database, userId: string): Promise<Instance[]> {
  const result = await db
    .prepare('SELECT * FROM instances WHERE user_id = ?1 ORDER BY created_at DESC')
    .bind(userId)
    .all()
  return (result.results || []) as unknown as Instance[]
}

export async function getInstance(db: D1Database, instanceId: string): Promise<Instance | null> {
  return (await db
    .prepare('SELECT * FROM instances WHERE id = ?1')
    .bind(instanceId)
    .first()) as Instance | null
}

export async function updateInstanceStatus(
  db: D1Database,
  instanceId: string,
  status: string,
): Promise<void> {
  await db.prepare('UPDATE instances SET status = ?1 WHERE id = ?2').bind(status, instanceId).run()
}

export async function deleteInstance(db: D1Database, instanceId: string): Promise<void> {
  await db.prepare('DELETE FROM instances WHERE id = ?1').bind(instanceId).run()
}

export async function countUserInstances(db: D1Database, userId: string): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM instances WHERE user_id = ?1')
    .bind(userId)
    .first<{ count: number }>()
  return result?.count || 0
}
