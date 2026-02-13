/**
 * Cobot AI - Type Definitions
 */

export interface TenantInfo {
  id: string
  telegramUserId: string
  telegramBotToken: string
  telegramBotUsername?: string
  createdAt: string
  status: 'provisioning' | 'active' | 'suspended'
  workerName: string
  workerUrl?: string
  webhookSecret: string
  gatewayToken?: string
}

export interface PlatformEnv {
  // KV namespaces
  TENANT_REGISTRY: KVNamespace // tenantId -> TenantInfo
  TELEGRAM_ROUTING: KVNamespace // telegramUserId -> tenantId
  BOT_ROUTING: KVNamespace // botTokenHash -> tenantId

  // D1 database
  USAGE_DB: D1Database

  // Secrets
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY?: string
  CF_API_TOKEN: string
  CF_ACCOUNT_ID: string
  PLATFORM_SECRET: string
  ADMIN_TOKEN: string

  // Config vars
  WORKERS_SUBDOMAIN: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from: {
    id: number
    is_bot: boolean
    first_name: string
    username?: string
  }
  chat: {
    id: number
    type: 'private' | 'group' | 'supergroup' | 'channel'
  }
  date: number
  text?: string
}

export interface ProvisionRequest {
  telegramUserId: string
  telegramBotToken: string
}

export interface ProvisionResponse {
  success: boolean
  tenantId?: string
  message: string
  botUsername?: string
}
