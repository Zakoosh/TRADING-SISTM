-- ============================================================
-- نظام التداول الذكي - Investor Dashboard AI
-- Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. قائمة المتابعة (Watchlist)
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  name        TEXT NOT NULL,
  market      TEXT NOT NULL CHECK (market IN ('US','TR','CRYPTO','COMMODITY','INDEX')),
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- ============================================================
-- 2. التحليلات الذكية (AI Analyses)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_analyses (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol              TEXT NOT NULL,
  name                TEXT NOT NULL,
  market              TEXT NOT NULL,
  signal              TEXT NOT NULL CHECK (signal IN ('BUY','SELL','HOLD')),
  confidence          NUMERIC(5,2) NOT NULL,
  confidence_level    TEXT NOT NULL CHECK (confidence_level IN ('HIGH','MEDIUM','LOW')),
  price               NUMERIC(18,6) NOT NULL,
  target_price        NUMERIC(18,6),
  stop_loss           NUMERIC(18,6),
  reasoning           TEXT,
  technical_summary   TEXT,
  fundamental_summary TEXT,
  indicators          JSONB,
  timeframe           TEXT DEFAULT '1D',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_user    ON ai_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_symbol  ON ai_analyses(symbol);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_created ON ai_analyses(created_at DESC);

-- ============================================================
-- 3. نقاط التقييم (Evaluation Scores)
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id      UUID REFERENCES ai_analyses(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL,
  signal           TEXT NOT NULL,
  rsi_score        NUMERIC(5,2) DEFAULT 0,
  macd_score       NUMERIC(5,2) DEFAULT 0,
  adx_score        NUMERIC(5,2) DEFAULT 0,
  trend_score      NUMERIC(5,2) DEFAULT 0,
  momentum_score   NUMERIC(5,2) DEFAULT 0,
  total_score      NUMERIC(5,2) DEFAULT 0,
  passed           BOOLEAN DEFAULT FALSE,
  sent_to_telegram BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_scores_user   ON evaluation_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_eval_scores_passed ON evaluation_scores(passed);

-- ============================================================
-- 4. صفقات المحاكاة (Simulator Trades)
-- ============================================================
CREATE TABLE IF NOT EXISTS simulator_trades (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('BUY','SELL')),
  quantity    NUMERIC(18,6) NOT NULL,
  price       NUMERIC(18,6) NOT NULL,
  total       NUMERIC(18,6) NOT NULL,
  status      TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  close_price NUMERIC(18,6),
  pnl         NUMERIC(18,6),
  pnl_percent NUMERIC(10,4),
  closed_at   TIMESTAMPTZ,
  analysis_id UUID REFERENCES ai_analyses(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_trades_user   ON simulator_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_sim_trades_status ON simulator_trades(status);

-- ============================================================
-- 5. محفظة المحاكاة (Simulator Portfolio)
-- ============================================================
CREATE TABLE IF NOT EXISTS simulator_portfolio (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cash           NUMERIC(18,2) DEFAULT 100000,
  total_invested NUMERIC(18,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. الصفقات الحقيقية (Real Trades - Alpaca)
-- ============================================================
CREATE TABLE IF NOT EXISTS real_trades (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alpaca_order_id  TEXT,
  symbol           TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('BUY','SELL')),
  quantity         NUMERIC(18,6) NOT NULL,
  price            NUMERIC(18,6),
  total            NUMERIC(18,6),
  status           TEXT NOT NULL,
  analysis_id      UUID REFERENCES ai_analyses(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_trades_user ON real_trades(user_id);

-- ============================================================
-- 7. التقارير (Reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  total_analyses  INTEGER DEFAULT 0,
  strong_signals  INTEGER DEFAULT 0,
  sent_signals    INTEGER DEFAULT 0,
  avg_score       NUMERIC(5,2) DEFAULT 0,
  success_rate    NUMERIC(5,2) DEFAULT 0,
  portfolio_value NUMERIC(18,2) DEFAULT 0,
  daily_pnl       NUMERIC(18,2) DEFAULT 0,
  report_data     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- 8. إعدادات المستخدم (User Settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  simulator_balance   NUMERIC(18,2) DEFAULT 100000,
  risk_level          TEXT DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  auto_analysis       BOOLEAN DEFAULT FALSE,
  analysis_interval   INTEGER DEFAULT 60,
  min_signal_score    NUMERIC(5,2) DEFAULT 75,
  max_position_size   NUMERIC(5,2) DEFAULT 10,
  enable_telegram     BOOLEAN DEFAULT TRUE,
  enable_real_trading BOOLEAN DEFAULT FALSE,
  alpaca_api_key      TEXT,
  alpaca_secret_key   TEXT,
  alpaca_mode         TEXT DEFAULT 'PAPER' CHECK (alpaca_mode IN ('PAPER','LIVE')),
  gemini_api_key      TEXT,
  twelve_data_api_key TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. سجل الإشارات (Signals History - for backtesting)
-- ============================================================
CREATE TABLE IF NOT EXISTS signals_history (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id  UUID REFERENCES ai_analyses(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  signal       TEXT NOT NULL,
  entry_price  NUMERIC(18,6),
  target_price NUMERIC(18,6),
  stop_loss    NUMERIC(18,6),
  score        NUMERIC(5,2),
  outcome      TEXT CHECK (outcome IN ('WIN','LOSS','PENDING','CANCELLED')),
  exit_price   NUMERIC(18,6),
  pnl_percent  NUMERIC(10,4),
  evaluated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE watchlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_trades   ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_trades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals_history    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies (each user sees only their own data)
-- ============================================================
DO $$ BEGIN

  -- Watchlist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='watchlist' AND policyname='own_watchlist') THEN
    CREATE POLICY own_watchlist ON watchlist FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- AI Analyses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_analyses' AND policyname='own_analyses') THEN
    CREATE POLICY own_analyses ON ai_analyses FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Evaluation Scores
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaluation_scores' AND policyname='own_scores') THEN
    CREATE POLICY own_scores ON evaluation_scores FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Simulator Trades
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='simulator_trades' AND policyname='own_sim_trades') THEN
    CREATE POLICY own_sim_trades ON simulator_trades FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Simulator Portfolio
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='simulator_portfolio' AND policyname='own_portfolio') THEN
    CREATE POLICY own_portfolio ON simulator_portfolio FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Real Trades
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='real_trades' AND policyname='own_real_trades') THEN
    CREATE POLICY own_real_trades ON real_trades FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reports' AND policyname='own_reports') THEN
    CREATE POLICY own_reports ON reports FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- User Settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_settings' AND policyname='own_settings') THEN
    CREATE POLICY own_settings ON user_settings FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Signals History
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signals_history' AND policyname='own_signals_history') THEN
    CREATE POLICY own_signals_history ON signals_history FOR ALL USING (auth.uid() = user_id);
  END IF;

END $$;

-- ============================================================
-- Real-time subscriptions (enable for live updates)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ai_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE simulator_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE real_trades;

-- ============================================================
-- Updated_at trigger for user_settings
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_settings ON user_settings;
CREATE TRIGGER set_updated_at_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_portfolio ON simulator_portfolio;
CREATE TRIGGER set_updated_at_portfolio
  BEFORE UPDATE ON simulator_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
