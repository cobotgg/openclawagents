CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  wallet_address TEXT,
  login_method TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  tenant_id TEXT UNIQUE NOT NULL,
  telegram_bot_token TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  telegram_bot_username TEXT,
  status TEXT DEFAULT 'creating',
  created_at TEXT DEFAULT (datetime('now'))
);
