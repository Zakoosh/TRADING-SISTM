import { useState, useEffect, useMemo } from 'react'
import { Save, Eye, EyeOff, CheckCircle, Trash2, RefreshCw, Bot, Clock3, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { getAlpacaAccount } from '@/lib/alpaca'
import { fetchAutomationRuns, fetchSystemLogs, saveUserSettings, type AutomationRun, type SystemLog } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import { AIInsightPanel } from '@/components/AIInsightPanel'
import { UserSettings } from '@/types'

const DEFAULT_SETTINGS: UserSettings = {
  id: 'local',
  user_id: 'local',
  simulatorBalance: 100000,
  riskLevel: 'MEDIUM',
  autoAnalysis: true,
  analysisInterval: 60,
  minSignalScore: 75,
  maxPositionSize: 10,
  enableTelegram: true,
  enableRealTrading: false,
  alpacaApiKey: '',
  alpacaSecretKey: '',
  alpacaMode: 'PAPER',
  openaiApiKey: '',
  twelveDataApiKey: '',
}

interface PasswordInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

function PasswordInput({ value, onChange, placeholder }: PasswordInputProps) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function Admin() {
  const { user, settings, setSettings, analyses, evaluationScores, simulatorTrades, setAnalyses, setEvaluationScores, setSimulatorTrades, setSimulatorCash } = useAppStore()
  const [form, setForm] = useState<UserSettings>(settings || DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [testingAlpaca, setTestingAlpaca] = useState(false)
  const [alpacaStatus, setAlpacaStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [alpacaMsg, setAlpacaMsg] = useState('')
  const [activeSection, setActiveSection] = useState('api')
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STARTED' | 'SUCCESS' | 'FAILED'>('ALL')
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'FAILED'>('ALL')

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const update = (key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const nextSettings = {
      ...form,
      user_id: user?.id || form.user_id,
    }
    setSettings(nextSettings)
    if (user?.id) {
      await saveUserSettings(nextSettings)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const testAlpaca = async () => {
    if (!form.alpacaApiKey || !form.alpacaSecretKey) return
    setTestingAlpaca(true)
    setAlpacaStatus('idle')
    try {
      const baseUrl = form.alpacaMode === 'LIVE'
        ? 'https://api.alpaca.markets'
        : 'https://paper-api.alpaca.markets'
      const account = await getAlpacaAccount(form.alpacaApiKey, form.alpacaSecretKey, baseUrl)
      setAlpacaStatus('success')
      setAlpacaMsg(`✅ متصل! الرصيد: $${parseFloat(String(account.cash)).toFixed(2)} | وضع: ${form.alpacaMode}`)
    } catch (err) {
      setAlpacaStatus('error')
      setAlpacaMsg(err instanceof Error ? err.message : 'فشل الاتصال')
    } finally {
      setTestingAlpaca(false)
    }
  }

  const clearData = (type: string) => {
    if (!confirm(`هل أنت متأكد من حذف ${type === 'analyses' ? 'التحليلات' : type === 'simulator' ? 'صفقات المحاكاة' : 'التقييمات'}؟`)) return
    if (type === 'analyses') setAnalyses([])
    if (type === 'scores') setEvaluationScores([])
    if (type === 'simulator') {
      setSimulatorTrades([])
      setSimulatorCash(form.simulatorBalance)
    }
  }

  const loadAutomationRuns = async () => {
    if (!user?.id) return
    setLoadingRuns(true)
    try {
      const rows = await fetchAutomationRuns(user.id, 25)
      setAutomationRuns(rows)
    } finally {
      setLoadingRuns(false)
    }
  }

  const loadSystemLogs = async () => {
    if (!user?.id) return
    setLoadingLogs(true)
    try {
      const logs = await fetchSystemLogs(user.id, 80)
      setSystemLogs(logs)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'automation') {
      loadAutomationRuns().catch(console.warn)
    }
    if (activeSection === 'system') {
      loadSystemLogs().catch(console.warn)
    }
  }, [activeSection, user?.id])

  const runStats = useMemo(() => {
    const total = automationRuns.length
    const success = automationRuns.filter(r => r.status === 'SUCCESS').length
    const failed = automationRuns.filter(r => r.status === 'FAILED').length
    const successRate = total > 0 ? (success / total) * 100 : 0
    return { total, success, failed, successRate }
  }, [automationRuns])

  const filteredRuns = useMemo(() => {
    if (statusFilter === 'ALL') return automationRuns
    return automationRuns.filter(r => r.status === statusFilter)
  }, [automationRuns, statusFilter])

  const filteredLogs = useMemo(() => {
    if (logStatusFilter === 'ALL') return systemLogs
    return systemLogs.filter(log => log.status === logStatusFilter)
  }, [systemLogs, logStatusFilter])

  const systemInsights = [
    form.autoAnalysis
      ? `الأتمتة مفعلة كل ${form.analysisInterval} دقيقة.`
      : 'الأتمتة متوقفة؛ فعّلها لتحويل النظام إلى وضع تشغيل ذاتي.',
    runStats.total > 0
      ? `نسبة نجاح التشغيل الأخيرة ${runStats.successRate.toFixed(0)}% من ${runStats.total} محاولة.`
      : 'لا يوجد سجل تشغيل بعد؛ سيظهر تلقائيًا بعد أول دورة.',
    form.enableRealTrading
      ? 'التداول الحقيقي مفعّل؛ تأكد من مفاتيح Alpaca قبل التشغيل المستمر.'
      : 'التداول الحقيقي غير مفعّل؛ النظام يعمل بأمان على المحاكاة.',
  ]

  const formatRunType = (type: AutomationRun['run_type']) => {
    if (type === 'AUTO_ANALYSIS') return 'تحليل'
    if (type === 'AUTO_EVALUATION') return 'تقييم'
    if (type === 'AUTO_SIMULATION') return 'محاكاة'
    return 'تداول حقيقي'
  }

  const exportRunsCsv = () => {
    if (filteredRuns.length === 0) return
    const escape = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['run_type', 'status', 'scope', 'analyses_count', 'evaluations_count', 'simulator_count', 'real_trades_count', 'error_message', 'started_at', 'finished_at']
    const rows = filteredRuns.map(run => [
      run.run_type,
      run.status,
      run.scope || '',
      run.analyses_count || 0,
      run.evaluations_count || 0,
      run.simulator_count || 0,
      run.real_trades_count || 0,
      run.error_message || '',
      run.started_at || '',
      run.finished_at || '',
    ])

    const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(v => escape(v as string | number | undefined)).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `automation-runs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportLogsCsv = () => {
    if (filteredLogs.length === 0) return
    const escape = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = ['created_at', 'status', 'action_type', 'entity_type', 'entity_id', 'payload']
    const rows = filteredLogs.map(log => [
      log.created_at || '',
      log.status || 'INFO',
      log.action_type,
      log.entity_type || '',
      log.entity_id || '',
      JSON.stringify(log.payload || {}),
    ])

    const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(v => escape(v as string | number | undefined)).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `system-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const sections = [
    { id: 'api', label: 'مفاتيح API' },
    { id: 'trading', label: 'إعدادات التداول' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'automation', label: 'الأتمتة' },
    { id: 'data', label: 'إدارة البيانات' },
    { id: 'system', label: 'معلومات النظام' },
  ]

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => (
          <Button
            key={s.id}
            variant={activeSection === s.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* API Keys Section */}
      {activeSection === 'api' && (
        <div className="space-y-4">
          {/* OpenAI */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                🤖 OpenAI (ChatGPT) API
                <Badge variant="secondary">تحليل الذكاء الاصطناعي</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">OpenAI API Key</label>
                <PasswordInput
                  value={form.openaiApiKey || ''}
                  onChange={v => update('openaiApiKey', v)}
                  placeholder="sk-proj-..."
                />
              </div>
              <div className="p-2 rounded bg-accent/30 text-xs text-muted-foreground space-y-1">
                <p>• النموذج المستخدم: <strong>gpt-4o-mini</strong> (سريع واقتصادي)</p>
                <p>• تحليل ذكي عربي كامل مع RSI/MACD/ADX</p>
              </div>
            </CardContent>
          </Card>

          {/* Twelve Data */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                📈 Twelve Data API
                <Badge variant="secondary">بيانات السوق</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                <PasswordInput
                  value={form.twelveDataApiKey || ''}
                  onChange={v => update('twelveDataApiKey', v)}
                  placeholder="fc704d2d..."
                />
              </div>
              <div className="p-2 rounded bg-accent/30 text-xs text-muted-foreground space-y-1">
                <p>• الخطة الحالية: <strong>Basic (800 كريدت/يوم، 8 طلب/دقيقة)</strong></p>
                <p>• النظام يُطبّق Rate Limiting تلقائياً (8.5 ثانية بين الطلبات)</p>
                <p>• يستخدم كاش 5 دقائق لتقليل الاستهلاك</p>
              </div>
            </CardContent>
          </Card>

          {/* Alpaca */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                💰 Alpaca Trading API
                <Badge variant={form.alpacaMode === 'LIVE' ? 'danger' : 'secondary'}>
                  {form.alpacaMode === 'LIVE' ? '⚠️ حقيقي' : '🎮 ورقي'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">وضع التداول</label>
                <Select value={form.alpacaMode} onValueChange={v => update('alpacaMode', v as 'PAPER' | 'LIVE')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAPER">🎮 Paper Trading (تجريبي)</SelectItem>
                    <SelectItem value="LIVE">💰 Live Trading (حقيقي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                <PasswordInput
                  value={form.alpacaApiKey || ''}
                  onChange={v => update('alpacaApiKey', v)}
                  placeholder="PK..."
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Secret Key</label>
                <PasswordInput
                  value={form.alpacaSecretKey || ''}
                  onChange={v => update('alpacaSecretKey', v)}
                  placeholder="..."
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testAlpaca}
                disabled={testingAlpaca || !form.alpacaApiKey || !form.alpacaSecretKey}
                className="gap-2"
              >
                {testingAlpaca ? <><RefreshCw className="w-3 h-3 animate-spin" />جاري الاختبار</> : 'اختبار الاتصال'}
              </Button>
              {alpacaMsg && (
                <div className={cn('text-xs p-2 rounded', alpacaStatus === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>
                  {alpacaMsg}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trading Settings */}
      {activeSection === 'trading' && (
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader><CardTitle className="text-sm">إعدادات التداول والمخاطر</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <input
                    type="checkbox"
                    id="autoAnalysis"
                    checked={form.autoAnalysis}
                    onChange={e => update('autoAnalysis', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="autoAnalysis" className="text-sm cursor-pointer">تشغيل التحليل التلقائي</label>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">فاصل الأتمتة (دقيقة)</label>
                  <Input
                    type="number"
                    value={form.analysisInterval}
                    onChange={e => update('analysisInterval', Math.max(60, parseFloat(e.target.value || '60')))}
                    min="60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">رأس المال الافتراضي ($)</label>
                  <Input
                    type="number"
                    value={form.simulatorBalance}
                    onChange={e => update('simulatorBalance', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">مستوى المخاطرة</label>
                  <Select value={form.riskLevel} onValueChange={v => update('riskLevel', v as 'LOW' | 'MEDIUM' | 'HIGH')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">منخفض 🟢</SelectItem>
                      <SelectItem value="MEDIUM">متوسط 🟡</SelectItem>
                      <SelectItem value="HIGH">عالي 🔴</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الحد الأدنى لدرجة الإشارة</label>
                  <Input
                    type="number"
                    value={form.minSignalScore}
                    onChange={e => update('minSignalScore', parseFloat(e.target.value))}
                    min="0" max="100"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الحد الأقصى لحجم المركز (%)</label>
                  <Input
                    type="number"
                    value={form.maxPositionSize}
                    onChange={e => update('maxPositionSize', parseFloat(e.target.value))}
                    min="1" max="100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <input
                  type="checkbox"
                  id="enableRealTrading"
                  checked={form.enableRealTrading}
                  onChange={e => update('enableRealTrading', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="enableRealTrading" className="text-sm cursor-pointer">
                  تفعيل التداول الحقيقي (Alpaca)
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSection === 'automation' && (
        <div className="space-y-4">
          <AIInsightPanel title="مساعد الإدارة الذكي" insights={systemInsights} ctaTo="/reports" ctaLabel="فتح التقارير" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{runStats.total}</div>
                <div className="text-xs text-muted-foreground">إجمالي التشغيلات</div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{runStats.success}</div>
                <div className="text-xs text-muted-foreground">ناجحة</div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{runStats.failed}</div>
                <div className="text-xs text-muted-foreground">فاشلة</div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{runStats.successRate.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">نسبة النجاح</div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><Bot className="w-4 h-4" /> سجل التشغيل الآلي</span>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={value => setStatusFilter(value as typeof statusFilter)}>
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">كل الحالات</SelectItem>
                      <SelectItem value="SUCCESS">ناجح</SelectItem>
                      <SelectItem value="FAILED">فشل</SelectItem>
                      <SelectItem value="STARTED">قيد التشغيل</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportRunsCsv} disabled={filteredRuns.length === 0}>
                    <Download className="w-3.5 h-3.5 ml-1" />تصدير
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadAutomationRuns().catch(console.warn)} disabled={loadingRuns}>
                    <RefreshCw className={cn('w-3.5 h-3.5 ml-1', loadingRuns && 'animate-spin')} />تحديث
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredRuns.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">لا يوجد تشغيلات محفوظة بعد.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-right px-3 py-2">النوع</th>
                        <th className="text-right px-3 py-2">الحالة</th>
                        <th className="text-right px-3 py-2">النطاق</th>
                        <th className="text-left px-3 py-2">النتائج</th>
                        <th className="text-left px-3 py-2">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRuns.map(run => (
                        <tr key={run.id || `${run.started_at}-${run.run_type}`} className="hover:bg-accent/30">
                          <td className="px-3 py-2 text-sm">{formatRunType(run.run_type)}</td>
                          <td className="px-3 py-2">
                            <Badge className={run.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : run.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}>
                              {run.status === 'SUCCESS' ? 'ناجح' : run.status === 'FAILED' ? 'فشل' : 'قيد التشغيل'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{run.scope || '-'}</td>
                          <td className="px-3 py-2 text-left text-xs">
                            A:{run.analyses_count || 0} / E:{run.evaluations_count || 0} / S:{run.simulator_count || 0} / R:{run.real_trades_count || 0}
                          </td>
                          <td className="px-3 py-2 text-left text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock3 className="w-3 h-3" />
                              {run.started_at ? formatDate(run.started_at) : '-'}
                            </div>
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
      )}

      {/* Telegram Settings */}
      {activeSection === 'telegram' && (
        <Card className="glass">
          <CardHeader><CardTitle className="text-sm">إعدادات Telegram</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <input
                type="checkbox"
                id="enableTelegram"
                checked={form.enableTelegram}
                onChange={e => update('enableTelegram', e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="enableTelegram" className="text-sm cursor-pointer">تفعيل إشعارات Telegram</label>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Bot 1 - التقارير', envKey: 'VITE_TELEGRAM_BOT_REPORTS_TOKEN' },
                { label: 'Bot 2 - حالة النظام', envKey: 'VITE_TELEGRAM_BOT_STATUS_TOKEN' },
                { label: 'Bot 3 - الصفقات', envKey: 'VITE_TELEGRAM_BOT_TRADES_TOKEN' },
              ].map(bot => {
                const configured = !!import.meta.env[bot.envKey]
                return (
                  <div key={bot.label} className="p-3 rounded-lg bg-accent/30 border border-border">
                    <div className="text-sm font-medium mb-1">{bot.label}</div>
                    <div className="text-xs font-mono text-muted-foreground">{bot.envKey}</div>
                    <Badge variant={configured ? 'success' : 'secondary'} className="mt-1 text-xs">
                      {configured ? 'مُهيأ' : 'غير مُهيأ'}
                    </Badge>
                  </div>
                )
              })}
              <div className="p-3 rounded-lg bg-accent/30 border border-border">
                <div className="text-sm font-medium mb-1">Chat ID المشترك</div>
                <div className="text-xs font-mono text-muted-foreground">
                  {import.meta.env.VITE_TELEGRAM_CHAT_ID ? '••••••••••' : 'غير مُهيأ'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Management */}
      {activeSection === 'data' && (
        <Card className="glass">
          <CardHeader><CardTitle className="text-sm">إدارة البيانات المحلية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { type: 'analyses', label: 'التحليلات', count: analyses.length, color: 'text-blue-500' },
              { type: 'scores', label: 'التقييمات', count: evaluationScores.length, color: 'text-yellow-500' },
              { type: 'simulator', label: 'صفقات المحاكاة', count: simulatorTrades.length, color: 'text-green-500' },
            ].map(item => (
              <div key={item.type} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className={cn('text-sm mr-2', item.color)}>({item.count} سجل)</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-500/20 hover:bg-red-500/10 gap-2"
                  onClick={() => clearData(item.type)}
                  disabled={item.count === 0}
                >
                  <Trash2 className="w-3 h-3" />
                  حذف
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      {activeSection === 'system' && (
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader><CardTitle className="text-sm">معلومات النظام</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'الإصدار', value: '1.1.0' },
                { label: 'إجمالي التحليلات المحفوظة', value: analyses.length },
                { label: 'إجمالي التقييمات', value: evaluationScores.length },
                { label: 'إجمالي الصفقات (محاكاة)', value: simulatorTrades.length },
                { label: 'سجلات النظام', value: systemLogs.length },
                { label: 'حالة OpenAI (ChatGPT)', value: (form.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY) ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
                { label: 'حالة Twelve Data', value: (form.twelveDataApiKey || import.meta.env.VITE_TWELVE_DATA_API_KEY) ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
                { label: 'حالة Alpaca', value: (form.alpacaApiKey || import.meta.env.VITE_ALPACA_API_KEY) ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>سجل حركات النظام</span>
                <div className="flex items-center gap-2">
                  <Select value={logStatusFilter} onValueChange={value => setLogStatusFilter(value as typeof logStatusFilter)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">الكل</SelectItem>
                      <SelectItem value="INFO">معلومة</SelectItem>
                      <SelectItem value="SUCCESS">نجاح</SelectItem>
                      <SelectItem value="FAILED">فشل</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportLogsCsv} disabled={filteredLogs.length === 0}>
                    <Download className="w-3.5 h-3.5 ml-1" />تصدير
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadSystemLogs().catch(console.warn)} disabled={loadingLogs}>
                    <RefreshCw className={cn('w-3.5 h-3.5 ml-1', loadingLogs && 'animate-spin')} />تحديث
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLogs.length === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">لا توجد سجلات نظام بعد.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-right px-3 py-2">الحالة</th>
                        <th className="text-right px-3 py-2">النشاط</th>
                        <th className="text-right px-3 py-2">الكيان</th>
                        <th className="text-left px-3 py-2">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLogs.map(log => (
                        <tr key={log.id || `${log.created_at}-${log.action_type}`} className="hover:bg-accent/30">
                          <td className="px-3 py-2">
                            <Badge className={log.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : log.status === 'FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}>
                              {log.status === 'SUCCESS' ? 'ناجح' : log.status === 'FAILED' ? 'فشل' : 'معلومة'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm">{log.action_type}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{log.entity_type || '-'} {log.entity_id ? `(${log.entity_id})` : ''}</td>
                          <td className="px-3 py-2 text-left text-xs text-muted-foreground">{log.created_at ? formatDate(log.created_at) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3 sticky bottom-4">
        <Button onClick={handleSave} className="gap-2 shadow-lg">
          {saved ? <><CheckCircle className="w-4 h-4" />تم الحفظ!</> : <><Save className="w-4 h-4" />حفظ الإعدادات</>}
        </Button>
      </div>
    </div>
  )
}
