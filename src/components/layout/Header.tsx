import { useEffect, useMemo, useState } from 'react'
import { Bell, LogOut, Wifi, WifiOff, Bot, Clock3, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/supabase'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { sidebarOpen, analyses, settings, user } = useAppStore()
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const autoAnalysisActive = !!settings?.autoAnalysis
  const analysisInterval = Math.max(60, Number(settings?.analysisInterval || 60))

  const automationStatus = localStorage.getItem('automation:lastStatus') || 'IDLE'
  const automationMessage = localStorage.getItem('automation:lastMessage') || 'لا يوجد تشغيل حتى الآن'
  const lastFinishedAt = localStorage.getItem('automation:lastFinishedAt')

  const nextRunLabel = useMemo(() => {
    const lastRun = Number(localStorage.getItem(`auto-analysis-last-run-${useAppStore.getState().user?.id || 'anon'}`) || '0')
    if (!autoAnalysisActive) return 'متوقف'
    if (!lastRun) return 'قريبًا'

    const nextRun = lastRun + analysisInterval * 60 * 1000
    const diff = Math.max(0, nextRun - tick)
    const min = Math.floor(diff / 60000)
    return `${min} دقيقة`
  }, [autoAnalysisActive, analysisInterval, tick])

  const recentSignals = analyses.filter(a => {
    const age = Date.now() - new Date(a.createdAt).getTime()
    return age < 3600000 // last hour
  }).length

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm',
        'transition-all duration-300',
        sidebarOpen ? 'mr-64' : 'mr-16'
      )}
    >
      <div className="flex items-center justify-between px-6 h-16">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-border bg-card/50">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">{automationMessage}</span>
            {automationStatus === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            {automationStatus === 'FAILED' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
            {lastFinishedAt && <span className="text-[10px] text-muted-foreground">{new Date(lastFinishedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>

          {/* Auto Analysis Status */}
          <div className={cn(
            'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border',
            autoAnalysisActive
              ? 'text-green-500 border-green-500/20 bg-green-500/10'
              : 'text-muted-foreground border-border'
          )}>
            {autoAnalysisActive ? (
              <><Wifi className="w-3 h-3" /><span>تحليل تلقائي نشط</span></>
            ) : (
              <><WifiOff className="w-3 h-3" /><span>تحليل يدوي</span></>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
            <Clock3 className="w-3 h-3" />
            <span>القادم: {nextRunLabel}</span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {recentSignals > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center text-[10px] p-0 rounded-full"
              >
                {recentSignals}
              </Badge>
            )}
          </Button>

          {/* User */}
          <Button variant="ghost" size="icon" title={user?.email || 'User'} onClick={() => signOut().catch(console.warn)}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
