import { useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Download, Send, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store'
import { sendDailyReport } from '@/lib/telegram'
import { cn, formatCurrency, formatPercent, getChangeColor, formatDate } from '@/lib/utils'
import { AIInsightPanel } from '@/components/AIInsightPanel'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts'

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

export default function Reports() {
  const { analyses, evaluationScores, simulatorTrades, simulatorCash } = useAppStore()
  const [sendingReport, setSendingReport] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'trading'>('overview')

  // Calculate stats
  const totalAnalyses = analyses.length
  const buySignals = analyses.filter(a => a.signal === 'BUY').length
  const sellSignals = analyses.filter(a => a.signal === 'SELL').length
  const holdSignals = analyses.filter(a => a.signal === 'HOLD').length
  const avgConfidence = totalAnalyses > 0
    ? analyses.reduce((s, a) => s + a.confidence, 0) / totalAnalyses
    : 0

  const passedScores = evaluationScores.filter(s => s.passed).length
  const sentSignals = evaluationScores.filter(s => s.sentToTelegram).length
  const avgScore = evaluationScores.length > 0
    ? evaluationScores.reduce((s, e) => s + e.totalScore, 0) / evaluationScores.length
    : 0

  const closedTrades = simulatorTrades.filter(t => t.status === 'CLOSED')
  const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0)
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const openTrades = simulatorTrades.filter(t => t.status === 'OPEN')
  const totalInvested = openTrades.reduce((s, t) => s + t.total, 0)
  const portfolioValue = simulatorCash + totalInvested
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0

  // Signal distribution chart
  const signalPieData = [
    { name: 'شراء', value: buySignals },
    { name: 'بيع', value: sellSignals },
    { name: 'احتفاظ', value: holdSignals },
  ].filter(d => d.value > 0)

  // Confidence distribution
  const confidenceData = [
    { range: '90-100%', count: analyses.filter(a => a.confidence >= 90).length },
    { range: '80-90%', count: analyses.filter(a => a.confidence >= 80 && a.confidence < 90).length },
    { range: '70-80%', count: analyses.filter(a => a.confidence >= 70 && a.confidence < 80).length },
    { range: '60-70%', count: analyses.filter(a => a.confidence >= 60 && a.confidence < 70).length },
    { range: '<60%', count: analyses.filter(a => a.confidence < 60).length },
  ]

  // Score distribution
  const scoreData = [
    { range: '90+', count: evaluationScores.filter(s => s.totalScore >= 90).length },
    { range: '80-89', count: evaluationScores.filter(s => s.totalScore >= 80 && s.totalScore < 90).length },
    { range: '75-79', count: evaluationScores.filter(s => s.totalScore >= 75 && s.totalScore < 80).length },
    { range: '60-74', count: evaluationScores.filter(s => s.totalScore >= 60 && s.totalScore < 75).length },
    { range: '<60', count: evaluationScores.filter(s => s.totalScore < 60).length },
  ]

  // PnL history
  const pnlHistory = closedTrades.slice(-15).reduce((acc: Array<{ date: string; cumPnl: number; pnl: number }>, trade) => {
    const prevPnl = acc[acc.length - 1]?.cumPnl || 0
    return [...acc, {
      date: trade.closedAt?.split('T')[0] || '',
      pnl: trade.pnl || 0,
      cumPnl: prevPnl + (trade.pnl || 0)
    }]
  }, [])

  const handleSendDailyReport = async () => {
    setSendingReport(true)
    try {
      const topAnalyses = analyses.slice(0, 3)
      await sendDailyReport(
        portfolioValue,
        totalPnl,
        (totalPnl / 100000) * 100,
        topAnalyses,
        simulatorTrades.length
      )
    } finally {
      setSendingReport(false)
    }
  }

  const toCsvValue = (value: string | number | boolean | null | undefined) => {
    const raw = String(value ?? '')
    return `"${raw.replace(/"/g, '""')}"`
  }

  const downloadCsv = (name: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
    const headerRow = headers.map(toCsvValue).join(',')
    const bodyRows = rows.map(row => row.map(toCsvValue).join(',')).join('\n')
    const csv = [headerRow, bodyRows].filter(Boolean).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `${name}-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    if (activeTab === 'overview') {
      downloadCsv(
        'overview-report',
        ['metric', 'value'],
        [
          ['total_analyses', totalAnalyses],
          ['buy_signals', buySignals],
          ['sell_signals', sellSignals],
          ['hold_signals', holdSignals],
          ['avg_confidence', Number(avgConfidence.toFixed(2))],
          ['avg_score', Number(avgScore.toFixed(2))],
          ['portfolio_value', Number(portfolioValue.toFixed(2))],
          ['total_pnl', Number(totalPnl.toFixed(2))],
          ['win_rate', Number(winRate.toFixed(2))],
        ]
      )
      return
    }

    if (activeTab === 'signals') {
      downloadCsv(
        'signals-report',
        ['symbol', 'name', 'signal', 'confidence', 'price', 'target_price', 'stop_loss', 'created_at'],
        analyses.map(a => [
          a.symbol,
          a.name,
          a.signal,
          Number(a.confidence.toFixed(2)),
          Number(a.price.toFixed(4)),
          Number(a.targetPrice.toFixed(4)),
          Number(a.stopLoss.toFixed(4)),
          a.createdAt,
        ])
      )
      return
    }

    downloadCsv(
      'trading-report',
      ['symbol', 'type', 'quantity', 'price', 'close_price', 'pnl', 'status', 'created_at', 'closed_at'],
      simulatorTrades.map(t => [
        t.symbol,
        t.type,
        Number(t.quantity.toFixed(6)),
        Number(t.price.toFixed(4)),
        t.closePrice !== undefined ? Number(t.closePrice.toFixed(4)) : '',
        t.pnl !== undefined ? Number(t.pnl.toFixed(4)) : '',
        t.status,
        t.createdAt,
        t.closedAt || '',
      ])
    )
  }

  const reportInsights = [
    winRate >= 55
      ? `معدل النجاح ${winRate.toFixed(1)}% ممتاز لاستمرار الأتمتة بنفس الإعدادات.`
      : `معدل النجاح ${winRate.toFixed(1)}% يحتاج ضبط حد القبول أو تخفيض حجم المراكز.`,
    avgConfidence >= 75
      ? `ثقة التحليل ${avgConfidence.toFixed(1)} تدعم توسيع نطاق التحليل.`
      : `ثقة التحليل ${avgConfidence.toFixed(1)} منخفضة نسبيًا؛ ركّز على الأسهم الأعلى سيولة.`,
    totalPnl >= 0
      ? 'الأداء المالي إيجابي؛ استمر بالمراجعة اليومية للتقارير.'
      : 'الأداء المالي سلبي؛ فعّل إرسال الإشارات القوية فقط لتقليل المخاطر.',
  ]

  return (
    <div className="space-y-6">
      <AIInsightPanel
        title="توصيات AI للتقارير"
        insights={reportInsights}
        ctaTo="/evaluator"
        ctaLabel="مراجعة التقييمات"
      />

      {/* Header Actions */}
      <div className="flex gap-3">
        {['overview', 'signals', 'trading'].map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab as typeof activeTab)}
          >
            {tab === 'overview' ? 'نظرة عامة' : tab === 'signals' ? 'الإشارات' : 'التداول'}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
        >
          <Download className="w-4 h-4" />
          تصدير CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="mr-auto gap-2"
          onClick={handleSendDailyReport}
          disabled={sendingReport}
        >
          <Send className="w-4 h-4" />
          {sendingReport ? 'جاري الإرسال...' : 'إرسال التقرير اليومي'}
        </Button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'إجمالي التحليلات', value: totalAnalyses, color: 'text-primary' },
              { label: 'الإشارات القوية', value: passedScores, color: 'text-green-500' },
              { label: 'إرسال Telegram', value: sentSignals, color: 'text-blue-500' },
              { label: 'الصفقات', value: simulatorTrades.length, color: 'text-yellow-500' },
            ].map(kpi => (
              <Card key={kpi.label} className="glass">
                <CardContent className="p-4 text-center">
                  <div className={cn('text-3xl font-bold', kpi.color)}>{kpi.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Signal Distribution */}
            <Card className="glass">
              <CardHeader><CardTitle className="text-sm">توزيع الإشارات</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={signalPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {signalPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Portfolio Value */}
            <Card className="glass">
              <CardHeader><CardTitle className="text-sm">ملخص المحفظة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'قيمة المحفظة', value: formatCurrency(portfolioValue), color: '' },
                  { label: 'الرصيد النقدي', value: formatCurrency(simulatorCash), color: '' },
                  { label: 'إجمالي الأرباح', value: formatCurrency(Math.abs(totalPnl)), color: getChangeColor(totalPnl) },
                  { label: 'معدل النجاح', value: `${winRate.toFixed(1)}%`, color: winRate > 50 ? 'text-green-500' : 'text-red-500' },
                  { label: 'متوسط ثقة التحليل', value: `${avgConfidence.toFixed(1)}%`, color: '' },
                  { label: 'متوسط نقاط التقييم', value: `${avgScore.toFixed(1)}/100`, color: '' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-1 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={cn('text-sm font-medium', item.color)}>{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'signals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confidence Distribution */}
          <Card className="glass">
            <CardHeader><CardTitle className="text-sm">توزيع مستوى الثقة</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={confidenceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Score Distribution */}
          <Card className="glass">
            <CardHeader><CardTitle className="text-sm">توزيع نقاط التقييم</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Analyses Table */}
          <Card className="glass md:col-span-2">
            <CardHeader><CardTitle className="text-sm">آخر التحليلات</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right px-4 py-2 text-xs text-muted-foreground">الرمز</th>
                      <th className="text-right px-4 py-2 text-xs text-muted-foreground">الإشارة</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground">الثقة</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground">السعر</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {analyses.slice(0, 10).map(a => (
                      <tr key={a.id} className="hover:bg-accent/30">
                        <td className="px-4 py-2 font-bold text-sm">{a.symbol}</td>
                        <td className="px-4 py-2">
                          <Badge className={a.signal === 'BUY' ? 'bg-green-500/10 text-green-500' : a.signal === 'SELL' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}>
                            {a.signal === 'BUY' ? 'شراء' : a.signal === 'SELL' ? 'بيع' : 'احتفاظ'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-left text-sm">{a.confidence.toFixed(1)}%</td>
                        <td className="px-4 py-2 text-left text-sm">{formatCurrency(a.price)}</td>
                        <td className="px-4 py-2 text-left text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'trading' && (
        <div className="space-y-6">
          {/* PnL Chart */}
          {pnlHistory.length > 0 && (
            <Card className="glass">
              <CardHeader><CardTitle className="text-sm">تطور الأرباح التراكمية</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={pnlHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="cumPnl" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Trade Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'إجمالي الصفقات', value: simulatorTrades.length },
              { label: 'صفقات مغلقة', value: closedTrades.length },
              { label: 'صفقات رابحة', value: winTrades.length },
              { label: 'معدل النجاح', value: `${winRate.toFixed(1)}%` },
            ].map(stat => (
              <Card key={stat.label} className="glass">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
