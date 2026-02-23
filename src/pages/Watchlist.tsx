import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { StockCombobox } from '@/components/StockCombobox'
import { AIInsightPanel } from '@/components/AIInsightPanel'
import { useAppStore } from '@/store'
import { fetchMarketData, fetchCandleData, isTwelveDataConfigured } from '@/lib/marketData'
import {
  addWatchlistItem,
  removeWatchlistItem,
  fetchLatestAnalysesBySymbols,
  savePriceSnapshots,
  fetchPriceHistory,
  fetchLatestPriceSnapshots,
  fetchChartAnnotation,
  saveChartAnnotation,
  saveSystemLog,
  type PriceSnapshot,
} from '@/lib/supabase'
import { cn, formatCurrency, formatPercent, formatDate, getChangeColor } from '@/lib/utils'
import { AIAnalysis, CandleData, MarketType, Stock, WatchlistItem } from '@/types'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

const MARKET_LABELS: Record<MarketType, string> = {
  US: '🇺🇸 أمريكا',
  TR: '🇹🇷 تركيا',
  CRYPTO: '💎 عملات رقمية',
  COMMODITY: '🥇 سلع',
  INDEX: '📊 مؤشرات',
}

type MarketState = 'OPEN' | 'CLOSED'

interface ChartPoint {
  ts: string
  price: number
  sma20?: number
  sma50?: number
  trend?: number
}

type ChartMode = 'INTERNAL' | 'TRADINGVIEW'

function getMarketState(market: MarketType): MarketState {
  const now = new Date()
  const day = now.getUTCDay()
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const isWeekday = day >= 1 && day <= 5

  if (market === 'CRYPTO') return 'OPEN'
  if (!isWeekday) return 'CLOSED'

  if (market === 'US') {
    return minutes >= 14 * 60 + 30 && minutes <= 21 * 60 ? 'OPEN' : 'CLOSED'
  }
  if (market === 'TR') {
    return minutes >= 7 * 60 && minutes <= 15 * 60 ? 'OPEN' : 'CLOSED'
  }
  if (market === 'COMMODITY' || market === 'INDEX') {
    return isWeekday ? 'OPEN' : 'CLOSED'
  }
  return 'CLOSED'
}

function getDirectionAndIndicators(stock?: Stock, analysis?: AIAnalysis) {
  if (!analysis) {
    return { direction: 'محايد', indicators: ['انتظار آخر تحليل AI (RSI / MACD / BOLL)'] }
  }

  const ind = analysis.indicators
  const marketPrice = stock?.price || analysis.price
  const bollMid = (ind.bollingerUpper + ind.bollingerLower) / 2
  const macdHist = ind.macd - ind.macdSignal

  const parts = [
    {
      label: `RSI ${ind.rsi.toFixed(1)}${ind.rsi < 35 ? ' (دعم صعود)' : ind.rsi > 65 ? ' (ضغط هبوط)' : ' (محايد)'}`,
      score: ind.rsi < 35 ? 1 : ind.rsi > 65 ? -1 : 0,
      weight: 1,
    },
    {
      label: `MACD ${ind.macd.toFixed(3)}${macdHist > 0 ? ' (تقاطع صاعد)' : ' (تقاطع هابط)'}`,
      score: macdHist > 0 ? 1 : -1,
      weight: 1.2,
    },
    {
      label: `BOLL ${marketPrice <= ind.bollingerLower * 1.01 ? 'قرب الدعم' : marketPrice >= ind.bollingerUpper * 0.99 ? 'قرب المقاومة' : marketPrice >= bollMid ? 'فوق المنتصف' : 'تحت المنتصف'}`,
      score: marketPrice <= ind.bollingerLower * 1.01 ? 1 : marketPrice >= ind.bollingerUpper * 0.99 ? -1 : marketPrice >= bollMid ? 0.4 : -0.4,
      weight: 1.1,
    },
    {
      label: `اتجاه AI ${analysis.signal === 'BUY' ? 'شراء' : analysis.signal === 'SELL' ? 'بيع' : 'احتفاظ'} (${analysis.confidence.toFixed(0)}%)`,
      score: analysis.signal === 'BUY' ? 1 : analysis.signal === 'SELL' ? -1 : 0,
      weight: 1.4,
    },
  ]

  const weightedTotal = parts.reduce((sum, part) => sum + part.score * part.weight, 0)
  const direction = weightedTotal >= 1.2 ? 'صاعد' : weightedTotal <= -1.2 ? 'هابط' : 'محايد'

  const strongest = parts
    .map(part => ({ label: part.label, power: Math.abs(part.score * part.weight) }))
    .sort((a, b) => b.power - a.power)
    .slice(0, 3)
    .map(part => part.label)

  return { direction, indicators: strongest }
}

