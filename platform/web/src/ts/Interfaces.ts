export interface Instance {
  id: string
  name: string
  tenant_id: string
  telegram_user_id: string
  telegram_bot_username: string | null
  status: 'creating' | 'active' | 'stopped' | 'error'
  created_at: string
}

export interface User {
  id: string
  email: string | null
  wallet_address: string | null
  login_method: string | null
  created_at: string
}

export interface Agent {
  id: string
  user_id: string
  name: string
  description: string
  system_prompt: string
  capabilities: string[]
  created_at: string
}
