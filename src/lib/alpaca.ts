import { AlpacaAccount, AlpacaPosition, AlpacaOrder } from '../types'

const ALPACA_BASE_URL = import.meta.env.VITE_ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'
const ALPACA_API_KEY = import.meta.env.VITE_ALPACA_API_KEY || ''
const ALPACA_SECRET_KEY = import.meta.env.VITE_ALPACA_SECRET_KEY || ''

function getHeaders(apiKey?: string, secretKey?: string): HeadersInit {
  return {
    'APCA-API-KEY-ID': apiKey || ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': secretKey || ALPACA_SECRET_KEY,
    'Content-Type': 'application/json',
  }
}

async function alpacaFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<T> {
  const url = `${baseUrl || ALPACA_BASE_URL}/v2${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: getHeaders(apiKey, secretKey),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `Alpaca API error: ${response.status}`)
  }

  return response.json()
}

export async function getAlpacaAccount(
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<AlpacaAccount> {
  return alpacaFetch<AlpacaAccount>('/account', {}, apiKey, secretKey, baseUrl)
}

export async function getAlpacaPositions(
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<AlpacaPosition[]> {
  return alpacaFetch<AlpacaPosition[]>('/positions', {}, apiKey, secretKey, baseUrl)
}

export async function getAlpacaOrders(
  status: string = 'all',
  limit: number = 50,
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<AlpacaOrder[]> {
  return alpacaFetch<AlpacaOrder[]>(
    `/orders?status=${status}&limit=${limit}`,
    {},
    apiKey,
    secretKey,
    baseUrl
  )
}

export async function placeAlpacaOrder(
  symbol: string,
  qty: number,
  side: 'buy' | 'sell',
  type: 'market' | 'limit' = 'market',
  timeInForce: 'day' | 'gtc' = 'day',
  limitPrice?: number,
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<AlpacaOrder> {
  const body: Record<string, string | number> = {
    symbol,
    qty,
    side,
    type,
    time_in_force: timeInForce,
  }

  if (type === 'limit' && limitPrice) {
    body.limit_price = limitPrice
  }

  return alpacaFetch<AlpacaOrder>(
    '/orders',
    { method: 'POST', body: JSON.stringify(body) },
    apiKey,
    secretKey,
    baseUrl
  )
}

export async function cancelAlpacaOrder(
  orderId: string,
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<void> {
  await alpacaFetch(
    `/orders/${orderId}`,
    { method: 'DELETE' },
    apiKey,
    secretKey,
    baseUrl
  )
}

export async function closeAlpacaPosition(
  symbol: string,
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<AlpacaOrder> {
  return alpacaFetch<AlpacaOrder>(
    `/positions/${symbol}`,
    { method: 'DELETE' },
    apiKey,
    secretKey,
    baseUrl
  )
}

export function isAlpacaConfigured(): boolean {
  return !!(ALPACA_API_KEY && ALPACA_SECRET_KEY &&
    ALPACA_API_KEY !== 'your_alpaca_api_key' &&
    ALPACA_SECRET_KEY !== 'your_alpaca_secret_key')
}
