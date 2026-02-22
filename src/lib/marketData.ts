import { Stock, MarketType, CandleData } from '../types'

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || ''
const TWELVE_DATA_BASE = 'https://api.twelvedata.com'

// Default market stocks
export const DEFAULT_STOCKS: Record<MarketType, Array<{ symbol: string; name: string; currency: string }>> = {
  US: [
    { symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', currency: 'USD' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', currency: 'USD' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', currency: 'USD' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', currency: 'USD' },
    { symbol: 'META', name: 'Meta Platforms', currency: 'USD' },
    { symbol: 'TSLA', name: 'Tesla Inc.', currency: 'USD' },
    { symbol: 'JPM', name: 'JPMorgan Chase', currency: 'USD' },
    { symbol: 'BRK/B', name: 'Berkshire Hathaway', currency: 'USD' },
    { symbol: 'V', name: 'Visa Inc.', currency: 'USD' },
  ],
  TR: [
    { symbol: 'GARAN', name: 'Garanti Bankası', currency: 'TRY' },
    { symbol: 'AKBNK', name: 'Akbank', currency: 'TRY' },
    { symbol: 'THYAO', name: 'Türk Hava Yolları', currency: 'TRY' },
    { symbol: 'EREGL', name: 'Ereğli Demir Çelik', currency: 'TRY' },
    { symbol: 'SISE', name: 'Şişecam', currency: 'TRY' },
    { symbol: 'BIMAS', name: 'BIM Birleşik Mağazalar', currency: 'TRY' },
    { symbol: 'ARCLK', name: 'Arçelik A.Ş.', currency: 'TRY' },
    { symbol: 'KCHOL', name: 'Koç Holding', currency: 'TRY' },
    { symbol: 'TCELL', name: 'Turkcell', currency: 'TRY' },
    { symbol: 'SAHOL', name: 'Sabancı Holding', currency: 'TRY' },
  ],
  CRYPTO: [
    { symbol: 'BTC/USD', name: 'Bitcoin', currency: 'USD' },
    { symbol: 'ETH/USD', name: 'Ethereum', currency: 'USD' },
    { symbol: 'BNB/USD', name: 'BNB', currency: 'USD' },
    { symbol: 'SOL/USD', name: 'Solana', currency: 'USD' },
    { symbol: 'XRP/USD', name: 'XRP', currency: 'USD' },
    { symbol: 'ADA/USD', name: 'Cardano', currency: 'USD' },
    { symbol: 'DOGE/USD', name: 'Dogecoin', currency: 'USD' },
    { symbol: 'AVAX/USD', name: 'Avalanche', currency: 'USD' },
  ],
  COMMODITY: [
    { symbol: 'XAU/USD', name: 'Gold', currency: 'USD' },
    { symbol: 'XAG/USD', name: 'Silver', currency: 'USD' },
    { symbol: 'WTI/USD', name: 'Crude Oil WTI', currency: 'USD' },
    { symbol: 'BRENT/USD', name: 'Brent Oil', currency: 'USD' },
    { symbol: 'XPT/USD', name: 'Platinum', currency: 'USD' },
  ],
  INDEX: [
    { symbol: 'SPX', name: 'S&P 500', currency: 'USD' },
    { symbol: 'DJI', name: 'Dow Jones', currency: 'USD' },
    { symbol: 'IXIC', name: 'NASDAQ', currency: 'USD' },
    { symbol: 'FTSE', name: 'FTSE 100', currency: 'GBP' },
    { symbol: 'DAX', name: 'DAX', currency: 'EUR' },
    { symbol: 'XU100', name: 'BIST 100', currency: 'TRY' },
  ],
}

