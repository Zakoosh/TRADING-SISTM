import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('ar-SA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(1)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`
  }
  return volume.toString()
}

export function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-500'
  if (value < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case 'BUY': return 'text-green-500'
    case 'SELL': return 'text-red-500'
    default: return 'text-yellow-500'
  }
}

export function getSignalBg(signal: string): string {
  switch (signal) {
    case 'BUY': return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'SELL': return 'bg-red-500/10 text-red-500 border-red-500/20'
    default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-yellow-500'
  return 'text-red-500'
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }

  const avgGain = gains / period
  const avgLoss = losses / period

  if (avgLoss === 0) return 100

  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

export function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macd = ema12 - ema26
  const signal = macd * 0.9 // simplified
  return { macd, signal, histogram: macd - signal }
}

export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0
  const multiplier = 2 / (period + 1)
  let ema = prices[0]
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  return ema
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}
