import { useState, useEffect, useCallback } from 'react'
import { Star, Filter, Send, CheckCircle, XCircle, Play, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/store'
import { sendAnalysisSignal } from '@/lib/telegram'
import { saveEvaluationScore, updateEvaluationSent } from '@/lib/supabase'
import { cn, formatCurrency, getSignalBg, formatDate } from '@/lib/utils'
import { AIAnalysis, EvaluationScore } from '@/types'

// Evaluation algorithm: score each analysis on 5 factors (0-20 each = 100 total)
function evaluateAnalysis(analysis: AIAnalysis): EvaluationScore {
  const { indicators, signal } = analysis

  // 1. RSI Score (0-20)
  let rsiScore = 0
  if (signal === 'BUY') {
    if (indicators.rsi < 30) rsiScore = 20
    else if (indicators.rsi < 40) rsiScore = 15
    else if (indicators.rsi < 50) rsiScore = 10
    else if (indicators.rsi < 60) rsiScore = 5
  } else if (signal === 'SELL') {
    if (indicators.rsi > 70) rsiScore = 20
    else if (indicators.rsi > 60) rsiScore = 15
    else if (indicators.rsi > 50) rsiScore = 10
    else if (indicators.rsi > 40) rsiScore = 5
  } else {
    rsiScore = indicators.rsi > 40 && indicators.rsi < 60 ? 15 : 5
  }

  // 2. MACD Score (0-20)
  let macdScore = 0
  const macdPositive = indicators.macd > indicators.macdSignal
  if (signal === 'BUY' && macdPositive) macdScore = 20
  else if (signal === 'SELL' && !macdPositive) macdScore = 20
  else if (signal === 'HOLD') macdScore = 10
  else macdScore = 5

  // Bonus for histogram
  if (Math.abs(indicators.macdHistogram) > 0.1) {
    if ((signal === 'BUY' && indicators.macdHistogram > 0) || (signal === 'SELL' && indicators.macdHistogram < 0)) {
      macdScore = Math.min(20, macdScore + 3)
    }
  }

  // 3. ADX Score (0-20) - trend strength
  let adxScore = 0
  if (indicators.adx > 40) adxScore = 20
  else if (indicators.adx > 30) adxScore = 16
  else if (indicators.adx > 25) adxScore = 12
  else if (indicators.adx > 20) adxScore = 8
  else adxScore = 4

  // 4. Trend Score (0-20) - price vs moving averages
  let trendScore = 0
  const priceAboveSMA20 = analysis.price > indicators.sma20
  const priceAboveSMA50 = analysis.price > indicators.sma50
  const priceAboveSMA200 = analysis.price > indicators.sma200

  if (signal === 'BUY') {
    if (priceAboveSMA20) trendScore += 7
    if (priceAboveSMA50) trendScore += 7
    if (priceAboveSMA200) trendScore += 6
  } else if (signal === 'SELL') {
    if (!priceAboveSMA20) trendScore += 7
    if (!priceAboveSMA50) trendScore += 7
    if (!priceAboveSMA200) trendScore += 6
  } else {
    trendScore = 10
  }

  // 5. Momentum Score (0-20)
  let momentumScore = 0
  const momentum = indicators.momentum || 0
  if (signal === 'BUY' && momentum > 0) momentumScore = Math.min(20, 10 + momentum)
  else if (signal === 'SELL' && momentum < 0) momentumScore = Math.min(20, 10 + Math.abs(momentum))
  else momentumScore = 5

  // Also factor in confidence from AI
  const confidenceBonus = (analysis.confidence - 50) / 50 * 5
  const totalScore = Math.min(100, Math.max(0, rsiScore + macdScore + adxScore + trendScore + momentumScore + confidenceBonus))

  return {
    id: crypto.randomUUID(),
    analysis_id: analysis.id,
    symbol: analysis.symbol,
    signal: analysis.signal,
    rsiScore,
    macdScore,
    adxScore,
    trendScore,
    momentumScore,
    totalScore,
    passed: totalScore >= 75,
    sentToTelegram: false,
    createdAt: new Date().toISOString(),
  }
}

function ScoreBar({ label, score, maxScore = 20 }: { label: string; score: number; maxScore?: number }) {
  const percent = (score / maxScore) * 100
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score.toFixed(0)}/{maxScore}</span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  )
}

