import { useState, useCallback, useEffect } from 'react'
import { Brain, Play, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { analyzeStockWithAI, analyzeMultipleStocks } from '@/lib/gemini'
import { DEFAULT_STOCKS, fetchMarketData } from '@/lib/marketData'
import { sendStatusUpdate } from '@/lib/telegram'
import { cn, formatCurrency, formatPercent, getSignalBg, formatDate } from '@/lib/utils'
import { AIAnalysis, MarketType } from '@/types'

const SIGNAL_ICONS = {
  BUY: TrendingUp,
  SELL: TrendingDown,
  HOLD: Minus,
}

const SIGNAL_LABELS = {
  BUY: 'شراء',
  SELL: 'بيع',
  HOLD: 'احتفاظ',
}

const CONFIDENCE_COLORS = {
  HIGH: 'text-green-500',
  MEDIUM: 'text-yellow-500',
  LOW: 'text-red-500',
}

function AnalysisCard({ analysis, expanded, onToggle }: {
  analysis: AIAnalysis;
  expanded: boolean;
  onToggle: () => void;
}) {
  const SignalIcon = SIGNAL_ICONS[analysis.signal]

  return (
    <Card className={cn(
      'glass border transition-all duration-200',
      analysis.signal === 'BUY' ? 'border-green-500/20 hover:glow-green' :
      analysis.signal === 'SELL' ? 'border-red-500/20 hover:glow-red' : 'border-border'
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-sm font-bold">
              {analysis.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="font-bold text-sm">{analysis.symbol}</div>
              <div className="text-xs text-muted-foreground">{analysis.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getSignalBg(analysis.signal)}>
              <SignalIcon className="w-3 h-3 ml-1" />
              {SIGNAL_LABELS[analysis.signal]}
            </Badge>
            <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Price & Confidence */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-xs text-muted-foreground mb-1">السعر</div>
            <div className="font-bold text-sm">{formatCurrency(analysis.price)}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-xs text-muted-foreground mb-1">الهدف</div>
            <div className="font-bold text-sm text-green-500">{formatCurrency(analysis.targetPrice)}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/50">
            <div className="text-xs text-muted-foreground mb-1">وقف الخسارة</div>
            <div className="font-bold text-sm text-red-500">{formatCurrency(analysis.stopLoss)}</div>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-muted-foreground">مستوى الثقة</span>
            <span className={cn('text-xs font-bold', CONFIDENCE_COLORS[analysis.confidenceLevel])}>
              {analysis.confidence.toFixed(1)}% ({analysis.confidenceLevel === 'HIGH' ? 'عالي' : analysis.confidenceLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'})
            </span>
          </div>
          <Progress value={analysis.confidence} className="h-1.5" />
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="space-y-3 border-t border-border pt-3 mt-3">
            {/* Technical Indicators */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">المؤشرات الفنية</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'RSI', value: analysis.indicators.rsi.toFixed(1), color: analysis.indicators.rsi < 30 ? 'text-green-500' : analysis.indicators.rsi > 70 ? 'text-red-500' : 'text-foreground' },
                  { label: 'MACD', value: analysis.indicators.macd.toFixed(4), color: analysis.indicators.macd > 0 ? 'text-green-500' : 'text-red-500' },
                  { label: 'ADX', value: analysis.indicators.adx.toFixed(1), color: analysis.indicators.adx > 25 ? 'text-primary' : 'text-muted-foreground' },
                  { label: 'SMA50', value: formatCurrency(analysis.indicators.sma50), color: 'text-foreground' },
                  { label: 'BB Upper', value: formatCurrency(analysis.indicators.bollingerUpper), color: 'text-foreground' },
                  { label: 'BB Lower', value: formatCurrency(analysis.indicators.bollingerLower), color: 'text-foreground' },
                ].map(ind => (
                  <div key={ind.label} className="flex justify-between p-2 rounded bg-accent/50 text-xs">
                    <span className="text-muted-foreground">{ind.label}</span>
                    <span className={cn('font-mono font-medium', ind.color)}>{ind.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Text */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">التحليل</div>
              <p className="text-xs text-muted-foreground bg-accent/30 rounded-lg p-3 leading-relaxed">
                {analysis.reasoning}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">التحليل الفني</div>
                <p className="text-xs text-muted-foreground">{analysis.technicalSummary}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">التحليل الأساسي</div>
                <p className="text-xs text-muted-foreground">{analysis.fundamentalSummary}</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(analysis.createdAt)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AIAnalyzer() {
  const { analyses, addAnalysis, setIsAnalyzing, isAnalyzing, autoAnalysisActive, setAutoAnalysisActive } = useAppStore()
  const [selectedMarket, setSelectedMarket] = useState<MarketType>('US')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [filterSignal, setFilterSignal] = useState<string>('ALL')

  const runAnalysis = useCallback(async (market?: MarketType) => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setProgress(0)
    setStatusMsg('جاري تحميل بيانات السوق...')

    try {
      const targetMarket = market || selectedMarket
      const defaultStocks = DEFAULT_STOCKS[targetMarket]?.slice(0, 8) || []
      const stockList = defaultStocks.map(s => ({ ...s, market: targetMarket }))

      setStatusMsg('جاري تحديث الأسعار...')
      setProgress(20)

      const stocksWithPrices = await fetchMarketData(stockList)
      setProgress(40)

      setStatusMsg('جاري تحليل الأسهم بالذكاء الاصطناعي...')

      const results: AIAnalysis[] = []
      for (let i = 0; i < stocksWithPrices.length; i++) {
        const stock = stocksWithPrices[i]
        setStatusMsg(`تحليل ${stock.symbol}... (${i + 1}/${stocksWithPrices.length})`)
        const analysis = await analyzeStockWithAI(stock.symbol, stock.name, targetMarket, stock.price)
        results.push(analysis)
        addAnalysis(analysis)
        setProgress(40 + ((i + 1) / stocksWithPrices.length) * 50)
        await new Promise(r => setTimeout(r, 300))
      }

      setProgress(100)
      setStatusMsg(`اكتمل التحليل! ${results.length} سهم تم تحليله`)

      // Send status to Telegram
      const strongCount = results.filter(r => r.confidence >= 75).length
      await sendStatusUpdate(results.length, strongCount, 0, results.reduce((s, r) => s + r.confidence, 0) / results.length, true)

    } catch (err) {
      setStatusMsg('حدث خطأ في التحليل')
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing, selectedMarket, addAnalysis, setIsAnalyzing])

  // Auto analysis every hour
  useEffect(() => {
    if (!autoAnalysisActive) return
    const interval = setInterval(() => {
      const now = new Date()
      if (now.getMinutes() === 0) {
        runAnalysis()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [autoAnalysisActive, runAnalysis])

  const filteredAnalyses = analyses.filter(a =>
    filterSignal === 'ALL' || a.signal === filterSignal
  )

  const stats = {
    total: analyses.length,
    buy: analyses.filter(a => a.signal === 'BUY').length,
    sell: analyses.filter(a => a.signal === 'SELL').length,
    hold: analyses.filter(a => a.signal === 'HOLD').length,
    avgConfidence: analyses.length > 0 ? analyses.reduce((s, a) => s + a.confidence, 0) / analyses.length : 0,
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <Select value={selectedMarket} onValueChange={v => setSelectedMarket(v as MarketType)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 الأسهم الأمريكية</SelectItem>
                  <SelectItem value="TR">🇹🇷 الأسهم التركية</SelectItem>
                  <SelectItem value="CRYPTO">💎 العملات الرقمية</SelectItem>
                  <SelectItem value="COMMODITY">🥇 السلع</SelectItem>
                  <SelectItem value="INDEX">📊 المؤشرات</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => runAnalysis()}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /><span>جاري التحليل...</span></>
                ) : (
                  <><Play className="w-4 h-4" /><span>بدء التحليل</span></>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoAnalysisActive(!autoAnalysisActive)}
                className={cn(
                  'flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all',
                  autoAnalysisActive
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'text-muted-foreground border-border hover:bg-accent'
                )}
              >
                <Zap className="w-4 h-4" />
                {autoAnalysisActive ? 'تحليل تلقائي: نشط' : 'تحليل تلقائي: متوقف'}
              </button>
            </div>
          </div>

          {/* Progress */}
          {isAnalyzing && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusMsg}</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
            </div>
          )}
          {!isAnalyzing && statusMsg && (
            <div className="mt-3 text-xs text-muted-foreground bg-accent/30 rounded-lg p-2">
              {statusMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.buy}</div>
            <div className="text-xs text-muted-foreground">شراء</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.sell}</div>
            <div className="text-xs text-muted-foreground">بيع</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.hold}</div>
            <div className="text-xs text-muted-foreground">احتفاظ</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.avgConfidence.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">متوسط الثقة</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['ALL', 'BUY', 'SELL', 'HOLD'].map(signal => (
          <Button
            key={signal}
            variant={filterSignal === signal ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSignal(signal)}
            className={cn(
              signal === 'BUY' && filterSignal === 'BUY' && 'bg-green-600 hover:bg-green-700',
              signal === 'SELL' && filterSignal === 'SELL' && 'bg-red-600 hover:bg-red-700',
            )}
          >
            {signal === 'ALL' ? 'الكل' : signal === 'BUY' ? 'شراء' : signal === 'SELL' ? 'بيع' : 'احتفاظ'}
          </Button>
        ))}
      </div>

      {/* Analyses Grid */}
      {filteredAnalyses.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد تحليلات بعد</p>
            <p className="text-sm text-muted-foreground">اضغط "بدء التحليل" لتحليل الأسهم</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAnalyses.map(analysis => (
            <AnalysisCard
              key={analysis.id}
              analysis={analysis}
              expanded={expandedId === analysis.id}
              onToggle={() => setExpandedId(expandedId === analysis.id ? null : analysis.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
