#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

async function loadDotEnv() {
  const envPath = path.join(rootDir, '.env')
  try {
    const content = await fs.readFile(envPath, 'utf8')
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx <= 0) continue
      const key = line.slice(0, idx).trim()
      let value = line.slice(idx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // ignore missing .env
  }
}

await loadDotEnv()

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const REQUEST_INTERVAL_MS = Number(process.env.TWELVE_HISTORY_INTERVAL_MS || 9000)
const MAX_REQUESTS_PER_RUN = Number(process.env.TWELVE_HISTORY_MAX_REQUESTS || 25)
const MAX_SYMBOLS_PER_RUN = Number(process.env.TWELVE_HISTORY_MAX_SYMBOLS || 20)
const HISTORY_DAYS = Number(process.env.TWELVE_HISTORY_DAYS || 365)
const START_OFFSET = Number(process.env.TWELVE_HISTORY_OFFSET || 0)

let requestCount = 0
let lastRequestAt = 0

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function assertConfig() {
  if (!TWELVE_DATA_API_KEY || TWELVE_DATA_API_KEY.includes('your_')) {
    throw new Error('Missing TWELVE_DATA_API_KEY (or VITE_TWELVE_DATA_API_KEY).')
  }
  if (!SUPABASE_URL || SUPABASE_URL.includes('your_')) {
    throw new Error('Missing SUPABASE_URL.')
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.includes('your_')) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }
}

function normalizeTvSymbol(symbol) {
  if (symbol.includes('/')) return symbol
  return symbol
}

async function throttledFetchTimeSeries(symbol) {
  if (requestCount >= MAX_REQUESTS_PER_RUN) {
    throw new Error(`Reached request budget: ${MAX_REQUESTS_PER_RUN}`)
  }

  const wait = Math.max(0, lastRequestAt + REQUEST_INTERVAL_MS - Date.now())
  if (wait > 0) await sleep(wait)

  const params = new URLSearchParams({
    symbol: normalizeTvSymbol(symbol),
    interval: '1day',
    outputsize: String(HISTORY_DAYS),
    apikey: TWELVE_DATA_API_KEY,
  })

  requestCount += 1
  lastRequestAt = Date.now()

  const res = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data?.status === 'error') {
    throw new Error(data?.message || 'Twelve Data error')
  }

  return Array.isArray(data?.values) ? data.values : []
}

function buildSnapshots(userId, market, symbol, values) {
  if (!values.length) return []

  const rows = []
  const sorted = [...values]
    .map(v => ({
      fetched_at: new Date(v.datetime).toISOString(),
      close: Number(v.close || 0),
      volume: Number(v.volume || 0),
    }))
    .filter(v => Number.isFinite(v.close) && v.close > 0)
    .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]
    const prev = sorted[i - 1]
    const change = prev ? current.close - prev.close : 0
    const changePercent = prev && prev.close > 0 ? (change / prev.close) * 100 : 0

    rows.push({
      user_id: userId,
      symbol,
      market,
      price: current.close,
      change,
      change_percent: changePercent,
      volume: current.volume,
      fetched_at: current.fetched_at,
    })
  }

  return rows
}

async function main() {
  assertConfig()

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Starting watchlist history sync...')
  console.log(`Days=${HISTORY_DAYS}, MaxRequests=${MAX_REQUESTS_PER_RUN}, MaxSymbols=${MAX_SYMBOLS_PER_RUN}, Offset=${START_OFFSET}`)

  const { data: watchlistRows, error: watchlistError } = await supabase
    .from('watchlist')
    .select('user_id,symbol,market')
    .order('added_at', { ascending: true })

  if (watchlistError) throw new Error(`Failed to fetch watchlist: ${watchlistError.message}`)

  const uniquePairs = Array.from(
    new Map((watchlistRows || []).map(row => [`${row.user_id}:${row.symbol}`, row])).values()
  )

  if (!uniquePairs.length) {
    console.log('No watchlist symbols found. Nothing to sync.')
    return
  }

  const selectedPairs = uniquePairs.slice(START_OFFSET, START_OFFSET + MAX_SYMBOLS_PER_RUN)
  let totalInserted = 0
  let totalProcessed = 0

  for (const pair of selectedPairs) {
    if (requestCount >= MAX_REQUESTS_PER_RUN) break

    const userId = pair.user_id
    const symbol = pair.symbol
    const market = pair.market

    try {
      const values = await throttledFetchTimeSeries(symbol)
      const snapshots = buildSnapshots(userId, market, symbol, values)

      if (snapshots.length === 0) {
        console.log(`- ${symbol}: no values`) 
        continue
      }

      const chunkSize = 500
      for (let i = 0; i < snapshots.length; i += chunkSize) {
        const chunk = snapshots.slice(i, i + chunkSize)
        const { error } = await supabase
          .from('price_history')
          .upsert(chunk, { onConflict: 'user_id,symbol,fetched_at', ignoreDuplicates: true })

        if (error) throw new Error(error.message)
      }

      totalProcessed += 1
      totalInserted += snapshots.length
      console.log(`✓ ${symbol} (${market}) user=${userId.slice(0, 8)}... -> ${snapshots.length} rows`) 
    } catch (err) {
      console.warn(`⚠ ${symbol} (${market}) failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  console.log('\n=== Watchlist History Sync Summary ===')
  console.log(`Pairs total: ${uniquePairs.length}`)
  console.log(`Pairs selected this run: ${selectedPairs.length}`)
  console.log(`Pairs processed: ${totalProcessed}`)
  console.log(`Rows written (attempted upsert): ${totalInserted}`)
  console.log(`API requests used: ${requestCount}/${MAX_REQUESTS_PER_RUN}`)
  console.log(`Next offset suggestion: ${START_OFFSET + selectedPairs.length}`)
}

main().catch(err => {
  console.error(`✗ Sync failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  process.exit(1)
})
