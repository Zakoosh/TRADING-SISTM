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
    const lines = content.split(/\r?\n/)

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const idx = line.indexOf('=')
      if (idx <= 0) continue

      const key = line.slice(0, idx).trim()
      let value = line.slice(idx + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  } catch {
    // Ignore if .env does not exist
  }
}

await loadDotEnv()

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_API_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const REQUEST_INTERVAL_MS = Number(process.env.TWELVE_SYNC_INTERVAL_MS || 8500)
const MAX_REQUESTS_PER_RUN = Number(process.env.TWELVE_SYNC_MAX_REQUESTS || 20)

const MAX_BY_MARKET = {
  US: Number(process.env.TWELVE_SYNC_MAX_US || 400),
  TR: Number(process.env.TWELVE_SYNC_MAX_TR || 250),
  CRYPTO: Number(process.env.TWELVE_SYNC_MAX_CRYPTO || 300),
  COMMODITY: Number(process.env.TWELVE_SYNC_MAX_COMMODITY || 80),
  INDEX: Number(process.env.TWELVE_SYNC_MAX_INDEX || 120),
}

let requestsCount = 0
let lastRequestAt = 0

function requireApiKey() {
  if (!TWELVE_DATA_API_KEY || TWELVE_DATA_API_KEY === 'your_twelve_data_api_key') {
    throw new Error('Missing TWELVE_DATA_API_KEY (or VITE_TWELVE_DATA_API_KEY).')
  }
}

function isPlaceholder(value) {
  return !value || value.includes('your_')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.trim()
}

function toArrayPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.values)) return payload.values
  if (Array.isArray(payload?.result)) return payload.result
  return []
}

function normalizeMarketCurrency(market, row) {
  if (market === 'TR') return 'TRY'
  if (market === 'US') return cleanText(row.currency, 'USD') || 'USD'
  if (market === 'CRYPTO') return cleanText(row.currency_quote, cleanText(row.currency_base, 'USD')) || 'USD'
  if (market === 'INDEX') return cleanText(row.currency, 'USD') || 'USD'
  if (market === 'COMMODITY') return cleanText(row.currency, 'USD') || 'USD'
  return 'USD'
}

function normalizeSymbol(row, market) {
  const base = cleanText(row.symbol)
  if (!base) return ''

  if (market === 'CRYPTO') {
    const withSlash = base.includes('/') ? base : `${base}/USD`
    return withSlash.toUpperCase()
  }

  return base.toUpperCase()
}

function normalizeName(row) {
  return cleanText(
    row.instrument_name ||
      row.name ||
      row.display_symbol ||
      row.currency_base ||
      row.symbol,
    'Unknown'
  )
}

function normalizeRows(rows, market) {
  const out = []
  for (const row of rows) {
    const symbol = normalizeSymbol(row, market)
    if (!symbol) continue

    if (market === 'US' || market === 'TR') {
      const type = cleanText(row.instrument_type || row.type).toLowerCase()
      if (type && !type.includes('stock') && !type.includes('equity') && !type.includes('common')) {
        continue
      }
    }

    out.push({
      symbol,
      name: normalizeName(row),
      market,
      currency: normalizeMarketCurrency(market, row),
      is_active: true,
    })
  }
  return out
}

