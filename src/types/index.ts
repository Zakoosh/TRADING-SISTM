// Market Types
export type MarketType = 'US' | 'TR' | 'CRYPTO' | 'COMMODITY' | 'INDEX';

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  market: MarketType;
  currency: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  market: MarketType;
  added_at: string;
}

// AI Analysis Types
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema20: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  adx: number;
  atr: number;
  stochastic: number;
  momentum: number;
}

export interface AIAnalysis {
  id: string;
  symbol: string;
  name: string;
  market: MarketType;
  signal: SignalType;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  price: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string;
  technicalSummary: string;
  fundamentalSummary: string;
  indicators: TechnicalIndicators;
  timeframe: string;
  createdAt: string;
}

// Evaluator Types
export interface EvaluationScore {
  id: string;
  analysis_id: string;
  symbol: string;
  signal: SignalType;
  rsiScore: number;
  macdScore: number;
  adxScore: number;
  trendScore: number;
  momentumScore: number;
  totalScore: number;
  passed: boolean;
  sentToTelegram: boolean;
  createdAt: string;
}

// Simulator Types
export interface SimulatorTrade {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  market: MarketType;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  closePrice?: number;
  pnl?: number;
  pnlPercent?: number;
  createdAt: string;
  analysis_id?: string;
}

export interface SimulatorPortfolio {
  cash: number;
  totalValue: number;
  invested: number;
  pnl: number;
  pnlPercent: number;
  positions: SimulatorPosition[];
}

export interface SimulatorPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

// Real Trading Types
export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  equity: number;
  last_equity: number;
  long_market_value: number;
  short_market_value: number;
  initial_margin: number;
  maintenance_margin: number;
  daytrade_count: number;
  balance_asof: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: number;
  qty: number;
  side: 'long' | 'short';
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  unrealized_intraday_pl: number;
  unrealized_intraday_plpc: number;
  current_price: number;
  lastday_price: number;
  change_today: number;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string;
  symbol: string;
  qty: number;
  filled_qty: number;
  type: string;
  side: 'buy' | 'sell';
  time_in_force: string;
  status: string;
  filled_avg_price?: number;
}

// Reports Types
export interface DailyReport {
  id: string;
  date: string;
  totalAnalyses: number;
  strongSignals: number;
  sentSignals: number;
  avgScore: number;
  successRate: number;
  topSignals: AIAnalysis[];
  portfolioValue: number;
  dailyPnl: number;
  createdAt: string;
}

// Telegram Types
export interface TelegramMessage {
  botType: 'REPORTS' | 'STATUS' | 'TRADES';
  message: string;
  chatId: string;
}

// User Settings
export interface UserSettings {
  id: string;
  user_id: string;
  simulatorBalance: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  autoAnalysis: boolean;
  analysisInterval: number;
  minSignalScore: number;
  maxPositionSize: number;
  enableTelegram: boolean;
  enableRealTrading: boolean;
  alpacaApiKey?: string;
  alpacaSecretKey?: string;
  alpacaMode: 'PAPER' | 'LIVE';
  openaiApiKey?: string;
  twelveDataApiKey?: string;
}

// Chart Data
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPoint {
  date: string;
  value: number;
  label?: string;
}