function toTradingViewSymbol(item: WatchlistItem): string {
  if (item.market === 'US') return `NASDAQ:${item.symbol.replace('.US', '')}`
  if (item.market === 'TR') return `BIST:${item.symbol.replace('.IS', '')}`
  if (item.market === 'CRYPTO') {
    const normalized = item.symbol.replace('/', '')
    return normalized.endsWith('USD') ? `BINANCE:${normalized}T` : `BINANCE:${normalized}`
  }
  if (item.symbol === 'XAU/USD') return 'OANDA:XAUUSD'
  if (item.symbol === 'XAG/USD') return 'OANDA:XAGUSD'
  if (item.symbol === 'WTI/USD') return 'TVC:USOIL'
  if (item.market === 'INDEX' && item.symbol === 'SPX') return 'SP:SPX'
  if (item.market === 'INDEX' && item.symbol === 'DJI') return 'DJ:DJI'
  if (item.market === 'INDEX' && item.symbol === 'IXIC') return 'NASDAQ:IXIC'
  return item.symbol.replace('/', '')
}

function calcSma(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) return undefined
    const start = index - period + 1
    const slice = values.slice(start, index + 1)
    const avg = slice.reduce((sum, value) => sum + value, 0) / period
    return Number(avg.toFixed(4))
  })
}

