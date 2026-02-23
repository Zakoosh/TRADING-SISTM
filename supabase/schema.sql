-- ============================================================
-- نظام التداول الذكي - Investor Dashboard AI
-- Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. قائمة الأسهم المتاحة (Available Stocks)
-- ============================================================
CREATE TABLE IF NOT EXISTS stocks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol      TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  market      TEXT NOT NULL CHECK (market IN ('US','TR','CRYPTO','COMMODITY','INDEX')),
  currency    TEXT NOT NULL DEFAULT 'USD',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);

-- ============================================================
-- 2. قائمة المتابعة (Watchlist)
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
-- 3. التحليلات الذكية (AI Analyses)
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
-- 4. نقاط التقييم (Evaluation Scores)
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
-- 5. صفقات المحاكاة (Simulator Trades)
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
-- 6. محفظة المحاكاة (Simulator Portfolio)
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
-- 7. الصفقات الحقيقية (Real Trades - Alpaca)
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
-- 8. التقارير (Reports)
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
-- 9. إعدادات المستخدم (User Settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  simulator_balance   NUMERIC(18,2) DEFAULT 100000,
  risk_level          TEXT DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  auto_analysis       BOOLEAN DEFAULT TRUE,
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
-- 10. سجل الإشارات (Signals History - for backtesting)
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
-- 11. سجل الأسعار الزمني (Price History)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol         TEXT NOT NULL,
  market         TEXT NOT NULL,
  price          NUMERIC(18,6) NOT NULL,
  change         NUMERIC(18,6) DEFAULT 0,
  change_percent NUMERIC(10,4) DEFAULT 0,
  volume         NUMERIC(18,2) DEFAULT 0,
  fetched_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_user_symbol_time ON price_history(user_id, symbol, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time ON price_history(symbol, fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_history_user_symbol_fetched_at ON price_history(user_id, symbol, fetched_at);

-- ============================================================
-- 12. إعدادات الرسم البياني (Chart Annotations)
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_annotations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  show_sma20  BOOLEAN DEFAULT TRUE,
  show_sma50  BOOLEAN DEFAULT FALSE,
  show_trend  BOOLEAN DEFAULT FALSE,
  trend_start NUMERIC(18,6),
  trend_end   NUMERIC(18,6),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_chart_ann_user_symbol ON chart_annotations(user_id, symbol);

-- ============================================================
-- 13. سجل الأتمتة (Automation Runs)
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_runs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  run_type         TEXT NOT NULL CHECK (run_type IN ('AUTO_ANALYSIS','AUTO_EVALUATION','AUTO_SIMULATION','AUTO_REAL_TRADING')),
  scope            TEXT,
  status           TEXT NOT NULL CHECK (status IN ('STARTED','SUCCESS','FAILED')),
  analyses_count   INTEGER DEFAULT 0,
  evaluations_count INTEGER DEFAULT 0,
  simulator_count  INTEGER DEFAULT 0,
  real_trades_count INTEGER DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auto_runs_user_time ON automation_runs(user_id, started_at DESC);

-- ============================================================
-- 14. سجل النظام المركزي (System Logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  status      TEXT DEFAULT 'INFO' CHECK (status IN ('INFO','SUCCESS','FAILED')),
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_user_time ON system_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action_type);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE stocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_trades   ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulator_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_trades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_annotations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies (each user sees only their own data)
-- ============================================================
DO $$ BEGIN

  -- Stocks (public read access for all)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stocks' AND policyname='public_read_stocks') THEN
    CREATE POLICY public_read_stocks ON stocks FOR SELECT USING (true);
  END IF;

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

  -- Price History
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_history' AND policyname='own_price_history') THEN
    CREATE POLICY own_price_history ON price_history FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Chart Annotations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chart_annotations' AND policyname='own_chart_annotations') THEN
    CREATE POLICY own_chart_annotations ON chart_annotations FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- Automation Runs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='automation_runs' AND policyname='own_automation_runs') THEN
    CREATE POLICY own_automation_runs ON automation_runs FOR ALL USING (auth.uid() = user_id);
  END IF;

  -- System Logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_logs' AND policyname='own_system_logs') THEN
    CREATE POLICY own_system_logs ON system_logs FOR ALL USING (auth.uid() = user_id);
  END IF;

END $$;

-- ============================================================
-- Real-time subscriptions (enable for live updates)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_analyses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_analyses;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'evaluation_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_scores;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'simulator_trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE simulator_trades;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'real_trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE real_trades;
  END IF;
END $$;

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

-- ============================================================
-- Initial Stock Data
-- ============================================================
INSERT INTO stocks (symbol, name, market, currency) VALUES
-- US Stocks
('AAPL', 'Apple Inc.', 'US', 'USD'),
('MSFT', 'Microsoft Corp.', 'US', 'USD'),
('GOOGL', 'Alphabet Inc.', 'US', 'USD'),
('AMZN', 'Amazon.com Inc.', 'US', 'USD'),
('NVDA', 'NVIDIA Corp.', 'US', 'USD'),
('META', 'Meta Platforms', 'US', 'USD'),
('TSLA', 'Tesla Inc.', 'US', 'USD'),
('JPM', 'JPMorgan Chase', 'US', 'USD'),
('V', 'Visa Inc.', 'US', 'USD'),
('WMT', 'Walmart Inc.', 'US', 'USD'),
-- Turkish Stocks
('GARAN.IS', 'Garanti Bankası', 'TR', 'TRY'),
('AKBNK.IS', 'Akbank', 'TR', 'TRY'),
('THYAO.IS', 'Türk Hava Yolları', 'TR', 'TRY'),
('EREGL.IS', 'Ereğli Demir Çelik', 'TR', 'TRY'),
('SISE.IS', 'Şişecam', 'TR', 'TRY'),
('BIMAS.IS', 'BIM Birleşik Mağazalar', 'TR', 'TRY'),
('ARCLK.IS', 'Arçelik A.Ş.', 'TR', 'TRY'),
('KCHOL.IS', 'Koç Holding', 'TR', 'TRY'),
('TCELL.IS', 'Turkcell', 'TR', 'TRY'),
('SAHOL.IS', 'Sabancı Holding', 'TR', 'TRY'),
-- Crypto
('BTC/USD', 'Bitcoin', 'CRYPTO', 'USD'),
('ETH/USD', 'Ethereum', 'CRYPTO', 'USD'),
('BNB/USD', 'BNB', 'CRYPTO', 'USD'),
('SOL/USD', 'Solana', 'CRYPTO', 'USD'),
('XRP/USD', 'XRP', 'CRYPTO', 'USD'),
('ADA/USD', 'Cardano', 'CRYPTO', 'USD'),
('DOGE/USD', 'Dogecoin', 'CRYPTO', 'USD'),
('AVAX/USD', 'Avalanche', 'CRYPTO', 'USD'),
-- Commodities
('XAU/USD', 'Gold', 'COMMODITY', 'USD'),
('XAG/USD', 'Silver', 'COMMODITY', 'USD'),
('WTI/USD', 'Crude Oil WTI', 'COMMODITY', 'USD'),
('BRENT', 'Brent Oil', 'COMMODITY', 'USD'),
('XPT/USD', 'Platinum', 'COMMODITY', 'USD'),
-- Indices
('SPX', 'S&P 500', 'INDEX', 'USD'),
('DJI', 'Dow Jones', 'INDEX', 'USD'),
('IXIC', 'NASDAQ', 'INDEX', 'USD'),
('FTSE', 'FTSE 100', 'INDEX', 'GBP'),
('DAX', 'DAX', 'INDEX', 'EUR'),
('XU100', 'BIST 100', 'INDEX', 'TRY')
ON CONFLICT (symbol) DO NOTHING;

-- Additional US Stocks
INSERT INTO stocks (symbol, name, market, currency) VALUES
('ORCL', 'Oracle Corporation', 'US', 'USD'),
('CRM', 'Salesforce Inc.', 'US', 'USD'),
('ADBE', 'Adobe Inc.', 'US', 'USD'),
('PYPL', 'PayPal Holdings', 'US', 'USD'),
('NKE', 'Nike Inc.', 'US', 'USD'),
('COST', 'Costco Wholesale', 'US', 'USD'),
('ABBV', 'AbbVie Inc.', 'US', 'USD'),
('MRK', 'Merck & Co.', 'US', 'USD'),
('PFE', 'Pfizer Inc.', 'US', 'USD'),
('TMO', 'Thermo Fisher Scientific', 'US', 'USD'),
('MCD', 'McDonald''s Corp.', 'US', 'USD'),
('QCOM', 'Qualcomm Inc.', 'US', 'USD'),
('TXN', 'Texas Instruments', 'US', 'USD'),
('AVGO', 'Broadcom Inc.', 'US', 'USD'),
('AMAT', 'Applied Materials', 'US', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Turkish Stocks
INSERT INTO stocks (symbol, name, market, currency) VALUES
('ISCTR.IS', 'İş Bankası (C)', 'TR', 'TRY'),
('YKBNK.IS', 'Yapı Kredi Bankası', 'TR', 'TRY'),
('HALKB.IS', 'Halkbank', 'TR', 'TRY'),
('KRDMD.IS', 'Kardemir (D)', 'TR', 'TRY'),
('KOZAL.IS', 'Koza Altın', 'TR', 'TRY'),
('ENKAI.IS', 'Enka İnşaat', 'TR', 'TRY'),
('FROTO.IS', 'Ford Otosan', 'TR', 'TRY'),
('OTKAR.IS', 'Otokar', 'TR', 'TRY'),
('DOHOL.IS', 'Doğan Holding', 'TR', 'TRY'),
('VESTL.IS', 'Vestel', 'TR', 'TRY')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Crypto
INSERT INTO stocks (symbol, name, market, currency) VALUES
('LTC/USD', 'Litecoin', 'CRYPTO', 'USD'),
('BCH/USD', 'Bitcoin Cash', 'CRYPTO', 'USD'),
('ATOM/USD', 'Cosmos', 'CRYPTO', 'USD'),
('FIL/USD', 'Filecoin', 'CRYPTO', 'USD'),
('NEAR/USD', 'NEAR Protocol', 'CRYPTO', 'USD'),
('APT/USD', 'Aptos', 'CRYPTO', 'USD'),
('ARB/USD', 'Arbitrum', 'CRYPTO', 'USD'),
('OP/USD', 'Optimism', 'CRYPTO', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Commodities
INSERT INTO stocks (symbol, name, market, currency) VALUES
('NATGAS/USD', 'Natural Gas Spot', 'COMMODITY', 'USD'),
('COPPER/USD', 'Copper Spot', 'COMMODITY', 'USD'),
('COCOA/USD', 'Cocoa', 'COMMODITY', 'USD'),
('SUGAR/USD', 'Sugar', 'COMMODITY', 'USD')
ON CONFLICT (symbol) DO NOTHING;

-- Additional Indices
INSERT INTO stocks (symbol, name, market, currency) VALUES
('RUT', 'Russell 2000', 'INDEX', 'USD'),
('STOXX50', 'EURO STOXX 50', 'INDEX', 'EUR'),
('IBEX', 'IBEX 35', 'INDEX', 'EUR'),
('SSEC', 'Shanghai Composite', 'INDEX', 'CNY'),
('HSI', 'Hang Seng Index', 'INDEX', 'HKD')
ON CONFLICT (symbol) DO NOTHING;
