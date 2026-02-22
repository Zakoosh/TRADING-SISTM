import { Stock, MarketType, CandleData } from '../types'

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || ''
const TWELVE_DATA_BASE = 'https://api.twelvedata.com'

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Basic plan: 8 requests/minute, 800 credits/day
// We enforce 8.5-second gaps between requests (≈7 req/min, safe margin)

class RateLimiter {
  private queue: Array<() => Promise<void>> = []
  private processing = false
  private dailyCount = 0
  private dailyLimit = 750   // 800 limit minus 50 buffer
  private dailyReset: number = this.nextMidnight()
  private lastRequestTime = 0
  private readonly interval = 8500 // ms between requests

  private nextMidnight(): number {
    const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime()
  }

  private resetIfNewDay() {
    if (Date.now() > this.dailyReset) {
      this.dailyCount = 0
      this.dailyReset = this.nextMidnight()
    }
  }

  isOverDailyLimit(): boolean {
    this.resetIfNewDay()
    return this.dailyCount >= this.dailyLimit
  }

  getRemainingCredits(): number {
    this.resetIfNewDay()
    return Math.max(0, this.dailyLimit - this.dailyCount)
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const wait = Math.max(0, this.lastRequestTime + this.interval - Date.now())
          if (wait > 0) await new Promise(r => setTimeout(r, wait))
          this.lastRequestTime = Date.now()
          this.dailyCount++
          resolve(await fn())
        } catch (err) { reject(err) }
      })
      if (!this.processing) this.processQueue()
    })
  }

  private async processQueue() {
    this.processing = true
    while (this.queue.length > 0) await this.queue.shift()!()
    this.processing = false
  }
}

const rateLimiter = new RateLimiter()

// ─── Cache (5-minute TTL) ─────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; expiresAt: number }
const priceCache = new Map<string, CacheEntry<number>>()
const quoteCache = new Map<string, CacheEntry<Stock>>()
const TTL = 5 * 60 * 1000

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const e = map.get(key)
  if (e && Date.now() < e.expiresAt) return e.data
  map.delete(key); return null
}
function setCache<T>(map: Map<string, CacheEntry<T>>, key: string, data: T) {
  map.set(key, { data, expiresAt: Date.now() + TTL })
}

// ─── Default Market Symbols ───────────────────────────────────────────────────

