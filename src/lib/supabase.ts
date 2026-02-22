import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database table names
export const TABLES = {
  WATCHLIST: 'watchlist',
  AI_ANALYSES: 'ai_analyses',
  EVALUATION_SCORES: 'evaluation_scores',
  SIMULATOR_TRADES: 'simulator_trades',
  SIMULATOR_PORTFOLIO: 'simulator_portfolio',
  REAL_TRADES: 'real_trades',
  REPORTS: 'reports',
  USER_SETTINGS: 'user_settings',
  SIGNALS_HISTORY: 'signals_history',
} as const

export const supabaseSchema = `
-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- AI Analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('BUY', 'SELL', 'HOLD')),
  confidence NUMERIC NOT NULL,
  confidence_level TEXT NOT NULL,
  price NUMERIC NOT NULL,
  target_price NUMERIC,
  stop_loss NUMERIC,
  reasoning TEXT,
  technical_summary TEXT,
  fundamental_summary TEXT,
  indicators JSONB,
  timeframe TEXT DEFAULT '1D',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluation Scores table
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES ai_analyses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  signal TEXT NOT NULL,
  rsi_score NUMERIC DEFAULT 0,
  macd_score NUMERIC DEFAULT 0,
  adx_score NUMERIC DEFAULT 0,
  trend_score NUMERIC DEFAULT 0,
  momentum_score NUMERIC DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  passed BOOLEAN DEFAULT FALSE,
  sent_to_telegram BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simulator Trades table
CREATE TABLE IF NOT EXISTS simulator_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  close_price NUMERIC,
  pnl NUMERIC,
  pnl_percent NUMERIC,
  closed_at TIMESTAMPTZ,
  analysis_id UUID REFERENCES ai_analyses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Simulator Portfolio table
CREATE TABLE IF NOT EXISTS simulator_portfolio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cash NUMERIC DEFAULT 100000,
  total_invested NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real Trades table
CREATE TABLE IF NOT EXISTS real_trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alpaca_order_id TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price NUMERIC,
  total NUMERIC,
  status TEXT NOT NULL,
  analysis_id UUID REFERENCES ai_analyses(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_analyses INTEGER DEFAULT 0,
  strong_signals INTEGER DEFAULT 0,
  sent_signals INTEGER DEFAULT 0,
  avg_score NUMERIC DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  portfolio_value NUMERIC DEFAULT 0,
  daily_pnl NUMERIC DEFAULT 0,
  report_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  simulator_balance NUMERIC DEFAULT 100000,
  risk_level TEXT DEFAULT 'MEDIUM',
  auto_analysis BOOLEAN DEFAULT FALSE,
  analysis_interval INTEGER DEFAULT 60,
  min_signal_score NUMERIC DEFAULT 75,
  max_position_size NUMERIC DEFAULT 10,
  enable_telegram BOOLEAN DEFAULT TRUE,
  enable_real_trading BOOLEAN DEFAULT FALSE,
  alpaca_api_key TEXT,
  alpaca_secret_key TEXT,
  alpaca_mode TEXT DEFAULT 'PAPER',
  gemini_api_key TEXT,
  twelve_data_api_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own analyses" ON ai_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own scores" ON evaluation_scores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own simulator trades" ON simulator_trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own portfolio" ON simulator_portfolio FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own real trades" ON real_trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own reports" ON reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
`
