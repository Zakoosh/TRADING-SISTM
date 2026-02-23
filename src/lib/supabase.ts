import { createClient } from '@supabase/supabase-js'
import { AIAnalysis, EvaluationScore, RealTrade, SimulatorTrade, WatchlistItem, UserSettings, MarketType } from '../types'

export interface PriceSnapshot {
  id?: string
  user_id: string
  symbol: string
  market: MarketType
  price: number
  change: number
  changePercent: number
  volume: number
  fetchedAt: string
}

export interface ChartAnnotation {
  user_id: string
  symbol: string
  showSma20: boolean
  showSma50: boolean
  showTrend: boolean
  trendStart?: number
  trendEnd?: number
}

export interface AutomationRun {
  id?: string
  user_id: string
  run_type: 'AUTO_ANALYSIS' | 'AUTO_EVALUATION' | 'AUTO_SIMULATION' | 'AUTO_REAL_TRADING'
  scope?: string
  status: 'STARTED' | 'SUCCESS' | 'FAILED'
  analyses_count?: number
  evaluations_count?: number
  simulator_count?: number
  real_trades_count?: number
  error_message?: string
  started_at?: string
  finished_at?: string
}

export interface SystemLog {
  id?: string
  user_id: string
  action_type: string
  entity_type?: string
  entity_id?: string
  status?: 'INFO' | 'SUCCESS' | 'FAILED'
  payload?: Record<string, unknown>
  created_at?: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_supabase_url' &&
  supabaseAnonKey !== 'your_supabase_anon_key'
)

const fallbackSupabaseUrl = 'https://placeholder.supabase.co'
const fallbackSupabaseAnonKey = 'placeholder-anon-key'