function EvaluationCard({ analysis, score, onSend }: {
  analysis: AIAnalysis;
  score: EvaluationScore;
  onSend: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    setSending(true)
    await onSend()
    setSending(false)
  }

  return (
    <Card className={cn(
      'glass border transition-all',
      score.passed ? 'border-green-500/30' : 'border-border'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-xs font-bold">
              {analysis.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="font-bold text-sm">{analysis.symbol}</div>
              <div className="text-xs text-muted-foreground">{analysis.name}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getSignalBg(analysis.signal)}>
              {analysis.signal === 'BUY' ? 'شراء' : analysis.signal === 'SELL' ? 'بيع' : 'احتفاظ'}
            </Badge>
            {score.passed ? (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> مقبول
              </span>
            ) : (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> مرفوض
              </span>
            )}
          </div>
        </div>

        {/* Total Score */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">الدرجة الإجمالية</span>
          <span className={cn(
            'text-2xl font-bold',
            score.totalScore >= 80 ? 'text-green-500' :
            score.totalScore >= 60 ? 'text-yellow-500' : 'text-red-500'
          )}>
            {score.totalScore.toFixed(0)}<span className="text-sm text-muted-foreground">/100</span>
          </span>
        </div>
        <Progress
          value={score.totalScore}
          className={cn('h-2 mb-3', score.totalScore >= 75 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500')}
        />

        {/* Score Breakdown */}
        <div className="space-y-2 mb-3">
          <ScoreBar label="RSI" score={score.rsiScore} />
          <ScoreBar label="MACD" score={score.macdScore} />
          <ScoreBar label="ADX (قوة الاتجاه)" score={score.adxScore} />
          <ScoreBar label="الاتجاه (SMA)" score={score.trendScore} />
          <ScoreBar label="الزخم" score={score.momentumScore} />
        </div>

        {/* Send Button */}
        {score.passed && (
          <Button
            size="sm"
            variant={score.sentToTelegram ? 'secondary' : 'default'}
            className="w-full gap-2"
            disabled={score.sentToTelegram || sending}
            onClick={handleSend}
          >
            {sending ? (
              <><RefreshCw className="w-3 h-3 animate-spin" />جاري الإرسال</>
            ) : score.sentToTelegram ? (
              <><CheckCircle className="w-3 h-3" />تم الإرسال</>
            ) : (
              <><Send className="w-3 h-3" />إرسال لـ Telegram</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function AIEvaluator() {
  const { analyses, evaluationScores, addEvaluationScore, setEvaluationScores, user } = useAppStore()
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [filterPassed, setFilterPassed] = useState<string>('ALL')
  const [scores, setScores] = useState<EvaluationScore[]>(evaluationScores)

  useEffect(() => {
    setScores(evaluationScores)
  }, [evaluationScores])

  const runEvaluation = useCallback(async () => {
    if (analyses.length === 0 || isEvaluating) return
    setIsEvaluating(true)

    const existingIds = new Set(evaluationScores.map(s => s.analysis_id))
    const unEvaluated = analyses.filter(a => !existingIds.has(a.id))

    const newScores: EvaluationScore[] = []
    for (const analysis of unEvaluated) {
      const score = evaluateAnalysis(analysis)
      newScores.push(score)
      addEvaluationScore(score)
      if (user?.id) {
        await saveEvaluationScore(score, user.id)
      }
      await new Promise(r => setTimeout(r, 100))
    }

    setIsEvaluating(false)
  }, [analyses, evaluationScores, isEvaluating, addEvaluationScore, user?.id])

  const handleSendToTelegram = useCallback(async (score: EvaluationScore, analysis: AIAnalysis) => {
    const success = await sendAnalysisSignal(analysis, score)
    if (success) {
      const updated = scores.map(s => s.id === score.id ? { ...s, sentToTelegram: true } : s)
      setScores(updated)
      setEvaluationScores(updated)
      if (user?.id) {
        await updateEvaluationSent(score.id, true)
      }
    }
  }, [scores, setEvaluationScores, user?.id])

  const sendAllStrong = useCallback(async () => {
    const strongUnSent = scores.filter(s => s.passed && !s.sentToTelegram)
    for (const score of strongUnSent) {
      const analysis = analyses.find(a => a.id === score.analysis_id)
      if (analysis) {
        await handleSendToTelegram(score, analysis)
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }, [scores, analyses, handleSendToTelegram])

  const allScoresWithAnalysis = scores.map(score => ({
    score,
    analysis: analyses.find(a => a.id === score.analysis_id),
  })).filter(item => item.analysis !== undefined)

  const filtered = allScoresWithAnalysis.filter(item => {
    if (filterPassed === 'PASSED') return item.score.passed
    if (filterPassed === 'FAILED') return !item.score.passed
    return true
  })

  const stats = {
    total: scores.length,
    passed: scores.filter(s => s.passed).length,
    failed: scores.filter(s => !s.passed).length,
    sent: scores.filter(s => s.sentToTelegram).length,
    avgScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length : 0,
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={runEvaluation} disabled={isEvaluating || analyses.length === 0} className="gap-2">
                {isEvaluating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />جاري التقييم...</>
                ) : (
                  <><Play className="w-4 h-4" />تقييم التحليلات الجديدة</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={sendAllStrong}
                disabled={stats.passed - stats.sent === 0}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                إرسال الكل القوية ({stats.passed - stats.sent})
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              الحد الأدنى للقبول: 75/100
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">إجمالي التقييمات</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.passed}</div>
            <div className="text-xs text-muted-foreground">مقبولة (≥75)</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">مرفوضة</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">مرسل لـ Telegram</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.avgScore.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">متوسط الدرجات</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'ALL', label: 'الكل' },
          { value: 'PASSED', label: '✅ مقبولة' },
          { value: 'FAILED', label: '❌ مرفوضة' },
        ].map(f => (
          <Button
            key={f.value}
            variant={filterPassed === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPassed(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-16 text-center">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">لا توجد تقييمات بعد</p>
            <p className="text-sm text-muted-foreground">قم بتشغيل المحلل الذكي أولاً ثم ابدأ التقييم</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ score, analysis }) => analysis && (
            <EvaluationCard
              key={score.id}
              analysis={analysis}
              score={score}
              onSend={() => handleSendToTelegram(score, analysis)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