// Generate mock stock data (used as fallback when no API key)
function generateMockStock(symbol: string, name: string, market: MarketType, currency: string): Stock {
  const basePrice = market === 'CRYPTO'
    ? symbol.startsWith('BTC') ? 95000 + Math.random() * 5000 : Math.random() * 5000
    : market === 'COMMODITY'
    ? symbol.includes('XAU') ? 3000 + Math.random() * 200 : 20 + Math.random() * 80
    : market === 'TR'
    ? 10 + Math.random() * 1000
    : market === 'INDEX'
    ? 5000 + Math.random() * 35000
    : 50 + Math.random() * 450

  const change = (Math.random() - 0.5) * basePrice * 0.05
  const changePercent = (change / basePrice) * 100
  const volume = Math.floor(Math.random() * 50000000) + 1000000

  return {
    symbol,
    name,
    price: parseFloat(basePrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume,
    market,
    currency,
  }
}

export async function fetchStockPrice(symbol: string, market: MarketType): Promise<number> {
  if (!TWELVE_DATA_KEY || TWELVE_DATA_KEY === 'your_twelve_data_api_key') {
    return generateMockStock(symbol, symbol, market, 'USD').price
  }

  try {
    const response = await fetch(
      `${TWELVE_DATA_BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`
    )
    const data = await response.json()
    return parseFloat(data.price) || 0
  } catch {
    return generateMockStock(symbol, symbol, market, 'USD').price
  }
}

export async function fetchMarketData(
  symbols: Array<{ symbol: string; name: string; market: MarketType; currency: string }>
): Promise<Stock[]> {
  if (!TWELVE_DATA_KEY || TWELVE_DATA_KEY === 'your_twelve_data_api_key') {
    return symbols.map(s => generateMockStock(s.symbol, s.name, s.market, s.currency))
  }

  try {
    const symbolList = symbols.map(s => s.symbol).join(',')
    const response = await fetch(
      `${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbolList)}&apikey=${TWELVE_DATA_KEY}`
    )
    const data = await response.json()

    return symbols.map(s => {
      const quote = Array.isArray(data) ? data.find((d: { symbol: string }) => d.symbol === s.symbol) : data
      if (!quote || quote.status === 'error') {
        return generateMockStock(s.symbol, s.name, s.market, s.currency)
      }
      return {
        symbol: s.symbol,
        name: s.name,
        price: parseFloat(quote.close || quote.price || 0),
        change: parseFloat(quote.change || 0),
        changePercent: parseFloat(quote.percent_change || 0),
        volume: parseInt(quote.volume || 0),
        market: s.market,
        currency: s.currency,
      }
    })
  } catch {
    return symbols.map(s => generateMockStock(s.symbol, s.name, s.market, s.currency))
  }
}

export async function fetchCandleData(
  symbol: string,
  interval: string = '1day',
  outputSize: number = 90
): Promise<CandleData[]> {
  if (!TWELVE_DATA_KEY || TWELVE_DATA_KEY === 'your_twelve_data_api_key') {
    return generateMockCandles(outputSize)
  }

  try {
    const response = await fetch(
      `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_KEY}`
    )
    const data = await response.json()

    if (!data.values) return generateMockCandles(outputSize)

    return data.values.map((v: { datetime: string; open: string; high: string; low: string; close: string; volume: string }) => ({
      time: new Date(v.datetime).getTime() / 1000,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume || '0'),
    })).reverse()
  } catch {
    return generateMockCandles(outputSize)
  }
}

function generateMockCandles(count: number): CandleData[] {
  const candles: CandleData[] = []
  let price = 100 + Math.random() * 200
  const now = Date.now() / 1000
  const daySeconds = 86400

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.03
    const open = price
    price = Math.max(1, price + change)
    const high = Math.max(open, price) * (1 + Math.random() * 0.01)
    const low = Math.min(open, price) * (1 - Math.random() * 0.01)
    candles.push({
      time: now - i * daySeconds,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000) + 500000,
    })
  }
  return candles
}

export function getAllDefaultStocks(): Array<{ symbol: string; name: string; market: MarketType; currency: string }> {
  const all: Array<{ symbol: string; name: string; market: MarketType; currency: string }> = []
  for (const [market, stocks] of Object.entries(DEFAULT_STOCKS)) {
    for (const stock of stocks) {
      all.push({ ...stock, market: market as MarketType })
    }
  }
  return all
}