export default function Watchlist() {
  const { user, watchlist, addToWatchlist, removeFromWatchlist } = useAppStore()
  const [stocksData, setStocksData] = useState<Record<string, Stock>>({})
  const [latestAnalyses, setLatestAnalyses] = useState<Record<string, AIAnalysis>>({})
  const [lastImportedAt, setLastImportedAt] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [filterMarket, setFilterMarket] = useState<string>('ALL')
  const [searchFilter, setSearchFilter] = useState('')

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<WatchlistItem | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [showSma20, setShowSma20] = useState(true)
  const [showSma50, setShowSma50] = useState(false)
  const [showTrend, setShowTrend] = useState(false)
  const [trendStart, setTrendStart] = useState('')
  const [trendEnd, setTrendEnd] = useState('')
  const [chartMode, setChartMode] = useState<ChartMode>('INTERNAL')

  const loadWatchlistData = useCallback(async () => {
    if (watchlist.length === 0) return
    setLoading(true)

    try {
      const symbols = watchlist.map(w => ({
        symbol: w.symbol,
        name: w.name,
        market: w.market,
        currency: w.market === 'TR' ? 'TRY' : 'USD',
      }))

      const fetchedAt = new Date().toISOString()
      const stocks = await fetchMarketData(symbols)
      const stockMap: Record<string, Stock> = {}
      stocks.forEach(stock => {
        stockMap[stock.symbol] = stock
      })
      setStocksData(stockMap)

      const importedMap: Record<string, string> = {}
      stocks.forEach(stock => {
        importedMap[stock.symbol] = fetchedAt
      })
      setLastImportedAt(prev => ({ ...prev, ...importedMap }))

      if (user?.id) {
        const latestSnapshots = await fetchLatestPriceSnapshots(user.id, symbols.map(s => s.symbol))
        const initialImportedMap: Record<string, string> = {}
        Object.entries(latestSnapshots).forEach(([symbol, snapshot]) => {
          initialImportedMap[symbol] = snapshot.fetchedAt
        })
        if (Object.keys(initialImportedMap).length > 0) {
          setLastImportedAt(prev => ({ ...prev, ...initialImportedMap }))
        }

        const snapshots: PriceSnapshot[] = stocks.map(stock => ({
          user_id: user.id,
          symbol: stock.symbol,
          market: stock.market,
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          volume: stock.volume,
          fetchedAt,
        }))
        savePriceSnapshots(snapshots).catch(console.warn)

        const latest = await fetchLatestAnalysesBySymbols(user.id, symbols.map(s => s.symbol))
        setLatestAnalyses(latest)
      }
    } finally {
      setLoading(false)
    }
  }, [watchlist, user?.id])

  const loadSymbolHistory = useCallback(async (item: WatchlistItem) => {
    setLoadingChart(true)
    try {
      const points: { ts: string; price: number }[] = []

      if (user?.id) {
        const history = await fetchPriceHistory(user.id, item.symbol, 300)
        history.forEach(h => {
          points.push({ ts: h.fetchedAt, price: h.price })
        })
      }

      if (points.length < 20) {
        const candles = await fetchCandleData(item.symbol, '1h', 120)
        candles.forEach((candle: CandleData) => {
          points.push({ ts: new Date(candle.time * 1000).toISOString(), price: candle.close })
        })

        if (user?.id && candles.length > 0) {
          const seededSnapshots: PriceSnapshot[] = candles.map(candle => ({
            user_id: user.id,
            symbol: item.symbol,
            market: item.market,
            price: candle.close,
            change: 0,
            changePercent: 0,
            volume: candle.volume || 0,
            fetchedAt: new Date(candle.time * 1000).toISOString(),
          }))
          savePriceSnapshots(seededSnapshots).catch(console.warn)
        }
      }

      const sorted = points
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
        .slice(-300)

      const prices = sorted.map(point => point.price)
      const sma20 = calcSma(prices, 20)
      const sma50 = calcSma(prices, 50)

      const start = prices[0] || 0
      const end = prices[prices.length - 1] || 0
      setTrendStart(start.toString())
      setTrendEnd(end.toString())

      const built: ChartPoint[] = sorted.map((point, index) => ({
        ts: point.ts,
        price: point.price,
        sma20: sma20[index],
        sma50: sma50[index],
      }))

      setChartData(built)

      if (user?.id) {
        const annotation = await fetchChartAnnotation(user.id, item.symbol)
        if (annotation) {
          setShowSma20(annotation.showSma20)
          setShowSma50(annotation.showSma50)
          setShowTrend(annotation.showTrend)
          if (annotation.trendStart !== undefined) setTrendStart(String(annotation.trendStart))
          if (annotation.trendEnd !== undefined) setTrendEnd(String(annotation.trendEnd))
        }
      }
    } finally {
      setLoadingChart(false)
    }
  }, [user?.id])

  const handleSaveChartSettings = async () => {
    if (!user?.id || !selectedSymbol) return
    const trendStartNumber = Number(trendStart)
    const trendEndNumber = Number(trendEnd)
    await saveChartAnnotation({
      user_id: user.id,
      symbol: selectedSymbol.symbol,
      showSma20,
      showSma50,
      showTrend,
      trendStart: Number.isFinite(trendStartNumber) ? trendStartNumber : undefined,
      trendEnd: Number.isFinite(trendEndNumber) ? trendEndNumber : undefined,
    })
  }

  useEffect(() => {
    let isCancelled = false
    let timer: number | undefined

    const schedule = async () => {
      await loadWatchlistData()
      if (isCancelled) return

      const hasOpenMarket = watchlist.some(item => getMarketState(item.market) === 'OPEN')
      const nextMs = hasOpenMarket ? 120000 : 600000
      timer = window.setTimeout(() => {
        schedule().catch(console.warn)
      }, nextMs)
    }

    schedule().catch(console.warn)

    return () => {
      isCancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [loadWatchlistData, watchlist])

  const generateItemId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  const handleAddStock = async (symbol: string, name: string, market: MarketType) => {
    const normalizedSymbol = symbol.trim().toUpperCase()
    if (!normalizedSymbol) return

    const userId = user?.id || 'local'
    const item: WatchlistItem = {
      id: generateItemId(),
      user_id: userId,
      symbol: normalizedSymbol,
      name,
      market,
      added_at: new Date().toISOString(),
    }

    if (user?.id) {
      const saved = await addWatchlistItem(item)
      if (!saved) return
      await saveSystemLog({
        user_id: user.id,
        action_type: 'WATCHLIST_SYMBOL_ADDED',
        entity_type: 'WATCHLIST',
        entity_id: normalizedSymbol,
        status: 'SUCCESS',
        payload: { symbol: normalizedSymbol, market, name },
      })
    }

    addToWatchlist(item)
    setAddDialogOpen(false)
    loadWatchlistData().catch(console.warn)
  }

  const handleRemoveStock = async (symbol: string) => {
    if (user?.id) {
      const removed = await removeWatchlistItem(user.id, symbol)
      if (!removed) return
      await saveSystemLog({
        user_id: user.id,
        action_type: 'WATCHLIST_SYMBOL_REMOVED',
        entity_type: 'WATCHLIST',
        entity_id: symbol,
        status: 'SUCCESS',
        payload: { symbol },
      })
    }
    removeFromWatchlist(symbol)
  }

  const handleOpenDetails = async (item: WatchlistItem) => {
    setSelectedSymbol(item)
    setDetailsOpen(true)
    await loadSymbolHistory(item)
  }

  const filteredWatchlist = watchlist.filter(item => {
    const matchesSearch = item.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.name.toLowerCase().includes(searchFilter.toLowerCase())
    const matchesMarket = filterMarket === 'ALL' || item.market === filterMarket
    return matchesSearch && matchesMarket
  })

  const excludedSymbols = watchlist.map(w => w.symbol)

  const marketStates = useMemo(() => {
    const markets: MarketType[] = ['US', 'TR', 'CRYPTO', 'COMMODITY', 'INDEX']
    return markets.map(market => ({ market, state: getMarketState(market) }))
  }, [])

  const chartWithTrend = useMemo(() => {
    if (!showTrend || chartData.length === 0) return chartData
    const start = Number(trendStart)
    const end = Number(trendEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return chartData

    return chartData.map((point, idx, arr) => {
      const ratio = arr.length <= 1 ? 0 : idx / (arr.length - 1)
      const trend = start + (end - start) * ratio
      return { ...point, trend: Number(trend.toFixed(4)) }
    })
  }, [chartData, showTrend, trendStart, trendEnd])

  const selectedAnalysis = selectedSymbol ? latestAnalyses[selectedSymbol.symbol] : undefined
  const selectedTradingViewSymbol = selectedSymbol ? toTradingViewSymbol(selectedSymbol) : ''
  const bullishCount = Object.values(latestAnalyses).filter(a => a.signal === 'BUY').length
  const bearishCount = Object.values(latestAnalyses).filter(a => a.signal === 'SELL').length
  const tdConfigured = isTwelveDataConfigured()
  const watchlistInsights = [
    filteredWatchlist.length > 0
      ? `تتابع حاليًا ${filteredWatchlist.length} رمزًا ويمكن تحديث أسعارها مباشرة من زر التحديث.`
      : 'القائمة فارغة؛ أضف رموزًا لبدء التحليل والمتابعة التلقائية.',
    bullishCount >= bearishCount
      ? `الإشارات الصاعدة (${bullishCount}) أعلى أو مساوية للهابطة (${bearishCount}).`
      : `الإشارات الهابطة (${bearishCount}) أعلى من الصاعدة (${bullishCount})؛ ارفع الحذر.`,
    marketStates.some(m => m.state === 'OPEN')
      ? 'توجد أسواق مفتوحة الآن؛ الأفضل تشغيل تحديث فوري للاستفادة من الحركة.'
      : 'أغلب الأسواق مغلقة حاليًا؛ راقب آخر تحليل قبل افتتاح الجلسة القادمة.',
  ]

  return (
    <div className="space-y-6">
      <AIInsightPanel
        title="مساعد قائمة المتابعة"
        insights={watchlistInsights}
        ctaTo="/analyzer"
        ctaLabel="تشغيل تحليل جديد"
      />

      <Card className="glass">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">حالة الأسواق:</span>
            <Badge className={tdConfigured ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}>
              مزود السعر: {tdConfigured ? 'Twelve Data (حي)' : 'Mock (تجريبي)'}
            </Badge>
            {marketStates.map(item => (
              <Badge
                key={item.market}
                className={cn(
                  item.state === 'OPEN'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                )}
              >
                {MARKET_LABELS[item.market]} - {item.state === 'OPEN' ? 'مفتوح' : 'مغلق'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap items-center">
          <Input
            placeholder="بحث في القائمة..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-48"
          />
          <Select value={filterMarket} onValueChange={setFilterMarket}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="كل الأسواق" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل الأسواق</SelectItem>
              {Object.entries(MARKET_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadWatchlistData} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 ml-2', loading && 'animate-spin')} />
            تحديث
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة سهم
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة إلى قائمة المتابعة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm font-medium">ابحث برمز السهم في كل الأسواق:</label>
                  <StockCombobox
                    excludeSymbols={excludedSymbols}
                    onSelect={(symbol, name, market) => {
                      handleAddStock(symbol, name, market).catch(console.warn)
                    }}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(MARKET_LABELS).map(([market, label]) => {
          const count = watchlist.filter(w => w.market === market).length
          return (
            <Card key={market} className="glass">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            قائمة المتابعة
            <Badge variant="secondary">{filteredWatchlist.length} رمز</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredWatchlist.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">لا توجد أسهم في قائمة المتابعة</p>
              <p className="text-sm">أضف أسهمك المفضلة لمتابعتها</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">الرمز</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">السوق</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">السعر</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">التغير</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">اتجاه السوق</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">أقوى المؤشرات</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">آخر تحديث</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWatchlist.map((item) => {
                    const stock = stocksData[item.symbol]
                    const analysis = latestAnalyses[item.symbol]
                    const derived = getDirectionAndIndicators(stock, analysis)
                    const lastAt = lastImportedAt[item.symbol]

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => {
                          handleOpenDetails(item).catch(console.warn)
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-xs font-bold">
                              {item.symbol.slice(0, 2)}
                            </div>
                            <span className="font-bold text-sm">{item.symbol}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{item.name}</td>
                        <td className="px-4 py-4">
                          <Badge variant="secondary" className="text-xs">
                            {MARKET_LABELS[item.market]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-left font-semibold text-sm">
                          {stock ? formatCurrency(stock.price) : '—'}
                        </td>
                        <td className="px-4 py-4 text-left">
                          {stock ? (
                            <div className={cn('flex items-center gap-1 text-sm font-medium', getChangeColor(stock.changePercent))}>
                              {stock.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {formatPercent(stock.changePercent)}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <Badge
                            className={cn(
                              derived.direction === 'صاعد'
                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                : derived.direction === 'هابط'
                                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                  : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                            )}
                          >
                            {derived.direction}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <div className="space-y-1">
                            {derived.indicators.map(text => (
                              <div key={`${item.symbol}-${text}`} className="flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                <span>{text}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {lastAt ? formatDate(lastAt) : '—'}
                        </td>
                        <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => {
                              handleRemoveStock(item.symbol).catch(console.warn)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSymbol ? `الرسم البياني - ${selectedSymbol.symbol}` : 'الرسم البياني'}
            </DialogTitle>
          </DialogHeader>

          {selectedSymbol && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant={chartMode === 'INTERNAL' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('INTERNAL')}>الشارت الداخلي</Button>
                <Button variant={chartMode === 'TRADINGVIEW' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('TRADINGVIEW')}>TradingView</Button>
                {chartMode === 'TRADINGVIEW' && selectedTradingViewSymbol && (
                  <a
                    href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(selectedTradingViewSymbol)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    فتح TradingView في تبويب جديد
                  </a>
                )}
              </div>

              {chartMode === 'INTERNAL' ? (
                <>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant={showSma20 ? 'default' : 'outline'} size="sm" onClick={() => setShowSma20(!showSma20)}>SMA20</Button>
                <Button variant={showSma50 ? 'default' : 'outline'} size="sm" onClick={() => setShowSma50(!showSma50)}>SMA50</Button>
                <Button variant={showTrend ? 'default' : 'outline'} size="sm" onClick={() => setShowTrend(!showTrend)}>Trend Line</Button>
                <Input className="w-32" value={trendStart} onChange={e => setTrendStart(e.target.value)} placeholder="Trend Start" />
                <Input className="w-32" value={trendEnd} onChange={e => setTrendEnd(e.target.value)} placeholder="Trend End" />
                <Button variant="outline" size="sm" onClick={() => { handleSaveChartSettings().catch(console.warn) }}>حفظ الإعدادات</Button>
              </div>

              <Card className="glass">
                <CardContent className="p-3">
                  {loadingChart ? (
                    <div className="py-10 text-center text-muted-foreground">جاري تحميل البيانات...</div>
                  ) : chartWithTrend.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">لا توجد بيانات سعر مخزنة بعد</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={chartWithTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="ts" tickFormatter={(value: string) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} />
                        <YAxis domain={['auto', 'auto']} />
                        <Tooltip labelFormatter={(value: string) => formatDate(value)} formatter={(value: number) => formatCurrency(value)} />

                        <Line type="monotone" dataKey="price" stroke="#60a5fa" strokeWidth={2} dot={false} name="Price" />
                        {showSma20 && <Line type="monotone" dataKey="sma20" stroke="#22c55e" strokeWidth={1.5} dot={false} name="SMA20" />}
                        {showSma50 && <Line type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA50" />}
                        {showTrend && <Line type="monotone" dataKey="trend" stroke="#e879f9" strokeWidth={1.5} dot={false} strokeDasharray="6 4" name="Trend" />}

                        {selectedAnalysis && (
                          <>
                            <ReferenceLine y={selectedAnalysis.price} stroke="#60a5fa" strokeDasharray="3 3" label="Entry" />
                            <ReferenceLine y={selectedAnalysis.targetPrice} stroke="#22c55e" strokeDasharray="3 3" label="Target" />
                            <ReferenceLine y={selectedAnalysis.stopLoss} stroke="#ef4444" strokeDasharray="3 3" label="Stop" />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
                </>
              ) : (
                <Card className="glass">
                  <CardContent className="p-2">
                    <iframe
                      title={`TradingView-${selectedSymbol.symbol}`}
                      src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(selectedTradingViewSymbol)}&interval=60&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0f172a&theme=dark&style=1&timezone=Etc%2FUTC&studies=RSI%40tv-basicstudies%2CMACD%40tv-basicstudies%2CBB%40tv-basicstudies&withdateranges=1&hide_top_toolbar=0&hide_legend=0&locale=ar`}
                      className="w-full h-[420px] rounded-md border border-border"
                    />
                  </CardContent>
                </Card>
              )}

              {selectedAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">آخر توصية AI</div><div className="text-lg font-bold">{selectedAnalysis.signal}</div></CardContent></Card>
                  <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">دخول مقترح</div><div className="text-lg font-bold">{formatCurrency(selectedAnalysis.price)}</div></CardContent></Card>
                  <Card className="glass"><CardContent className="p-3"><div className="text-xs text-muted-foreground">خروج (هدف / وقف)</div><div className="text-lg font-bold">{formatCurrency(selectedAnalysis.targetPrice)} / {formatCurrency(selectedAnalysis.stopLoss)}</div></CardContent></Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
