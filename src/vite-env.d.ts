/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_TWELVE_DATA_API_KEY: string
  readonly VITE_ALPACA_API_KEY: string
  readonly VITE_ALPACA_SECRET_KEY: string
  readonly VITE_ALPACA_BASE_URL: string
  readonly VITE_TELEGRAM_BOT_REPORTS_TOKEN: string
  readonly VITE_TELEGRAM_BOT_STATUS_TOKEN: string
  readonly VITE_TELEGRAM_BOT_TRADES_TOKEN: string
  readonly VITE_TELEGRAM_CHAT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
