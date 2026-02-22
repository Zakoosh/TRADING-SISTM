import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { fetchMarketData } from '@/lib/marketData'
import { fetchAvailableStocks } from '@/lib/supabase'
import { cn, formatCurrency, formatPercent, formatVolume, getChangeColor } from '@/lib/utils'
import { MarketType, Stock, WatchlistItem } from '@/types'

const MARKET_LABELS: Record<MarketType, string> = {
  US: '🇺🇸 أمريكا',
  TR: '🇹🇷 تركيا',
  CRYPTO: '💎 عملات رقمية',
  COMMODITY: '🥇 سلع',
  INDEX: '📊 مؤشرات',
}

export default function Watchlist() {
  const { watchlist, addToWatchlist, removeFromWatchlist } = useAppStore()
  const [stocksData, setStocksData] = useState<Record<string, Stock>>({})
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [availableStocks, setAvailableStocks] = useState<Array<{ symbol: string; name: string; market: MarketType; currency: string }>>([])
  const [filterMarket, setFilterMarket] = useState<string>('ALL')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAvailableStocks()
      .then(setAvailableStocks)
      .catch(() => setAvailableStocks([]))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadWatchlistData = useCallback(async () => {
    if (watchlist.length === 0) return
    setLoading(true)
    try {
      const items = watchlist.map(w => ({ symbol: w.symbol, name: w.name, market: w.market, currency: 'USD' }))
      const stocks = await fetchMarketData(items)
      const map: Record<string, Stock> = {}
      stocks.forEach(s => { map[s.symbol] = s })
      setStocksData(map)
    } finally {
      setLoading(false)
    }
  }, [watchlist])

  useEffect(() => {
    loadWatchlistData()
    const interval = setInterval(loadWatchlistData, 30000)
    return () => clearInterval(interval)
  }, [loadWatchlistData])

  const handleAddStock = (symbol: string, name: string, market: MarketType) => {
    const item: WatchlistItem = {
      id: crypto.randomUUID(),
      user_id: 'local',
      symbol,
      name,
      market,
      added_at: new Date().toISOString(),
    }
    addToWatchlist(item)
    setSearch('')
    setDropdownOpen(false)
  }

  const dropdownStocks = availableStocks.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredWatchlist = watchlist.filter(item => {
    const matchesSearch = item.symbol.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
    const matchesMarket = filterMarket === 'ALL' || item.market === filterMarket
    return matchesSearch && matchesMarket
  })

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          {/* Searchable stock combobox */}
          <div className="relative" ref={searchRef}>
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="بحث وإضافة سهم..."
              aria-label="بحث عن سهم وإضافته إلى قائمة المتابعة"
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
              onFocus={() => setDropdownOpen(true)}
              className="pr-9 w-64"
            />
            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="قائمة الأسهم المتاحة"
                className="absolute top-full mt-1 right-0 w-80 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50"
              >
                {dropdownStocks.length > 0 ? (
                  dropdownStocks.slice(0, 30).map(stock => {
                    const inWatchlist = watchlist.some(w => w.symbol === stock.symbol)
                    return (
                      <button
                        key={stock.symbol}
                        role="option"
                        aria-selected={inWatchlist}
                        onClick={() => !inWatchlist && handleAddStock(stock.symbol, stock.name, stock.market)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-right transition-colors',
                          inWatchlist
                            ? 'opacity-50 cursor-default'
                            : 'hover:bg-accent cursor-pointer'
                        )}
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          {inWatchlist
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Plus className="w-4 h-4 text-primary" />}
                          <Badge variant="secondary" className="text-xs">{MARKET_LABELS[stock.market]}</Badge>
                        </div>
                        <div className="mr-2">
                          <div className="font-medium text-sm">{stock.name}</div>
                          <div className="text-xs text-muted-foreground">{stock.symbol}</div>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
                )}
              </div>
            )}
          </div>
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Watchlist Table */}
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
                    <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">الرمز</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-muted-foreground">السوق</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">السعر</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">التغير</th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">الحجم</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-muted-foreground">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWatchlist.map((item) => {
                    const stock = stocksData[item.symbol]
                    return (
                      <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-xs font-bold">
                              {item.symbol.slice(0, 2)}
                            </div>
                            <span className="font-bold text-sm">{item.symbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.name}</td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary" className="text-xs">
                            {MARKET_LABELS[item.market]}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-left font-semibold text-sm">
                          {stock ? formatCurrency(stock.price) : '—'}
                        </td>
                        <td className="px-6 py-4 text-left">
                          {stock ? (
                            <div className={cn('flex items-center gap-1 text-sm font-medium', getChangeColor(stock.changePercent))}>
                              {stock.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {formatPercent(stock.changePercent)}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4 text-left text-sm text-muted-foreground">
                          {stock ? formatVolume(stock.volume) : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => removeFromWatchlist(item.symbol)}
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
    </div>
  )
}