export const supabase = createClient(
  supabaseConfigured ? supabaseUrl : fallbackSupabaseUrl,
  supabaseConfigured ? supabaseAnonKey : fallbackSupabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

export function isSupabaseConfigured(): boolean {
  return supabaseConfigured
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

export async function signInWithGoogle() {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ─── Stocks ───────────────────────────────────────────────────────────────────

export interface StockData {
  id: string;
  symbol: string;
  name: string;
  market: MarketType;
  currency: string;
  is_active: boolean;
}

export async function fetchAllStocks(limit = 100): Promise<StockData[]> {
  if (!isSupabaseConfigured()) return []
  let queryBuilder = supabase
    .from('stocks')
    .select('*')
    .eq('is_active', true)
    .order('symbol', { ascending: true })

  if (limit > 0) {
    queryBuilder = queryBuilder.limit(limit)
  }

  const { data, error } = await queryBuilder
  if (error) { console.error('fetchAllStocks:', error); return [] }
  return (data || []).map(d => ({
    id: d.id,
    symbol: d.symbol,
    name: d.name,
    market: d.market as MarketType,
    currency: d.currency,
    is_active: d.is_active,
  }))
}

export async function fetchStocksByMarket(market: MarketType, limit = 100): Promise<StockData[]> {
  if (!isSupabaseConfigured()) return []
  let queryBuilder = supabase
    .from('stocks')
    .select('*')
    .eq('market', market)
    .eq('is_active', true)
    .order('symbol', { ascending: true })

  if (limit > 0) {
    queryBuilder = queryBuilder.limit(limit)
  }

  const { data, error } = await queryBuilder
  if (error) { console.error('fetchStocksByMarket:', error); return [] }
  return (data || []).map(d => ({
    id: d.id,
    symbol: d.symbol,
    name: d.name,
    market: d.market as MarketType,
    currency: d.currency,
    is_active: d.is_active,
  }))
}

export async function searchStocks(query: string, market?: MarketType, limit = 100): Promise<StockData[]> {
  if (!isSupabaseConfigured()) return []
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  let queryBuilder = supabase
    .from('stocks')
    .select('*')
    .eq('is_active', true)
  
  if (market) {
    queryBuilder = queryBuilder.eq('market', market)
  }
  
  queryBuilder = queryBuilder.ilike('symbol', `%${normalizedQuery}%`)
  queryBuilder = queryBuilder.order('symbol', { ascending: true })

  if (limit > 0) {
    queryBuilder = queryBuilder.limit(limit)
  }
  
  const { data, error } = await queryBuilder
  if (error) { console.error('searchStocks:', error); return [] }
  return (data || []).map(d => ({
    id: d.id,
    symbol: d.symbol,
    name: d.name,
    market: d.market as MarketType,
    currency: d.currency,
    is_active: d.is_active,
  }))
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

export async function fetchLatestAnalysesBySymbols(userId: string, symbols: string[]): Promise<Record<string, AIAnalysis>> {
  if (!isSupabaseConfigured() || symbols.length === 0) return {}
  const { data, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('user_id', userId)
    .in('symbol', symbols)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('fetchLatestAnalysesBySymbols:', error)
    return {}
  }

  const latest: Record<string, AIAnalysis> = {}
  for (const d of data || []) {
    const symbol = d.symbol as string
    if (latest[symbol]) continue
    latest[symbol] = {
      id: d.id,
      symbol: d.symbol,
      name: d.name,
      market: d.market,
      signal: d.signal,
      confidence: Number(d.confidence || 0),
      confidenceLevel: d.confidence_level,
      price: Number(d.price || 0),
      targetPrice: Number(d.target_price || 0),
      stopLoss: Number(d.stop_loss || 0),
      reasoning: d.reasoning || '',
      technicalSummary: d.technical_summary || '',
      fundamentalSummary: d.fundamental_summary || '',
      indicators: d.indicators,
      timeframe: d.timeframe || '1D',
      createdAt: d.created_at,
    }
  }
  return latest
}

// ─── Evaluation Scores ────────────────────────────────────────────────────────

export async function saveEvaluationScore(score: EvaluationScore, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('evaluation_scores').upsert({
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
  }, { onConflict: 'id' })
  if (error) { console.error('saveEvaluationScore:', error); return false }
  return true
}

export async function fetchEvaluationScores(userId: string): Promise<EvaluationScore[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('evaluation_scores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchEvaluationScores:', error); return [] }
  return (data || []).map(d => ({
    id: d.id,
    analysis_id: d.analysis_id,
    symbol: d.symbol,
    signal: d.signal,
    rsiScore: Number(d.rsi_score || 0),
    macdScore: Number(d.macd_score || 0),
    adxScore: Number(d.adx_score || 0),
    trendScore: Number(d.trend_score || 0),
    momentumScore: Number(d.momentum_score || 0),
    totalScore: Number(d.total_score || 0),
    passed: !!d.passed,
    sentToTelegram: !!d.sent_to_telegram,
    createdAt: d.created_at,
  }))
}

export async function updateEvaluationSent(scoreId: string, sentToTelegram: boolean): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from('evaluation_scores')
    .update({ sent_to_telegram: sentToTelegram })
    .eq('id', scoreId)
  if (error) { console.error('updateEvaluationSent:', error); return false }
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

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchUserSettings:', error)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    user_id: data.user_id,
    simulatorBalance: Number(data.simulator_balance || 100000),
    riskLevel: data.risk_level,
    autoAnalysis: !!data.auto_analysis,
    analysisInterval: Number(data.analysis_interval || 60),
    minSignalScore: Number(data.min_signal_score || 75),
    maxPositionSize: Number(data.max_position_size || 10),
    enableTelegram: !!data.enable_telegram,
    enableRealTrading: !!data.enable_real_trading,
    alpacaMode: data.alpaca_mode || 'PAPER',
  }
}

// ─── Real Trades ─────────────────────────────────────────────────────────────

export async function saveRealTrade(trade: RealTrade, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from('real_trades').upsert({
    id: trade.id,
    user_id: userId,
    alpaca_order_id: trade.alpaca_order_id,
    symbol: trade.symbol,
    type: trade.type,
    quantity: trade.quantity,
    price: trade.price,
    total: trade.total,
    status: trade.status,
    analysis_id: trade.analysis_id,
    created_at: trade.createdAt,
  }, { onConflict: 'id' })
  if (error) { console.error('saveRealTrade:', error); return false }
  return true
}

export async function fetchRealTrades(userId: string, limit = 200): Promise<RealTrade[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('real_trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('fetchRealTrades:', error); return [] }
  return (data || []).map(d => ({
    id: d.id,
    user_id: d.user_id,
    alpaca_order_id: d.alpaca_order_id || undefined,
    symbol: d.symbol,
    type: d.type,
    quantity: Number(d.quantity || 0),
    price: d.price !== null ? Number(d.price) : undefined,
    total: d.total !== null ? Number(d.total) : undefined,
    status: d.status,
    analysis_id: d.analysis_id || undefined,
    createdAt: d.created_at,
  }))
}

// ─── Price History ───────────────────────────────────────────────────────────

export async function savePriceSnapshots(snapshots: PriceSnapshot[]): Promise<boolean> {
  if (!isSupabaseConfigured() || snapshots.length === 0) return false
  const payload = snapshots.map(s => ({
    user_id: s.user_id,
    symbol: s.symbol,
    market: s.market,
    price: s.price,
    change: s.change,
    change_percent: s.changePercent,
    volume: s.volume,
    fetched_at: s.fetchedAt,
  }))

  const { error } = await supabase.from('price_history').insert(payload)
  if (error) {
    console.error('savePriceSnapshots:', error)
    return false
  }
  return true
}

export async function fetchPriceHistory(userId: string, symbol: string, limit = 300): Promise<PriceSnapshot[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .order('fetched_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('fetchPriceHistory:', error)
    return []
  }

  return (data || []).map(d => ({
    id: d.id,
    user_id: d.user_id,
    symbol: d.symbol,
    market: d.market,
    price: Number(d.price || 0),
    change: Number(d.change || 0),
    changePercent: Number(d.change_percent || 0),
    volume: Number(d.volume || 0),
    fetchedAt: d.fetched_at,
  }))
}

export async function fetchLatestPriceSnapshots(userId: string, symbols: string[]): Promise<Record<string, PriceSnapshot>> {
  if (!isSupabaseConfigured() || symbols.length === 0) return {}
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('user_id', userId)
    .in('symbol', symbols)
    .order('fetched_at', { ascending: false })

  if (error) {
    console.error('fetchLatestPriceSnapshots:', error)
    return {}
  }

  const latest: Record<string, PriceSnapshot> = {}
  for (const row of data || []) {
    const symbol = row.symbol as string
    if (latest[symbol]) continue
    latest[symbol] = {
      id: row.id,
      user_id: row.user_id,
      symbol: row.symbol,
      market: row.market,
      price: Number(row.price || 0),
      change: Number(row.change || 0),
      changePercent: Number(row.change_percent || 0),
      volume: Number(row.volume || 0),
      fetchedAt: row.fetched_at,
    }
  }
  return latest
}

export async function fetchChartAnnotation(userId: string, symbol: string): Promise<ChartAnnotation | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('chart_annotations')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .maybeSingle()

  if (error) {
    console.error('fetchChartAnnotation:', error)
    return null
  }
  if (!data) return null

  return {
    user_id: data.user_id,
    symbol: data.symbol,
    showSma20: !!data.show_sma20,
    showSma50: !!data.show_sma50,
    showTrend: !!data.show_trend,
    trendStart: data.trend_start !== null ? Number(data.trend_start) : undefined,
    trendEnd: data.trend_end !== null ? Number(data.trend_end) : undefined,
  }
}

export async function saveChartAnnotation(annotation: ChartAnnotation): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from('chart_annotations')
    .upsert({
      user_id: annotation.user_id,
      symbol: annotation.symbol,
      show_sma20: annotation.showSma20,
      show_sma50: annotation.showSma50,
      show_trend: annotation.showTrend,
      trend_start: annotation.trendStart,
      trend_end: annotation.trendEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,symbol' })

  if (error) {
    console.error('saveChartAnnotation:', error)
    return false
  }
  return true
}

// ─── Automation Runs ────────────────────────────────────────────────────────

export async function saveAutomationRun(run: AutomationRun): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from('automation_runs')
    .insert({
      user_id: run.user_id,
      run_type: run.run_type,
      scope: run.scope,
      status: run.status,
      analyses_count: run.analyses_count || 0,
      evaluations_count: run.evaluations_count || 0,
      simulator_count: run.simulator_count || 0,
      real_trades_count: run.real_trades_count || 0,
      error_message: run.error_message,
      started_at: run.started_at || new Date().toISOString(),
      finished_at: run.finished_at,
    })

  if (error) {
    console.error('saveAutomationRun:', error)
    return false
  }
  return true
}

export async function fetchLatestAutomationRun(userId: string): Promise<AutomationRun | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('fetchLatestAutomationRun:', error)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    user_id: data.user_id,
    run_type: data.run_type,
    scope: data.scope,
    status: data.status,
    analyses_count: Number(data.analyses_count || 0),
    evaluations_count: Number(data.evaluations_count || 0),
    simulator_count: Number(data.simulator_count || 0),
    real_trades_count: Number(data.real_trades_count || 0),
    error_message: data.error_message || undefined,
    started_at: data.started_at,
    finished_at: data.finished_at || undefined,
  }
}

