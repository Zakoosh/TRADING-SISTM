import OpenAI from 'openai'
import { AIAnalysis, MarketType, SignalType, TechnicalIndicators } from '../types'
import { calculateRSI, calculateMACD, calculateEMA, calculateSMA } from './utils'

function getOpenAIClient(): OpenAI | null {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey || apiKey === 'your_openai_api_key') return null
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
}

// ─── Mock Indicators Generator ────────────────────────────────────────────────

function generateMockIndicators(price: number): TechnicalIndicators {
  const rsi = 25 + Math.random() * 55
  const macd = (Math.random() - 0.5) * 2
  const macdSignal = macd + (Math.random() - 0.5) * 0.4
  const adx = 15 + Math.random() * 55
  const sma20 = price * (0.95 + Math.random() * 0.1)
  const sma50 = price * (0.9 + Math.random() * 0.2)
  const sma200 = price * (0.85 + Math.random() * 0.3)
  const ema20 = price * (0.96 + Math.random() * 0.08)
  const bbMiddle = price * (0.97 + Math.random() * 0.06)
  const bbBand = bbMiddle * 0.02
  return {
    rsi,
    macd,
    macdSignal,
    macdHistogram: macd - macdSignal,
    sma20,
    sma50,
    sma200,
    ema20,
    bollingerUpper: bbMiddle + bbBand,
    bollingerMiddle: bbMiddle,
    bollingerLower: bbMiddle - bbBand,
    adx,
    atr: price * 0.015,
    stochastic: 20 + Math.random() * 60,
    momentum: (Math.random() - 0.5) * 8,
  }
}

// ─── Signal Determination ─────────────────────────────────────────────────────

