import { useState, useEffect, useCallback } from 'react'
import { DollarSign, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, X, Plus, Wifi } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import {
  getAlpacaAccount,
  getAlpacaPositions,
  getAlpacaOrders,
  placeAlpacaOrder,
  closeAlpacaPosition,
  isAlpacaConfigured
} from '@/lib/alpaca'
import { sendTradeNotification } from '@/lib/telegram'
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils'
import { AlpacaAccount, AlpacaPosition, AlpacaOrder } from '@/types'
import { DEFAULT_STOCKS } from '@/lib/marketData'

export default function RealTrading() {
  const { settings } = useAppStore()
  const [account, setAccount] = useState<AlpacaAccount | null>(null)
  const [positions, setPositions] = useState<AlpacaPosition[]>([])
  const [orders, setOrders] = useState<AlpacaOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [orderSymbol, setOrderSymbol] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [placing, setPlacing] = useState(false)
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions')

  const configured = isAlpacaConfigured() || !!(settings?.alpacaApiKey && settings?.alpacaSecretKey)

  const getCredentials = useCallback(() => ({
    apiKey: settings?.alpacaApiKey,
    secretKey: settings?.alpacaSecretKey,
    baseUrl: settings?.alpacaMode === 'LIVE'
      ? 'https://api.alpaca.markets'
      : 'https://paper-api.alpaca.markets',
  }), [settings])

  const loadData = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError('')
    try {
      const { apiKey, secretKey, baseUrl } = getCredentials()
      const [acc, pos, ords] = await Promise.all([
        getAlpacaAccount(apiKey, secretKey, baseUrl),
        getAlpacaPositions(apiKey, secretKey, baseUrl),
        getAlpacaOrders('open', 50, apiKey, secretKey, baseUrl),
      ])
      setAccount(acc)
      setPositions(pos)
      setOrders(ords)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في الاتصال بـ Alpaca')
    } finally {
      setLoading(false)
    }
  }, [configured, getCredentials])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const handlePlaceOrder = useCallback(async () => {
    if (!orderSymbol || !orderQty) return
    setPlacing(true)
    try {
      const { apiKey, secretKey, baseUrl } = getCredentials()
      const qty = parseFloat(orderQty)
      const price = limitPrice ? parseFloat(limitPrice) : undefined

      const order = await placeAlpacaOrder(
        orderSymbol, qty, orderSide, orderType, 'day', price,
        apiKey, secretKey, baseUrl
      )

      await sendTradeNotification(
        orderSymbol, orderSide === 'buy' ? 'BUY' : 'SELL',
        qty, price || 0, qty * (price || 0), 'REAL'
      )

      await loadData()
      setNewOrderOpen(false)
      setOrderSymbol('')
      setOrderQty('')
      setLimitPrice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في تنفيذ الأمر')
    } finally {
      setPlacing(false)
    }
  }, [orderSymbol, orderQty, orderSide, orderType, limitPrice, getCredentials, loadData])

  const handleClosePosition = useCallback(async (symbol: string) => {
    try {
      const { apiKey, secretKey, baseUrl } = getCredentials()
      await closeAlpacaPosition(symbol, apiKey, secretKey, baseUrl)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في إغلاق المركز')
    }
  }, [getCredentials, loadData])

  if (!configured) {
    return (
      <Card className="glass">
        <CardContent className="py-16 text-center space-y-4">
          <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 opacity-70" />
          <h2 className="text-xl font-bold">Alpaca غير مُكوّن</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            يجب تكوين مفاتيح Alpaca API من لوحة الإدارة لتفعيل التداول الحقيقي.
          </p>
          <Button asChild>
            <a href="/admin">الذهاب إلى الإعدادات</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="mr-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Mode Indicator */}
      <div className={cn(
        'flex items-center gap-2 p-3 rounded-lg border text-sm font-medium',
        settings?.alpacaMode === 'LIVE'
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
      )}>
        <Wifi className="w-4 h-4" />
        <span>
          {settings?.alpacaMode === 'LIVE'
            ? '⚠️ وضع التداول الحقيقي - الصفقات حقيقية!'
            : '🎮 وضع الورق (Paper Trading) - تجريبي آمن'}
        </span>
      </div>

      {/* Account Overview */}
      {account && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">قيمة المحفظة</div>
              <div className="text-xl font-bold">{formatCurrency(account.portfolio_value)}</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">النقدي المتاح</div>
              <div className="text-xl font-bold">{formatCurrency(account.cash)}</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">القوة الشرائية</div>
              <div className="text-xl font-bold">{formatCurrency(account.buying_power)}</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">الأسهم المحتفظ بها</div>
              <div className="text-xl font-bold">{formatCurrency(account.long_market_value)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {['positions', 'orders'].map(tab => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab as typeof activeTab)}
            >
              {tab === 'positions' ? `المراكز (${positions.length})` : `الأوامر (${orders.length})`}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 ml-2', loading && 'animate-spin')} />
            تحديث
          </Button>
          <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                أمر جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>أمر تداول جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {settings?.alpacaMode === 'LIVE' && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    ⚠️ أنت في وضع التداول الحقيقي. هذا الأمر سيُنفَّذ بأموال حقيقية!
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={orderSide === 'buy' ? 'success' : 'outline'}
                    onClick={() => setOrderSide('buy')}
                  >
                    <TrendingUp className="w-4 h-4 ml-1" /> شراء
                  </Button>
                  <Button
                    variant={orderSide === 'sell' ? 'danger' : 'outline'}
                    onClick={() => setOrderSide('sell')}
                  >
                    <TrendingDown className="w-4 h-4 ml-1" /> بيع
                  </Button>
                </div>
                <Input
                  placeholder="رمز السهم (مثل: AAPL)"
                  value={orderSymbol}
                  onChange={e => setOrderSymbol(e.target.value.toUpperCase())}
                />
                <Input
                  type="number"
                  placeholder="الكمية"
                  value={orderQty}
                  onChange={e => setOrderQty(e.target.value)}
                  min="1"
                />
                <Select value={orderType} onValueChange={v => setOrderType(v as 'market' | 'limit')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">أمر سوق (Market)</SelectItem>
                    <SelectItem value="limit">أمر حد (Limit)</SelectItem>
                  </SelectContent>
                </Select>
                {orderType === 'limit' && (
                  <Input
                    type="number"
                    placeholder="سعر الحد"
                    value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                  />
                )}
                <Button
                  className="w-full"
                  onClick={handlePlaceOrder}
                  disabled={placing || !orderSymbol || !orderQty}
                >
                  {placing ? 'جاري التنفيذ...' : 'تأكيد الأمر'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Positions */}
      {activeTab === 'positions' && (
        <Card className="glass">
          <CardContent className="p-0">
            {positions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد مراكز مفتوحة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">الرمز</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">الكمية</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">متوسط السعر</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">السعر الحالي</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">القيمة السوقية</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ر/خ غير محقق</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {positions.map(pos => (
                      <tr key={pos.asset_id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-sm">{pos.symbol}</td>
                        <td className="px-4 py-3 text-left text-sm">{pos.qty}</td>
                        <td className="px-4 py-3 text-left text-sm">{formatCurrency(pos.avg_entry_price)}</td>
                        <td className="px-4 py-3 text-left text-sm">{formatCurrency(pos.current_price)}</td>
                        <td className="px-4 py-3 text-left text-sm">{formatCurrency(pos.market_value)}</td>
                        <td className="px-4 py-3 text-left">
                          <div className={cn('text-sm font-medium', getChangeColor(pos.unrealized_pl))}>
                            {pos.unrealized_pl >= 0 ? '+' : ''}{formatCurrency(pos.unrealized_pl)}
                          </div>
                          <div className={cn('text-xs', getChangeColor(pos.unrealized_plpc * 100))}>
                            {formatPercent(pos.unrealized_plpc * 100)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-500 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => handleClosePosition(pos.symbol)}
                          >
                            إغلاق
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders */}
      {activeTab === 'orders' && (
        <Card className="glass">
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>لا توجد أوامر معلقة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">الرمز</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">الجانب</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">الكمية</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">نوع الأمر</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-bold text-sm">{order.symbol}</td>
                        <td className="px-4 py-3">
                          <Badge className={order.side === 'buy' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}>
                            {order.side === 'buy' ? 'شراء' : 'بيع'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-left text-sm">{order.qty}</td>
                        <td className="px-4 py-3 text-left text-sm">{order.type}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary">{order.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
