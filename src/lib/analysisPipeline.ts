import { placeAlpacaOrder } from './alpaca'
import { analyzeStockWithAI } from './openai'
import { fetchAllStocks, fetchStocksByMarket, saveAnalysis, saveEvaluationScore, saveRealTrade, saveSimulatorTrade, saveSystemLog } from './supabase'
import { fetchMarketData } from './marketData'
import { AIAnalysis, EvaluationScore, MarketType, RealTrade, SimulatorTrade, UserSettings, WatchlistItem } from '../types'

export type AnalysisScope = 'WATCHLIST' | 'US' | 'TR' | 'GLOBAL'

export interface AnalysisPipelineInput {
  userId: string
  scope: AnalysisScope
  watchlist: WatchlistItem[]
  settings?: UserSettings | null
  simulatorCash: number
  onAnalysis?: (analysis: AIAnalysis) => void
  onEvaluation?: (score: EvaluationScore) => void
  onSimulatorTrade?: (trade: SimulatorTrade, nextCash: number) => void
  onRealTrade?: (trade: RealTrade) => void
  onProgress?: (message: string, progress: number) => void
  existingSimulatorTrades?: SimulatorTrade[]
}

export interface AnalysisPipelineResult {
  analyses: AIAnalysis[]
  scores: EvaluationScore[]
  simulatorTrades: SimulatorTrade[]
  realTrades: RealTrade[]
  nextSimulatorCash: number
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getBaseUrl(mode?: 'PAPER' | 'LIVE') {
  return mode === 'LIVE' ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets'
}

function evaluateAnalysis(analysis: AIAnalysis, minPassScore = 75): EvaluationScore {
  const { indicators, signal } = analysis

  let rsiScore = 0
  if (signal === 'BUY') {
    if (indicators.rsi < 30) rsiScore = 20
    else if (indicators.rsi < 40) rsiScore = 15
    else if (indicators.rsi < 50) rsiScore = 10
    else if (indicators.rsi < 60) rsiScore = 5
  } else if (signal === 'SELL') {
    if (indicators.rsi > 70) rsiScore = 20
    else if (indicators.rsi > 60) rsiScore = 15
    else if (indicators.rsi > 50) rsiScore = 10
    else if (indicators.rsi > 40) rsiScore = 5
  } else {
    rsiScore = indicators.rsi > 40 && indicators.rsi < 60 ? 15 : 5
  }

  let macdScore = 0
  const macdPositive = indicators.macd > indicators.macdSignal
  if (signal === 'BUY' && macdPositive) macdScore = 20
  else if (signal === 'SELL' && !macdPositive) macdScore = 20
  else if (signal === 'HOLD') macdScore = 10
  else macdScore = 5

  if (Math.abs(indicators.macdHistogram) > 0.1) {
    if ((signal === 'BUY' && indicators.macdHistogram > 0) || (signal === 'SELL' && indicators.macdHistogram < 0)) {
      macdScore = Math.min(20, macdScore + 3)
    }
  }

  let adxScore = 0
  if (indicators.adx > 40) adxScore = 20
  else if (indicators.adx > 30) adxScore = 16
  else if (indicators.adx > 25) adxScore = 12
  else if (indicators.adx > 20) adxScore = 8
  else adxScore = 4

  let trendScore = 0
  const priceAboveSMA20 = analysis.price > indicators.sma20
  const priceAboveSMA50 = analysis.price > indicators.sma50
  const priceAboveSMA200 = analysis.price > indicators.sma200

  if (signal === 'BUY') {
    if (priceAboveSMA20) trendScore += 7
    if (priceAboveSMA50) trendScore += 7
    if (priceAboveSMA200) trendScore += 6
  } else if (signal === 'SELL') {
    if (!priceAboveSMA20) trendScore += 7
    if (!priceAboveSMA50) trendScore += 7
    if (!priceAboveSMA200) trendScore += 6
  } else {
    trendScore = 10
  }

  let momentumScore = 0
  const momentum = indicators.momentum || 0
  if (signal === 'BUY' && momentum > 0) momentumScore = Math.min(20, 10 + momentum)
  else if (signal === 'SELL' && momentum < 0) momentumScore = Math.min(20, 10 + Math.abs(momentum))
  else momentumScore = 5

  const confidenceBonus = (analysis.confidence - 50) / 50 * 5
  const totalScore = Math.min(100, Math.max(0, rsiScore + macdScore + adxScore + trendScore + momentumScore + confidenceBonus))

  return {
    id: generateId(),
    analysis_id: analysis.id,
    symbol: analysis.symbol,
    signal: analysis.signal,
    rsiScore,
    macdScore,
    adxScore,
    trendScore,
    momentumScore,
    totalScore,
    passed: totalScore >= minPassScore,
    sentToTelegram: false,
    createdAt: new Date().toISOString(),
  }
}

async function loadTargetSymbols(scope: AnalysisScope, watchlist: WatchlistItem[]) {
  if (scope === 'WATCHLIST') {
    return watchlist.map(item => ({
      symbol: item.symbol,
      name: item.name,
      market: item.market,
      currency: item.market === 'TR' ? 'TRY' : 'USD',
    }))
  }

  if (scope === 'US') {
    const rows = await fetchStocksByMarket('US', 60)
    return rows.map(r => ({ symbol: r.symbol, name: r.name, market: r.market, currency: r.currency }))
  }

  if (scope === 'TR') {
    const rows = await fetchStocksByMarket('TR', 60)
    return rows.map(r => ({ symbol: r.symbol, name: r.name, market: r.market, currency: r.currency }))
  }

  const rows = await fetchAllStocks(120)
  return rows.map(r => ({ symbol: r.symbol, name: r.name, market: r.market, currency: r.currency }))
}

function buildSimulatorTrade(analysis: AIAnalysis, quantity: number, userId: string): SimulatorTrade {
  const total = quantity * analysis.price
  return {
    id: generateId(),
    user_id: userId,
    symbol: analysis.symbol,
    name: analysis.name,
    market: analysis.market,
    type: analysis.signal === 'SELL' ? 'SELL' : 'BUY',
    quantity,
    price: analysis.price,
    total,
    status: 'OPEN',
    analysis_id: analysis.id,
    createdAt: new Date().toISOString(),
  }
}

async function createRealTrade(analysis: AIAnalysis, quantity: number, settings?: UserSettings | null): Promise<RealTrade> {
  const direction = analysis.signal === 'SELL' ? 'sell' : 'buy'
  const realTrade: RealTrade = {
    id: generateId(),
    user_id: settings?.user_id || 'local',
    symbol: analysis.symbol,
    type: analysis.signal === 'SELL' ? 'SELL' : 'BUY',
    quantity,
    price: analysis.price,
    total: quantity * analysis.price,
    status: 'SIMULATED',
    analysis_id: analysis.id,
    createdAt: new Date().toISOString(),
  }

  const hasAlpacaCreds = !!(settings?.alpacaApiKey && settings?.alpacaSecretKey)
  if (!settings?.enableRealTrading || !hasAlpacaCreds) {
    return realTrade
  }

  try {
    const order = await placeAlpacaOrder(
      analysis.symbol,
      quantity,
      direction,
      'market',
      'day',
      undefined,
      settings.alpacaApiKey,
      settings.alpacaSecretKey,
      getBaseUrl(settings.alpacaMode)
    )

    return {
      ...realTrade,
      alpaca_order_id: order.id,
      status: order.status,
      price: order.filled_avg_price ? Number(order.filled_avg_price) : analysis.price,
      total: (order.filled_avg_price ? Number(order.filled_avg_price) : analysis.price) * quantity,
    }
  } catch (error) {
    console.warn('createRealTrade fallback:', error)
    return {
      ...realTrade,
      status: 'FAILED',
    }
  }
}

export async function runAnalysisPipeline(input: AnalysisPipelineInput): Promise<AnalysisPipelineResult> {
  const {
    userId,
    scope,
    watchlist,
    settings,
    onAnalysis,
    onEvaluation,
    onSimulatorTrade,
    onRealTrade,
    onProgress,
  } = input

  const analyses: AIAnalysis[] = []
  const scores: EvaluationScore[] = []
  const simulatorTrades: SimulatorTrade[] = []
  const realTrades: RealTrade[] = []
  const openSymbols = new Set(
    (input.existingSimulatorTrades || [])
      .filter(trade => trade.status === 'OPEN')
      .map(trade => trade.symbol)
  )

  let nextSimulatorCash = input.simulatorCash

  onProgress?.('جاري تجهيز الأسهم للتحليل...', 10)
  const symbols = await loadTargetSymbols(scope, watchlist)
  if (symbols.length === 0) {
    return { analyses, scores, simulatorTrades, realTrades, nextSimulatorCash }
  }

  const dedupedSymbols = Array.from(new Map(symbols.map(s => [s.symbol, s])).values())

  onProgress?.('جاري تحديث الأسعار...', 20)
  const marketData = await fetchMarketData(dedupedSymbols)

  for (let index = 0; index < marketData.length; index += 1) {
    const stock = marketData[index]
    onProgress?.(`تحليل ${stock.symbol}...`, 20 + ((index + 1) / marketData.length) * 75)

    const analysis = await analyzeStockWithAI(stock.symbol, stock.name, stock.market, stock.price)
    analyses.push(analysis)
    onAnalysis?.(analysis)
    await saveAnalysis(analysis, userId)
    await saveSystemLog({
      user_id: userId,
      action_type: 'ANALYSIS_SAVED',
      entity_type: 'AI_ANALYSIS',
      entity_id: analysis.id,
      status: 'SUCCESS',
      payload: { symbol: analysis.symbol, signal: analysis.signal, confidence: analysis.confidence },
    })

    const score = evaluateAnalysis(analysis, settings?.minSignalScore || 75)
    scores.push(score)
    onEvaluation?.(score)
    await saveEvaluationScore(score, userId)
    await saveSystemLog({
      user_id: userId,
      action_type: 'EVALUATION_SAVED',
      entity_type: 'EVALUATION_SCORE',
      entity_id: score.id,
      status: 'SUCCESS',
      payload: { symbol: score.symbol, totalScore: score.totalScore, passed: score.passed },
    })

    if (score.passed && analysis.signal !== 'HOLD') {
      if (openSymbols.has(analysis.symbol)) {
        await saveSystemLog({
          user_id: userId,
          action_type: 'SIMULATOR_TRADE_SKIPPED_DUPLICATE',
          entity_type: 'SIMULATOR_TRADE',
          status: 'INFO',
          payload: { symbol: analysis.symbol },
        })
        continue
      }

      const portfolioPercent = Math.max(1, Number(settings?.maxPositionSize || 10)) / 100
      const budget = Math.max(0, nextSimulatorCash * portfolioPercent)
      const quantity = Math.max(1, Math.floor(budget / analysis.price))

      if (quantity > 0 && nextSimulatorCash >= analysis.price) {
        const simulatorTrade = buildSimulatorTrade(analysis, quantity, userId)
        simulatorTrades.push(simulatorTrade)
        await saveSimulatorTrade(simulatorTrade, userId)
        openSymbols.add(simulatorTrade.symbol)
        await saveSystemLog({
          user_id: userId,
          action_type: 'SIMULATOR_TRADE_AUTO_OPENED',
          entity_type: 'SIMULATOR_TRADE',
          entity_id: simulatorTrade.id,
          status: 'SUCCESS',
          payload: { symbol: simulatorTrade.symbol, quantity: simulatorTrade.quantity, total: simulatorTrade.total },
        })

        if (simulatorTrade.type === 'BUY') nextSimulatorCash -= simulatorTrade.total
        else nextSimulatorCash += simulatorTrade.total

        onSimulatorTrade?.(simulatorTrade, nextSimulatorCash)
      }

      const realTrade = await createRealTrade(analysis, quantity, settings)
      realTrade.user_id = userId
      realTrades.push(realTrade)
      await saveRealTrade(realTrade, userId)
      await saveSystemLog({
        user_id: userId,
        action_type: 'REAL_TRADE_AUTO_SENT',
        entity_type: 'REAL_TRADE',
        entity_id: realTrade.id,
        status: realTrade.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
        payload: { symbol: realTrade.symbol, quantity: realTrade.quantity, status: realTrade.status },
      })
      onRealTrade?.(realTrade)
    }
  }

  onProgress?.('اكتملت دورة التحليل التلقائي', 100)

  return {
    analyses,
    scores,
    simulatorTrades,
    realTrades,
    nextSimulatorCash,
  }
}
