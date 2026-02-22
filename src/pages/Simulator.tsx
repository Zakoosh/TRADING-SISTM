import { useState, useCallback } from 'react'
import { Gamepad2, TrendingUp, TrendingDown, Plus, X, DollarSign, PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { fetchStockPrice, DEFAULT_STOCKS } from '@/lib/marketData'
import { sendTradeNotification } from '@/lib/telegram'
import { saveSimulatorTrade } from '@/lib/supabase'
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils'
import { SimulatorTrade, MarketType } from '@/types'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

const INITIAL_CAPITAL = 100000

export default function Simulator() {
  const { simulatorTrades, addSimulatorTrade, setSimulatorTrades, simulatorCash, setSimulatorCash, analyses, user } = useAppStore()
  const [newTradeOpen, setNewTradeOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('US')
  const [quantity, setQuantity] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  const openTrades = simulatorTrades.filter(t => t.status === 'OPEN')
  const closedTrades = simulatorTrades.filter(t => t.status === 'CLOSED')

  // Portfolio calculations
  const totalInvested = openTrades.reduce((sum, t) => sum + t.total, 0)
  const totalClosedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const portfolioValue = simulatorCash + totalInvested
  const totalReturn = portfolioValue - INITIAL_CAPITAL
  const returnPercent = (totalReturn / INITIAL_CAPITAL) * 100

  // Win rate
  const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0)
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0

  const loadPrice = useCallback(async (symbol: string, market: MarketType) => {
    if (!symbol) return
    setLoading(true)
    try {
      const price = await fetchStockPrice(symbol, market)
      setCurrentPrice(price)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol)
    loadPrice(symbol, selectedMarket)
  }

  const executeTrade = useCallback(async () => {
    if (!selectedSymbol || !quantity || !currentPrice) return
    const qty = parseFloat(quantity)
    if (qty <= 0) return

    const total = qty * currentPrice

    if (tradeType === 'BUY' && total > simulatorCash) {
      alert('رصيد غير كافي!')
      return
    }

    const stockInfo = Object.values(DEFAULT_STOCKS).flat().find(s => s.symbol === selectedSymbol)
    const trade: SimulatorTrade = {
      id: crypto.randomUUID(),
      user_id: 'local',
      symbol: selectedSymbol,
      name: stockInfo?.name || selectedSymbol,
      type: tradeType,
      quantity: qty,
      price: currentPrice,
      total,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    }

    addSimulatorTrade(trade)

    if (tradeType === 'BUY') {
      setSimulatorCash(simulatorCash - total)
    } else {
      setSimulatorCash(simulatorCash + total)
    }

    // Save to Supabase in background
    if (user?.id) saveSimulatorTrade(trade, user.id).catch(console.warn)

    // Send Telegram notification
    await sendTradeNotification(selectedSymbol, tradeType, qty, currentPrice, total, 'SIMULATOR')

    setNewTradeOpen(false)
    setSelectedSymbol('')
    setQuantity('')
    setCurrentPrice(null)
  }, [selectedSymbol, quantity, currentPrice, tradeType, simulatorCash, addSimulatorTrade, setSimulatorCash])

  const closeTrade = useCallback(async (trade: SimulatorTrade) => {
    const closePrice = await fetchStockPrice(trade.symbol, 'US' as MarketType)
    const pnl = (closePrice - trade.price) * trade.quantity * (trade.type === 'BUY' ? 1 : -1)
    const pnlPercent = (pnl / trade.total) * 100

    const updatedTrades = simulatorTrades.map(t =>
      t.id === trade.id
        ? { ...t, status: 'CLOSED' as const, closePrice, pnl, pnlPercent, closedAt: new Date().toISOString() }
        : t
    )
    setSimulatorTrades(updatedTrades)
    setSimulatorCash(simulatorCash + (trade.type === 'BUY' ? closePrice * trade.quantity : trade.total - closePrice * trade.quantity))
  }, [simulatorTrades, simulatorCash, setSimulatorTrades, setSimulatorCash])

  const filteredTrades = simulatorTrades.filter(t => {
    if (filter === 'OPEN') return t.status === 'OPEN'
    if (filter === 'CLOSED') return t.status === 'CLOSED'
    return true
  })

  // Chart data
  const chartData = closedTrades.slice(-20).reduce((acc, trade) => {
    const prev = acc[acc.length - 1]?.value || INITIAL_CAPITAL
    return [...acc, { date: trade.closedAt?.split('T')[0] || '', value: prev + (trade.pnl || 0) }]
  }, [{ date: 'البداية', value: INITIAL_CAPITAL }])

  const availableSymbols = DEFAULT_STOCKS[selectedMarket] || []

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">قيمة المحفظة</div>
            <div className="text-xl font-bold">{formatCurrency(portfolioValue)}</div>
            <div className={cn('text-xs mt-1', getChangeColor(returnPercent))}>
              {formatPercent(returnPercent)} من رأس المال
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">الرصيد النقدي</div>
            <div className="text-xl font-bold">{formatCurrency(simulatorCash)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {((simulatorCash / portfolioValue) * 100).toFixed(1)}% من المحفظة
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">إجمالي الأرباح</div>
            <div className={cn('text-xl font-bold', getChangeColor(totalClosedPnl))}>
              {formatCurrency(Math.abs(totalClosedPnl))}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              من {closedTrades.length} صفقة مغلقة
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">معدل النجاح</div>
            <div className="text-xl font-bold">{winRate.toFixed(1)}%</div>
            <Progress value={winRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Capital Usage */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">استخدام رأس المال</span>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(totalInvested)} / {formatCurrency(portfolioValue)}
            </span>
          </div>
          <Progress value={(totalInvested / portfolioValue) * 100} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>مُستثمر: {((totalInvested / portfolioValue) * 100).toFixed(1)}%</span>
            <span>نقدي: {((simulatorCash / portfolioValue) * 100).toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart */}
      {chartData.length > 1 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">أداء المحفظة</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  fill="rgba(34,197,94,0.1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trades Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {['ALL', 'OPEN', 'CLOSED'].map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f as typeof filter)}
            >
              {f === 'ALL' ? 'الكل' : f === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
            </Button>
          ))}
        </div>
        <Dialog open={newTradeOpen} onOpenChange={setNewTradeOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              صفقة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>فتح صفقة جديدة - محاكاة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={tradeType === 'BUY' ? 'success' : 'outline'}
                  onClick={() => setTradeType('BUY')}
                  className="gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  شراء
                </Button>
                <Button
                  variant={tradeType === 'SELL' ? 'danger' : 'outline'}
                  onClick={() => setTradeType('SELL')}
                  className="gap-2"
                >
                  <TrendingDown className="w-4 h-4" />
                  بيع
                </Button>
              </div>

              <Select value={selectedMarket} onValueChange={v => {
                setSelectedMarket(v as MarketType)
                setSelectedSymbol('')
                setCurrentPrice(null)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر السوق" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 أمريكا</SelectItem>
                  <SelectItem value="CRYPTO">💎 عملات رقمية</SelectItem>
                  <SelectItem value="COMMODITY">🥇 سلع</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSymbol} onValueChange={handleSymbolChange}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الرمز" />
                </SelectTrigger>
                <SelectContent>
                  {availableSymbols.map(s => (
                    <SelectItem key={s.symbol} value={s.symbol}>
                      {s.symbol} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentPrice && (
                <div className="flex justify-between p-3 bg-accent rounded-lg">
                  <span className="text-sm text-muted-foreground">السعر الحالي</span>
                  <span className="font-bold">{formatCurrency(currentPrice)}</span>
                </div>
              )}

              <Input
                type="number"
                placeholder="الكمية"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="0.01"
                step="0.01"
              />

              {currentPrice && quantity && (
                <div className="space-y-2">
                  <div className="flex justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm text-muted-foreground">الإجمالي</span>
                    <span className="font-bold">{formatCurrency(parseFloat(quantity) * currentPrice)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>الرصيد المتاح: {formatCurrency(simulatorCash)}</span>
                    {tradeType === 'BUY' && parseFloat(quantity) * currentPrice > simulatorCash && (
                      <span className="text-red-500">رصيد غير كافٍ!</span>
                    )}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={executeTrade}
                disabled={!selectedSymbol || !quantity || !currentPrice || loading ||
                  (tradeType === 'BUY' && parseFloat(quantity) * (currentPrice || 0) > simulatorCash)}
              >
                تأكيد الصفقة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Trades Table */}
      <Card className="glass">
        <CardContent className="p-0">
          {filteredTrades.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد صفقات بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">الرمز</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">النوع</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">الكمية</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">سعر الدخول</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">الإجمالي</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ر/خ</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">الحالة</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTrades.map(trade => (
                    <tr key={trade.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-sm">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <Badge className={trade.type === 'BUY' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}>
                          {trade.type === 'BUY' ? 'شراء' : 'بيع'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-left text-sm">{trade.quantity}</td>
                      <td className="px-4 py-3 text-left text-sm font-mono">{formatCurrency(trade.price)}</td>
                      <td className="px-4 py-3 text-left text-sm">{formatCurrency(trade.total)}</td>
                      <td className="px-4 py-3 text-left">
                        {trade.pnl !== undefined ? (
                          <span className={cn('text-sm font-medium', getChangeColor(trade.pnl))}>
                            {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={trade.status === 'OPEN' ? 'success' : 'secondary'}>
                          {trade.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {trade.status === 'OPEN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-500 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => closeTrade(trade)}
                          >
                            <X className="w-3 h-3 ml-1" />
                            إغلاق
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