export const DEFAULT_STOCKS: Record<MarketType, Array<{ symbol: string; name: string; currency: string }>> = {
  US: [
    { symbol: 'AAPL',  name: 'Apple Inc.',         currency: 'USD' },
    { symbol: 'MSFT',  name: 'Microsoft Corp.',     currency: 'USD' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.',       currency: 'USD' },
    { symbol: 'AMZN',  name: 'Amazon.com Inc.',     currency: 'USD' },
    { symbol: 'NVDA',  name: 'NVIDIA Corp.',        currency: 'USD' },
    { symbol: 'META',  name: 'Meta Platforms',      currency: 'USD' },
    { symbol: 'TSLA',  name: 'Tesla Inc.',          currency: 'USD' },
    { symbol: 'JPM',   name: 'JPMorgan Chase',      currency: 'USD' },
    { symbol: 'V',     name: 'Visa Inc.',           currency: 'USD' },
    { symbol: 'WMT',   name: 'Walmart Inc.',        currency: 'USD' },
  ],
  TR: [
    { symbol: 'GARAN.IS', name: 'Garanti Bankası',        currency: 'TRY' },
    { symbol: 'AKBNK.IS', name: 'Akbank',                 currency: 'TRY' },
    { symbol: 'THYAO.IS', name: 'Türk Hava Yolları',      currency: 'TRY' },
    { symbol: 'EREGL.IS', name: 'Ereğli Demir Çelik',     currency: 'TRY' },
    { symbol: 'SISE.IS',  name: 'Şişecam',                currency: 'TRY' },
    { symbol: 'BIMAS.IS', name: 'BIM Birleşik Mağazalar', currency: 'TRY' },
    { symbol: 'ARCLK.IS', name: 'Arçelik A.Ş.',           currency: 'TRY' },
    { symbol: 'KCHOL.IS', name: 'Koç Holding',            currency: 'TRY' },
    { symbol: 'TCELL.IS', name: 'Turkcell',               currency: 'TRY' },
    { symbol: 'SAHOL.IS', name: 'Sabancı Holding',        currency: 'TRY' },
  ],
  CRYPTO: [
    { symbol: 'BTC/USD',  name: 'Bitcoin',   currency: 'USD' },
    { symbol: 'ETH/USD',  name: 'Ethereum',  currency: 'USD' },
    { symbol: 'BNB/USD',  name: 'BNB',       currency: 'USD' },
    { symbol: 'SOL/USD',  name: 'Solana',    currency: 'USD' },
    { symbol: 'XRP/USD',  name: 'XRP',       currency: 'USD' },
    { symbol: 'ADA/USD',  name: 'Cardano',   currency: 'USD' },
    { symbol: 'DOGE/USD', name: 'Dogecoin',  currency: 'USD' },
    { symbol: 'AVAX/USD', name: 'Avalanche', currency: 'USD' },
  ],
  COMMODITY: [
    { symbol: 'XAU/USD', name: 'Gold',          currency: 'USD' },
    { symbol: 'XAG/USD', name: 'Silver',        currency: 'USD' },
    { symbol: 'WTI/USD', name: 'Crude Oil WTI', currency: 'USD' },
    { symbol: 'BRENT',   name: 'Brent Oil',     currency: 'USD' },
    { symbol: 'XPT/USD', name: 'Platinum',      currency: 'USD' },
  ],
  INDEX: [
    { symbol: 'SPX',   name: 'S&P 500',   currency: 'USD' },
    { symbol: 'DJI',   name: 'Dow Jones', currency: 'USD' },
    { symbol: 'IXIC',  name: 'NASDAQ',    currency: 'USD' },
    { symbol: 'FTSE',  name: 'FTSE 100',  currency: 'GBP' },
    { symbol: 'DAX',   name: 'DAX',       currency: 'EUR' },
    { symbol: 'XU100', name: 'BIST 100',  currency: 'TRY' },
  ],
}

// ─── Mock Generator (deterministic, no randomness per session) ────────────────

function mockPrice(symbol: string, market: MarketType): number {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const r = ((seed * 9301 + 49297) % 233280) / 233280
  if (symbol.startsWith('BTC')) return 92000 + r * 8000
  if (market === 'CRYPTO') return 0.5 + r * 4000
  if (symbol.includes('XAU')) return 2900 + r * 300
  if (market === 'COMMODITY') return 15 + r * 90
  if (market === 'TR') return 8 + r * 600
  if (market === 'INDEX') return 5000 + r * 35000
  return 30 + r * 500
}

function generateMockStock(symbol: string, name: string, market: MarketType, currency: string): Stock {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const r = ((seed * 9301 + 49297) % 233280) / 233280
  const base = mockPrice(symbol, market)
  const changePct = (r - 0.5) * 6
  const change = base * (changePct / 100)
  return {
    symbol, name, market, currency,
    price: parseFloat(base.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePct.toFixed(2)),
    volume: Math.floor(1000000 + r * 50000000),
  }
}

function isConfigured(): boolean {
  return !!(TWELVE_DATA_KEY && TWELVE_DATA_KEY !== 'your_twelve_data_api_key')
}

// ─── Fetch single price ───────────────────────────────────────────────────────

export async function fetchStockPrice(symbol: string, market: MarketType): Promise<number> {
  const cached = getCached(priceCache, symbol)
  if (cached !== null) return cached

  if (!isConfigured() || rateLimiter.isOverDailyLimit()) {
    return mockPrice(symbol, market)
  }

  return rateLimiter.throttle(async () => {
    try {
      const res = await fetch(
        `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`
      )
      const data = await res.json()
      if (data.status === 'error' || !data.price) return mockPrice(symbol, market)
      const price = parseFloat(data.price)
      setCache(priceCache, symbol, price)
      return price
    } catch { return mockPrice(symbol, market) }
  })
}

// ─── Fetch market data (batched, credit-efficient) ────────────────────────────
// Each API call: 1 credit per symbol in the batch
// Strategy: batch up to 8 symbols per request, cache aggressively

export async function fetchMarketData(
  symbols: Array<{ symbol: string; name: string; market: MarketType; currency: string }>
): Promise<Stock[]> {
  if (symbols.length === 0) return []

  // Serve from cache what we can
  const cached: Stock[] = []
  const needed: typeof symbols = []
  for (const s of symbols) {
    const c = getCached(quoteCache, s.symbol)
    if (c) cached.push(c)
    else needed.push(s)
  }

  if (needed.length === 0 || !isConfigured() || rateLimiter.isOverDailyLimit()) {
    const fallback = needed.map(s => generateMockStock(s.symbol, s.name, s.market, s.currency))
    const all = [...cached, ...fallback]
    return symbols.map(s => all.find(r => r.symbol === s.symbol) || generateMockStock(s.symbol, s.name, s.market, s.currency))
  }

  // Batch: max 8 per request
  const BATCH = 8
  const fetched: Stock[] = []

  for (let i = 0; i < needed.length; i += BATCH) {
    if (rateLimiter.isOverDailyLimit()) {
      needed.slice(i).forEach(s => fetched.push(generateMockStock(s.symbol, s.name, s.market, s.currency)))
      break
    }
    const batch = needed.slice(i, i + BATCH)
    const symbolList = batch.map(s => s.symbol).join(',')

    const stocks = await rateLimiter.throttle(async () => {
      try {
        const res = await fetch(
          `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${TWELVE_DATA_KEY}`
        )
        const data = await res.json()

        return batch.map(s => {
          const q = batch.length === 1 ? data : (data[s.symbol] || {})
          if (!q || q.status === 'error' || q.code) {
            return generateMockStock(s.symbol, s.name, s.market, s.currency)
          }
          const stock: Stock = {
            symbol: s.symbol, name: s.name, market: s.market, currency: s.currency,
            price:         parseFloat(q.close || q.price || '0') || mockPrice(s.symbol, s.market),
            change:        parseFloat(q.change || '0'),
            changePercent: parseFloat(q.percent_change || '0'),
            volume:        parseInt(q.volume || '0', 10),
          }
          setCache(quoteCache, s.symbol, stock)
          return stock
        })
      } catch {
        return batch.map(s => generateMockStock(s.symbol, s.name, s.market, s.currency))
      }
    })
    fetched.push(...stocks)
  }

  const all = [...cached, ...fetched]
  return symbols.map(s => all.find(r => r.symbol === s.symbol) || generateMockStock(s.symbol, s.name, s.market, s.currency))
}

// ─── Candle / Time Series data ────────────────────────────────────────────────

export async function fetchCandleData(
  symbol: string,
  interval = '1day',
  outputSize = 90
): Promise<CandleData[]> {
  if (!isConfigured() || rateLimiter.isOverDailyLimit()) return generateMockCandles(outputSize)

  return rateLimiter.throttle(async () => {
    try {
      const res = await fetch(
        `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_KEY}`
      )
      const data = await res.json()
      if (!data.values || data.status === 'error') return generateMockCandles(outputSize)

      return (data.values as Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>)
        .map(v => ({
          time:   new Date(v.datetime).getTime() / 1000,
          open:   parseFloat(v.open),
          high:   parseFloat(v.high),
          low:    parseFloat(v.low),
          close:  parseFloat(v.close),
          volume: parseInt(v.volume || '0', 10),
        }))
        .reverse()
    } catch { return generateMockCandles(outputSize) }
  })
}

function generateMockCandles(count: number): CandleData[] {
  let price = 100 + Math.random() * 200
  const now = Math.floor(Date.now() / 1000)
  return Array.from({ length: count + 1 }, (_, idx) => {
    const change = (Math.random() - 0.47) * price * 0.025
    const open = price; price = Math.max(1, price + change)
    return {
      time:   now - (count - idx) * 86400,
      open:   parseFloat(open.toFixed(2)),
      high:   parseFloat((Math.max(open, price) * 1.008).toFixed(2)),
      low:    parseFloat((Math.min(open, price) * 0.992).toFixed(2)),
      close:  parseFloat(price.toFixed(2)),
      volume: Math.floor(500000 + Math.random() * 9500000),
    }
  })
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getAllDefaultStocks() {
  return Object.entries(DEFAULT_STOCKS).flatMap(([market, stocks]) =>
    stocks.map(s => ({ ...s, market: market as MarketType }))
  )
}

export function getRemainingCredits(): number {
  return rateLimiter.getRemainingCredits()
}

export function isTwelveDataConfigured(): boolean {
  return isConfigured()
}