async function throttledFetch(endpoint, params = {}) {
  if (requestsCount >= MAX_REQUESTS_PER_RUN) {
    throw new Error(`Reached request budget (${MAX_REQUESTS_PER_RUN}) for this run.`)
  }

  const now = Date.now()
  const wait = Math.max(0, lastRequestAt + REQUEST_INTERVAL_MS - now)
  if (wait > 0) await sleep(wait)

  const query = new URLSearchParams({ ...params, apikey: TWELVE_DATA_API_KEY })
  const url = `https://api.twelvedata.com/${endpoint}?${query.toString()}`

  requestsCount += 1
  lastRequestAt = Date.now()

  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} on ${endpoint}`)

  const data = await response.json()
  if (data?.status === 'error') {
    throw new Error(`TwelveData error on ${endpoint}: ${data?.message || 'unknown error'}`)
  }

  return data
}

async function fetchByCategory() {
  const collected = {
    US: [],
    TR: [],
    CRYPTO: [],
    COMMODITY: [],
    INDEX: [],
  }

  const tasks = [
    { endpoint: 'stocks', params: { country: 'United States' }, market: 'US' },
    { endpoint: 'stocks', params: { country: 'Turkey' }, market: 'TR' },
    { endpoint: 'cryptocurrencies', params: {}, market: 'CRYPTO' },
    { endpoint: 'indices', params: {}, market: 'INDEX' },
    { endpoint: 'commodities', params: {}, market: 'COMMODITY' },
  ]

  for (const task of tasks) {
    try {
      const payload = await throttledFetch(task.endpoint, task.params)
      const rows = toArrayPayload(payload)
      const normalized = normalizeRows(rows, task.market)
      collected[task.market].push(...normalized)
      console.log(`✓ ${task.market}: fetched ${normalized.length} rows from ${task.endpoint}`)
    } catch (error) {
      console.warn(`⚠ ${task.market}: ${error.message}`)
    }
  }

  return collected
}

function capAndDedupe(collected) {
  const bySymbol = new Map()

  for (const market of Object.keys(collected)) {
    const capped = collected[market].slice(0, MAX_BY_MARKET[market])
    for (const row of capped) {
      if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, row)
    }
  }

  return [...bySymbol.values()].sort((a, b) => {
    if (a.market === b.market) return a.symbol.localeCompare(b.symbol)
    return a.market.localeCompare(b.market)
  })
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''")
}

async function writeSqlFile(rows) {
  const outPath = path.join(rootDir, 'supabase', 'generated_twelve_stocks.sql')
  const header = [
    '-- Generated from Twelve Data',
    `-- Created at: ${new Date().toISOString()}`,
    `-- Total symbols: ${rows.length}`,
    '',
  ]

  const chunks = []
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values = chunk
      .map(
        row =>
          `('${sqlEscape(row.symbol)}','${sqlEscape(row.name)}','${sqlEscape(row.market)}','${sqlEscape(row.currency)}',true)`
      )
      .join(',\n')

    chunks.push(
      `INSERT INTO stocks (symbol, name, market, currency, is_active) VALUES\n${values}\nON CONFLICT (symbol) DO UPDATE SET\n  name = EXCLUDED.name,\n  market = EXCLUDED.market,\n  currency = EXCLUDED.currency,\n  is_active = EXCLUDED.is_active;`
    )
  }

  await fs.writeFile(outPath, `${header.join('\n')}${chunks.join('\n\n')}\n`, 'utf8')
  console.log(`✓ SQL file generated: ${path.relative(rootDir, outPath)}`)
}

async function upsertToSupabase(rows) {
  if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_SERVICE_ROLE_KEY)) {
    await writeSqlFile(rows)
    console.log('ℹ SUPABASE_SERVICE_ROLE_KEY not found, generated SQL instead of direct upsert.')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('stocks')
      .upsert(chunk, { onConflict: 'symbol', ignoreDuplicates: false })

    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`)
    }
  }

  console.log(`✓ Upserted ${rows.length} symbols into stocks table.`)
}

function printSummary(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.market] = (acc[row.market] || 0) + 1
    return acc
  }, {})

  console.log('\n=== Sync Summary ===')
  console.log(`Requests used: ${requestsCount}/${MAX_REQUESTS_PER_RUN}`)
  for (const market of ['US', 'TR', 'CRYPTO', 'COMMODITY', 'INDEX']) {
    console.log(`${market}: ${counts[market] || 0}`)
  }
  console.log(`TOTAL: ${rows.length}`)
}

async function main() {
  requireApiKey()

  console.log('Starting Twelve Data stocks sync...')
  console.log(`Rate limit: one request per ${REQUEST_INTERVAL_MS}ms`) 
  console.log(`Request budget: ${MAX_REQUESTS_PER_RUN}`)

  const collected = await fetchByCategory()
  const rows = capAndDedupe(collected)

  if (rows.length === 0) {
    throw new Error('No symbols fetched from Twelve Data. Check API key and endpoint availability.')
  }

  await upsertToSupabase(rows)
  printSummary(rows)
}

main().catch(err => {
  console.error(`✗ Sync failed: ${err.message}`)
  process.exit(1)
})
