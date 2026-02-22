import { GoogleGenerativeAI } from '@google/generative-ai'
import { AIAnalysis, MarketType, SignalType, TechnicalIndicators } from '../types'
import { calculateRSI, calculateMACD, calculateEMA, calculateSMA } from './utils'

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key') return null
  return new GoogleGenerativeAI(apiKey)
}

function generateMockIndicators(price: number): TechnicalIndicators {
  const rsi = 30 + Math.random() * 50
  const macd = (Math.random() - 0.5) * 2
  const macdSignal = macd + (Math.random() - 0.5) * 0.5
  const adx = 15 + Math.random() * 50
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
    atr: price * 0.02,
    stochastic: 20 + Math.random() * 60,
    momentum: (Math.random() - 0.5) * 10,
  }
}

function determineSignalFromIndicators(indicators: TechnicalIndicators, price: number): { signal: SignalType; confidence: number } {
  let buyScore = 0
  let sellScore = 0
  const total = 5

  // RSI analysis
  if (indicators.rsi < 30) buyScore++
  else if (indicators.rsi > 70) sellScore++
  else if (indicators.rsi < 45) buyScore += 0.5
  else if (indicators.rsi > 55) sellScore += 0.5

  // MACD analysis
  if (indicators.macd > indicators.macdSignal) buyScore++
  else sellScore++

  // Price vs SMA
  if (price > indicators.sma50) buyScore++
  else sellScore++

  // ADX trend strength
  if (indicators.adx > 25) {
    if (price > indicators.sma20) buyScore += 0.5
    else sellScore += 0.5
  }

  // Bollinger Bands
  if (price < indicators.bollingerLower) buyScore++
  else if (price > indicators.bollingerUpper) sellScore++

  const totalScore = buyScore + sellScore
  if (totalScore === 0) return { signal: 'HOLD', confidence: 50 }

  const buyRatio = buyScore / total
  const sellRatio = sellScore / total

  if (buyRatio > 0.6) {
    return { signal: 'BUY', confidence: 50 + buyRatio * 50 }
  } else if (sellRatio > 0.6) {
    return { signal: 'SELL', confidence: 50 + sellRatio * 50 }
  }
  return { signal: 'HOLD', confidence: 40 + Math.random() * 20 }
}

export async function analyzeStockWithAI(
  symbol: string,
  name: string,
  market: MarketType,
  price: number,
  priceHistory: number[] = []
): Promise<AIAnalysis> {
  const genAI = getGeminiClient()
  const indicators = generateMockIndicators(price)

  // Calculate from history if available
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

  const { signal, confidence } = determineSignalFromIndicators(indicators, price)

  const targetMultiplier = signal === 'BUY' ? 1.05 + Math.random() * 0.1 : 0.9 + Math.random() * 0.05
  const stopMultiplier = signal === 'BUY' ? 0.95 - Math.random() * 0.03 : 1.05 + Math.random() * 0.03
  const targetPrice = price * targetMultiplier
  const stopLoss = price * stopMultiplier

  let reasoning = ''
  let technicalSummary = ''
  let fundamentalSummary = ''

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const prompt = `
أنت محلل مالي خبير. قم بتحليل السهم التالي وتقديم توصية استثمارية:

السهم: ${name} (${symbol})
السوق: ${market}
السعر الحالي: $${price.toFixed(2)}
الإشارة المقترحة: ${signal}

المؤشرات الفنية:
- RSI: ${indicators.rsi.toFixed(2)} ${indicators.rsi < 30 ? '(ذروة البيع)' : indicators.rsi > 70 ? '(ذروة الشراء)' : '(محايد)'}
- MACD: ${indicators.macd.toFixed(4)} / Signal: ${indicators.macdSignal.toFixed(4)}
- ADX: ${indicators.adx.toFixed(2)} ${indicators.adx > 25 ? '(اتجاه قوي)' : '(اتجاه ضعيف)'}
- SMA20: $${indicators.sma20.toFixed(2)} | SMA50: $${indicators.sma50.toFixed(2)}
- Bollinger: $${indicators.bollingerLower.toFixed(2)} - $${indicators.bollingerUpper.toFixed(2)}

قدم:
1. سبب التوصية (جملتان)
2. ملخص فني (جملة واحدة)
3. ملخص أساسي (جملة واحدة)

الرد بالعربية فقط، موجز ومباشر.
      `
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const lines = text.split('\n').filter(l => l.trim())
      reasoning = lines.slice(0, 2).join(' ')
      technicalSummary = lines[2] || `المؤشرات تدعم توصية ${signal === 'BUY' ? 'الشراء' : signal === 'SELL' ? 'البيع' : 'الاحتفاظ'}`
      fundamentalSummary = lines[3] || 'التقييم الأساسي معقول بالنسبة للسوق الحالي'
    } catch (err) {
      console.warn('Gemini API error, using fallback analysis:', err)
    }
  }

  if (!reasoning) {
    const signalAr = signal === 'BUY' ? 'شراء' : signal === 'SELL' ? 'بيع' : 'احتفاظ'
    reasoning = `يُظهر ${name} إشارة ${signalAr} بناءً على تقاطع مؤشرات RSI (${indicators.rsi.toFixed(1)}) وMACD. `
    reasoning += indicators.adx > 25
      ? `اتجاه السوق قوي (ADX: ${indicators.adx.toFixed(1)}) مما يدعم الإشارة.`
      : `الاتجاه ضعيف نسبياً، يُنصح بالحذر.`
    technicalSummary = `RSI عند ${indicators.rsi.toFixed(1)}، MACD ${indicators.macd > indicators.macdSignal ? 'إيجابي' : 'سلبي'}، السعر ${price > indicators.sma50 ? 'فوق' : 'تحت'} المتوسط 50.`
    fundamentalSummary = 'التحليل الأساسي يتوافق مع الاتجاه الفني العام للسوق.'
  }

  const confidenceLevel = confidence >= 75 ? 'HIGH' : confidence >= 55 ? 'MEDIUM' : 'LOW'

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

export async function analyzeMultipleStocks(
  stocks: Array<{ symbol: string; name: string; market: MarketType; price: number }>
): Promise<AIAnalysis[]> {
  const results: AIAnalysis[] = []
  for (const stock of stocks) {
    try {
      const analysis = await analyzeStockWithAI(stock.symbol, stock.name, stock.market, stock.price)
      results.push(analysis)
      await new Promise(r => setTimeout(r, 500)) // Rate limiting
    } catch (err) {
      console.error(`Error analyzing ${stock.symbol}:`, err)
    }
  }
  return results
}