function determineSignal(
  indicators: TechnicalIndicators,
  price: number
): { signal: SignalType; confidence: number } {
  let buyScore = 0
  let sellScore = 0

  // RSI
  if (indicators.rsi < 30) buyScore += 2
  else if (indicators.rsi < 45) buyScore += 1
  else if (indicators.rsi > 70) sellScore += 2
  else if (indicators.rsi > 55) sellScore += 1

  // MACD crossover
  if (indicators.macd > indicators.macdSignal) {
    buyScore += indicators.macdHistogram > 0 ? 2 : 1
  } else {
    sellScore += indicators.macdHistogram < 0 ? 2 : 1
  }

  // ADX trend strength
  const trendStrong = indicators.adx > 25

  // Price vs moving averages
  if (price > indicators.sma20) buyScore += 1
  if (price > indicators.sma50) buyScore += trendStrong ? 2 : 1
  if (price < indicators.sma20) sellScore += 1
  if (price < indicators.sma50) sellScore += trendStrong ? 2 : 1

  // Bollinger Bands
  if (price < indicators.bollingerLower) buyScore += 2
  else if (price > indicators.bollingerUpper) sellScore += 2

  // Stochastic
  if (indicators.stochastic < 20) buyScore += 1
  else if (indicators.stochastic > 80) sellScore += 1

  const total = buyScore + sellScore
  if (total === 0) return { signal: 'HOLD', confidence: 50 }

  const maxScore = 11 // max possible score for one side
  if (buyScore > sellScore + 2) {
    const confidence = Math.min(95, 50 + (buyScore / maxScore) * 50)
    return { signal: 'BUY', confidence }
  } else if (sellScore > buyScore + 2) {
    const confidence = Math.min(95, 50 + (sellScore / maxScore) * 50)
    return { signal: 'SELL', confidence }
  }
  return { signal: 'HOLD', confidence: 35 + Math.random() * 25 }
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export async function analyzeStockWithAI(
  symbol: string,
  name: string,
  market: MarketType,
  price: number,
  priceHistory: number[] = []
): Promise<AIAnalysis> {
  const openai = getOpenAIClient()

  // Build indicators
  const indicators = generateMockIndicators(price)
  if (priceHistory.length > 14) {
    indicators.rsi = calculateRSI(priceHistory)
    const macdData = calculateMACD(priceHistory)
    indicators.macd = macdData.macd
    indicators.macdSignal = macdData.signal
    indicators.macdHistogram = macdData.histogram
    indicators.sma20 = calculateSMA(priceHistory, 20)
    indicators.sma50 = calculateSMA(priceHistory, 50)
    indicators.ema20 = calculateEMA(priceHistory, 20)
  }

  const { signal, confidence } = determineSignal(indicators, price)

  // Target and stop-loss
  const riskReward = signal === 'BUY' ? 1.06 + Math.random() * 0.08 : 0.93 - Math.random() * 0.05
  const stopRisk   = signal === 'BUY' ? 0.96 - Math.random() * 0.02 : 1.04 + Math.random() * 0.02
  const targetPrice = parseFloat((price * riskReward).toFixed(4))
  const stopLoss    = parseFloat((price * stopRisk).toFixed(4))

  let reasoning = ''
  let technicalSummary = ''
  let fundamentalSummary = ''

  // ── OpenAI Analysis ──────────────────────────────────────────────────────
  if (openai) {
    try {
      const signalAr = signal === 'BUY' ? 'شراء' : signal === 'SELL' ? 'بيع' : 'احتفاظ'
      const prompt = `أنت محلل مالي خبير. حلّل السهم التالي وقدّم توصية موجزة بالعربية:

السهم: ${name} (${symbol}) | السوق: ${market}
السعر: $${price.toFixed(2)} | الإشارة: ${signalAr}

المؤشرات:
- RSI: ${indicators.rsi.toFixed(1)} ${indicators.rsi < 30 ? '(ذروة بيع)' : indicators.rsi > 70 ? '(ذروة شراء)' : '(محايد)'}
- MACD: ${indicators.macd.toFixed(4)} / Signal: ${indicators.macdSignal.toFixed(4)} / Histogram: ${indicators.macdHistogram.toFixed(4)}
- ADX: ${indicators.adx.toFixed(1)} ${indicators.adx > 25 ? '(اتجاه قوي)' : '(اتجاه ضعيف)'}
- SMA20: $${indicators.sma20.toFixed(2)} | SMA50: $${indicators.sma50.toFixed(2)}
- Bollinger: [$${indicators.bollingerLower.toFixed(2)} - $${indicators.bollingerUpper.toFixed(2)}]
- الهدف: $${targetPrice} | وقف الخسارة: $${stopLoss}

أجب بهذا التنسيق الدقيق (3 أسطر فقط):
سبب: [جملتان للتحليل]
فني: [جملة واحدة للملخص الفني]
أساسي: [جملة واحدة للتحليل الأساسي]`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.4,
      })

      const text = response.choices[0]?.message?.content || ''
      const lines = text.split('\n').filter(l => l.trim())

      const reasonLine = lines.find(l => l.startsWith('سبب:'))
      const techLine   = lines.find(l => l.startsWith('فني:'))
      const fundLine   = lines.find(l => l.startsWith('أساسي:'))

      reasoning          = reasonLine?.replace('سبب:', '').trim() || ''
      technicalSummary   = techLine?.replace('فني:', '').trim() || ''
      fundamentalSummary = fundLine?.replace('أساسي:', '').trim() || ''
    } catch (err) {
      console.warn('OpenAI API error, using fallback:', err)
    }
  }

  // ── Fallback reasoning (if OpenAI not configured or failed) ──────────────
  if (!reasoning) {
    const signalAr = signal === 'BUY' ? 'الشراء' : signal === 'SELL' ? 'البيع' : 'الاحتفاظ'
    reasoning = `يُظهر ${name} (${symbol}) إشارة ${signalAr} بناءً على RSI (${indicators.rsi.toFixed(1)}) وتقاطع MACD. `
    reasoning += indicators.adx > 25
      ? `اتجاه السوق قوي (ADX: ${indicators.adx.toFixed(1)}) مما يعزز الإشارة.`
      : `الاتجاه ضعيف (ADX: ${indicators.adx.toFixed(1)})، يُنصح بالحذر وانتظار تأكيد الاتجاه.`
    technicalSummary = `RSI عند ${indicators.rsi.toFixed(1)}, MACD ${indicators.macd > indicators.macdSignal ? 'إيجابي' : 'سلبي'}, السعر ${price > indicators.sma50 ? 'فوق' : 'تحت'} SMA50 ($${indicators.sma50.toFixed(2)}).`
    fundamentalSummary = 'التقييم الأساسي يتوافق مع الاتجاه الفني العام للسوق.'
  }

  const confidenceLevel = confidence >= 78 ? 'HIGH' : confidence >= 58 ? 'MEDIUM' : 'LOW'

  return {
    id: crypto.randomUUID(),
    symbol,
    name,
    market,
    signal,
    confidence,
    confidenceLevel,
    price,
    targetPrice,
    stopLoss,
    reasoning,
    technicalSummary,
    fundamentalSummary,
    indicators,
    timeframe: '1D',
    createdAt: new Date().toISOString(),
  }
}
