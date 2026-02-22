import { createClient } from '@supabase/supabase-js'
import { AIAnalysis, EvaluationScore, SimulatorTrade, WatchlistItem, UserSettings } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_url' &&
    supabaseAnonKey !== 'your_supabase_anon_key')
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signInAnonymously() {
  // Try to get existing session first
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session.user

  // Sign in anonymously (requires Supabase anonymous auth enabled)
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('Anonymous sign-in failed:', error.message)
    return null
  }
  return data.user
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) { console.error('fetchWatchlist:', error); return [] }
  return (data || []).map(d => ({
    id: d.id, user_id: d.user_id, symbol: d.symbol,
    name: d.name, market: d.market, added_at: d.added_at,
  }))
}

export async function addWatchlistItem(item: WatchlistItem): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('watchlist').upsert({
    id: item.id, user_id: item.user_id, symbol: item.symbol,
    name: item.name, market: item.market,
  }, { onConflict: 'user_id,symbol' })
  if (error) { console.error('addWatchlistItem:', error); return false }
  return true
}

export async function removeWatchlistItem(userId: string, symbol: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('symbol', symbol)
  if (error) { console.error('removeWatchlistItem:', error); return false }
  return true
}

// ─── AI Analyses ──────────────────────────────────────────────────────────────

export async function saveAnalysis(analysis: AIAnalysis, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('ai_analyses').insert({
    id: analysis.id,
    user_id: userId,
    symbol: analysis.symbol,
    name: analysis.name,
    market: analysis.market,
    signal: analysis.signal,
    confidence: analysis.confidence,
    confidence_level: analysis.confidenceLevel,
    price: analysis.price,
    target_price: analysis.targetPrice,
    stop_loss: analysis.stopLoss,
    reasoning: analysis.reasoning,
    technical_summary: analysis.technicalSummary,
    fundamental_summary: analysis.fundamentalSummary,
    indicators: analysis.indicators,
    timeframe: analysis.timeframe,
    created_at: analysis.createdAt,
  })
  if (error) { console.error('saveAnalysis:', error); return false }
  return true
}

export async function fetchAnalyses(userId: string, limit = 100): Promise<AIAnalysis[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('fetchAnalyses:', error); return [] }
  return (data || []).map(d => ({
    id: d.id, symbol: d.symbol, name: d.name, market: d.market,
    signal: d.signal, confidence: d.confidence, confidenceLevel: d.confidence_level,
    price: d.price, targetPrice: d.target_price, stopLoss: d.stop_loss,
    reasoning: d.reasoning, technicalSummary: d.technical_summary,
    fundamentalSummary: d.fundamental_summary, indicators: d.indicators,
    timeframe: d.timeframe, createdAt: d.created_at,
  }))
}

// ─── Evaluation Scores ────────────────────────────────────────────────────────

export async function saveEvaluationScore(score: EvaluationScore, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('evaluation_scores').insert({
    id: score.id,
    analysis_id: score.analysis_id,
    user_id: userId,
    symbol: score.symbol,
    signal: score.signal,
    rsi_score: score.rsiScore,
    macd_score: score.macdScore,
    adx_score: score.adxScore,
    trend_score: score.trendScore,
    momentum_score: score.momentumScore,
    total_score: score.totalScore,
    passed: score.passed,
    sent_to_telegram: score.sentToTelegram,
    created_at: score.createdAt,
  })
  if (error) { console.error('saveEvaluationScore:', error); return false }
  return true
}

// ─── Simulator Trades ─────────────────────────────────────────────────────────

export async function saveSimulatorTrade(trade: SimulatorTrade, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('simulator_trades').upsert({
    id: trade.id,
    user_id: userId,
    symbol: trade.symbol,
    name: trade.name,
    type: trade.type,
    quantity: trade.quantity,
    price: trade.price,
    total: trade.total,
    status: trade.status,
    close_price: trade.closePrice,
    pnl: trade.pnl,
    pnl_percent: trade.pnlPercent,
    closed_at: trade.closedAt,
    analysis_id: trade.analysis_id,
    created_at: trade.createdAt,
  })
  if (error) { console.error('saveSimulatorTrade:', error); return false }
  return true
}

export async function fetchSimulatorTrades(userId: string): Promise<SimulatorTrade[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('simulator_trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchSimulatorTrades:', error); return [] }
  return (data || []).map(d => ({
    id: d.id, user_id: d.user_id, symbol: d.symbol, name: d.name,
    market: (d.market || 'US') as import('../types').MarketType,
    type: d.type, quantity: d.quantity, price: d.price, total: d.total,
    status: d.status, closePrice: d.close_price, pnl: d.pnl,
    pnlPercent: d.pnl_percent, closedAt: d.closed_at,
    analysis_id: d.analysis_id, createdAt: d.created_at,
  }))
}

// ─── Simulator Portfolio ──────────────────────────────────────────────────────

export async function saveSimulatorPortfolio(userId: string, cash: number, totalInvested: number): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('simulator_portfolio').upsert({
    user_id: userId, cash, total_invested: totalInvested,
  }, { onConflict: 'user_id' })
  if (error) { console.error('saveSimulatorPortfolio:', error); return false }
  return true
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function saveUserSettings(settings: UserSettings): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('user_settings').upsert({
    user_id: settings.user_id,
    simulator_balance: settings.simulatorBalance,
    risk_level: settings.riskLevel,
    auto_analysis: settings.autoAnalysis,
    analysis_interval: settings.analysisInterval,
    min_signal_score: settings.minSignalScore,
    max_position_size: settings.maxPositionSize,
    enable_telegram: settings.enableTelegram,
    enable_real_trading: settings.enableRealTrading,
    alpaca_mode: settings.alpacaMode,
    // Do NOT store API keys in Supabase (keep in local state only)
  }, { onConflict: 'user_id' })
  if (error) { console.error('saveUserSettings:', error); return false }
  return true
}

// ─── Real-time subscriptions ─────────────────────────────────────────────────

export function subscribeToAnalyses(userId: string, onNew: (analysis: AIAnalysis) => void) {
  return supabase
    .channel('ai_analyses_changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ai_analyses',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const d = payload.new as Record<string, unknown>
      onNew({
        id: d.id as string, symbol: d.symbol as string, name: d.name as string,
        market: d.market as AIAnalysis['market'], signal: d.signal as AIAnalysis['signal'],
        confidence: d.confidence as number, confidenceLevel: d.confidence_level as AIAnalysis['confidenceLevel'],
        price: d.price as number, targetPrice: d.target_price as number, stopLoss: d.stop_loss as number,
        reasoning: d.reasoning as string, technicalSummary: d.technical_summary as string,
        fundamentalSummary: d.fundamental_summary as string, indicators: d.indicators as AIAnalysis['indicators'],
        timeframe: d.timeframe as string, createdAt: d.created_at as string,
      })
    })
    .subscribe()
}

// ─── Database table names (for reference) ─────────────────────────────────────
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
