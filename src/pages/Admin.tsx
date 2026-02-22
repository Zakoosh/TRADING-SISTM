import { useState, useEffect } from 'react'
import { Settings, Save, Eye, EyeOff, AlertTriangle, CheckCircle, Database, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { getAlpacaAccount } from '@/lib/alpaca'
import { cn } from '@/lib/utils'
import { UserSettings } from '@/types'

const DEFAULT_SETTINGS: UserSettings = {
  id: 'local',
  user_id: 'local',
  simulatorBalance: 100000,
  riskLevel: 'MEDIUM',
  autoAnalysis: false,
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
  const { settings, setSettings, analyses, evaluationScores, simulatorTrades, setAnalyses, setEvaluationScores, setSimulatorTrades, setSimulatorCash } = useAppStore()
  const [form, setForm] = useState<UserSettings>(settings || DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [testingAlpaca, setTestingAlpaca] = useState(false)
  const [alpacaStatus, setAlpacaStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [alpacaMsg, setAlpacaMsg] = useState('')
  const [activeSection, setActiveSection] = useState('api')

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const update = (key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    setSettings(form)
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

  const sections = [
    { id: 'api', label: 'مفاتيح API' },
    { id: 'trading', label: 'إعدادات التداول' },
    { id: 'telegram', label: 'Telegram' },
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
                { label: 'Bot 1 - التقارير', token: '8382222457:AAGN8IEwtE_l_FPfhAJ4S7yq2NH2lkvV_qw' },
                { label: 'Bot 2 - حالة النظام', token: '8435452935:AAHbJw0j0hh23bSedQkVB9eEGqgzEPXhooM' },
                { label: 'Bot 3 - الصفقات', token: '8519827284:AAG9o0DvzFRJ7mQFxLGBf5DhWLTIQOH3lIk' },
              ].map(bot => (
                <div key={bot.label} className="p-3 rounded-lg bg-accent/30 border border-border">
                  <div className="text-sm font-medium mb-1">{bot.label}</div>
                  <div className="text-xs font-mono text-muted-foreground">{bot.token.slice(0, 20)}...</div>
                  <Badge variant="success" className="mt-1 text-xs">مُهيأ</Badge>
                </div>
              ))}
              <div className="p-3 rounded-lg bg-accent/30 border border-border">
                <div className="text-sm font-medium mb-1">Chat ID المشترك</div>
                <div className="text-xs font-mono text-muted-foreground">6980352639</div>
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
        <Card className="glass">
          <CardHeader><CardTitle className="text-sm">معلومات النظام</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'الإصدار', value: '1.0.0' },
              { label: 'إجمالي التحليلات المحفوظة', value: analyses.length },
              { label: 'إجمالي التقييمات', value: evaluationScores.length },
              { label: 'إجمالي الصفقات (محاكاة)', value: simulatorTrades.length },
              { label: 'حالة OpenAI (ChatGPT)', value: import.meta.env.VITE_OPENAI_API_KEY ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
              { label: 'حالة Twelve Data', value: import.meta.env.VITE_TWELVE_DATA_API_KEY ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
              { label: 'حالة Alpaca', value: import.meta.env.VITE_ALPACA_API_KEY ? '✅ مُهيأ' : '⚠️ غير مُهيأ' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
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