export async function fetchAutomationRuns(userId: string, limit = 20): Promise<AutomationRun[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchAutomationRuns:', error)
    return []
  }

  return (data || []).map(item => ({
    id: item.id,
    user_id: item.user_id,
    run_type: item.run_type,
    scope: item.scope || undefined,
    status: item.status,
    analyses_count: Number(item.analyses_count || 0),
    evaluations_count: Number(item.evaluations_count || 0),
    simulator_count: Number(item.simulator_count || 0),
    real_trades_count: Number(item.real_trades_count || 0),
    error_message: item.error_message || undefined,
    started_at: item.started_at,
    finished_at: item.finished_at || undefined,
  }))
}

export async function saveSystemLog(log: SystemLog): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('system_logs')
    .insert({
      user_id: log.user_id,
      action_type: log.action_type,
      entity_type: log.entity_type || null,
      entity_id: log.entity_id || null,
      status: log.status || 'INFO',
      payload: log.payload || null,
      created_at: log.created_at || new Date().toISOString(),
    })

  if (error) {
    console.error('saveSystemLog:', error)
    return false
  }

  return true
}

export async function fetchSystemLogs(userId: string, limit = 100): Promise<SystemLog[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from('system_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchSystemLogs:', error)
    return []
  }

  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    action_type: row.action_type,
    entity_type: row.entity_type || undefined,
    entity_id: row.entity_id || undefined,
    status: row.status || 'INFO',
    payload: (row.payload || undefined) as Record<string, unknown> | undefined,
    created_at: row.created_at,
  }))
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
  STOCKS: 'stocks',
  WATCHLIST: 'watchlist',
  AI_ANALYSES: 'ai_analyses',
  EVALUATION_SCORES: 'evaluation_scores',
  SIMULATOR_TRADES: 'simulator_trades',
  SIMULATOR_PORTFOLIO: 'simulator_portfolio',
  REAL_TRADES: 'real_trades',
  REPORTS: 'reports',
  USER_SETTINGS: 'user_settings',
  SIGNALS_HISTORY: 'signals_history',
  PRICE_HISTORY: 'price_history',
  CHART_ANNOTATIONS: 'chart_annotations',
  AUTOMATION_RUNS: 'automation_runs',
  SYSTEM_LOGS: 'system_logs',
} as const
