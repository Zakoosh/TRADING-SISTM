import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, DollarSign, Brain, Gamepad2, Activity, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/store'
import { fetchMarketData, DEFAULT_STOCKS } from '@/lib/marketData'
import { cn, formatCurrency, formatPercent, getChangeColor, getSignalBg } from '@/lib/utils'
import { Stock } from '@/types'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'primary' }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType;
  trend?: number; color?: string
}) {
  return (
    <Card className="glass hover:glow-green transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2 rounded-lg', `bg-${color}/10`)}>
            <Icon className={cn('w-5 h-5', `text-${color}`)} />
          </div>
          {trend !== undefined && (
            <span className={cn('text-sm font-medium', getChangeColor(trend))}>
              {formatPercent(trend)}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}

function MiniChart({ positive }: { positive: boolean }) {
  const data = Array.from({ length: 20 }, (_, i) => ({
    i,
    v: 50 + (positive ? 1 : -1) * i * 0.5 + (Math.random() - 0.5) * 5
  }))
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={positive ? '#22c55e' : '#ef4444'}
          fill={positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function Home() {
  const { analyses, evaluationScores, simulatorCash, simulatorTrades } = useAppStore()
  const [topStocks, setTopStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadMarketData = useCallback(async () => {
    setLoading(true)
    try {
      const usStocks = DEFAULT_STOCKS.US.slice(0, 6).map(s => ({ ...s, market: 'US' as const }))
      const cryptos = DEFAULT_STOCKS.CRYPTO.slice(0, 4).map(s => ({ ...s, market: 'CRYPTO' as const }))
      const stocks = await fetchMarketData([...usStocks, ...cryptos])
      setTopStocks(stocks)
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketData()
    const interval = setInterval(loadMarketData, 30000)
    return () => clearInterval(interval)
  }, [loadMarketData])

  // Portfolio stats
  const openTrades = simulatorTrades.filter(t => t.status === 'OPEN')
  const closedTrades = simulatorTrades.filter(t => t.status === 'CLOSED')
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalInvested = openTrades.reduce((sum, t) => sum + t.total, 0)
  const portfolioValue = simulatorCash + totalInvested

  const recentAnalyses = analyses.slice(0, 5)
  const strongSignals = evaluationScores.filter(s => s.passed).length
  const avgScore = evaluationScores.length > 0
    ? evaluationScores.reduce((sum, s) => sum + s.totalScore, 0) / evaluationScores.length
    : 0

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="قيمة المحفظة"
          value={formatCurrency(portfolioValue)}
          subtitle={`نقدي: ${formatCurrency(simulatorCash)}`}
          icon={DollarSign}
          trend={(portfolioValue - 100000) / 100000 * 100}
          color="primary"
        />
        <StatCard
          title="إجمالي التحليلات"
          value={analyses.length.toString()}
          subtitle={`${recentAnalyses.length} في الساعة الأخيرة`}
          icon={Brain}
          color="blue-500"
        />
        <StatCard
          title="الإشارات القوية"
          value={strongSignals.toString()}
          subtitle={`متوسط الدرجات: ${avgScore.toFixed(0)}/100`}
          icon={Activity}
          color="green-500"
        />
        <StatCard
          title="الأرباح الإجمالية"
          value={formatCurrency(Math.abs(totalPnl))}
          subtitle={`${closedTrades.length} صفقة مغلقة`}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          trend={totalPnl / 100000 * 100}
          color={totalPnl >= 0 ? 'green-500' : 'red-500'}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Market Overview */}
        <div className="lg:col-span-2">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">نظرة السوق</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMarketData}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                <span className="text-xs text-muted-foreground">
                  {lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {topStocks.map((stock) => (
                  <div key={stock.symbol} className="flex items-center justify-between px-6 py-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-foreground">
                        {stock.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">{stock.symbol}</div>
                        <div className="text-xs text-muted-foreground">{stock.name}</div>
                      </div>
                    </div>
                    <div className="w-24">
                      <MiniChart positive={stock.changePercent >= 0} />
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatCurrency(stock.price)}</div>
                      <div className={cn('text-xs font-medium', getChangeColor(stock.changePercent))}>
                        {formatPercent(stock.changePercent)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Signals */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">إجراءات سريعة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/analyzer">
                <Button variant="outline" className="w-full justify-start gap-3 h-11">
                  <Brain className="w-4 h-4 text-primary" />
                  <span>بدء تحليل ذكي</span>
                  <ArrowUpRight className="w-3 h-3 mr-auto" />
                </Button>
              </Link>
              <Link to="/simulator">
                <Button variant="outline" className="w-full justify-start gap-3 h-11">
                  <Gamepad2 className="w-4 h-4 text-blue-500" />
                  <span>فتح صفقة محاكاة</span>
                  <ArrowUpRight className="w-3 h-3 mr-auto" />
                </Button>
              </Link>
              <Link to="/trading">
                <Button variant="outline" className="w-full justify-start gap-3 h-11">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span>التداول الحقيقي</span>
                  <ArrowUpRight className="w-3 h-3 mr-auto" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Signals */}
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">آخر الإشارات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentAnalyses.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  لا توجد تحليلات بعد
                </div>
              ) : (
                recentAnalyses.map((analysis) => (
                  <div key={analysis.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium">{analysis.symbol}</div>
                      <div className="text-xs text-muted-foreground">{analysis.confidence.toFixed(0)}% ثقة</div>
                    </div>
                    <Badge className={getSignalBg(analysis.signal)}>
                      {analysis.signal === 'BUY' ? 'شراء' : analysis.signal === 'SELL' ? 'بيع' : 'احتفاظ'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Simulator Summary */}
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">أداء المحاكي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">صفقات مفتوحة</span>
                <span className="font-medium">{openTrades.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">نسبة الاستثمار</span>
                <span className="font-medium">
                  {portfolioValue > 0 ? ((totalInvested / portfolioValue) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <Progress value={portfolioValue > 0 ? (totalInvested / portfolioValue) * 100 : 0} className="h-2" />
              <div className={cn('text-sm font-medium text-center', totalPnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)} إجمالي الأرباح
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
