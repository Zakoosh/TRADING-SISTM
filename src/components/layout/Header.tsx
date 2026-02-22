import { Bell, User, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { sidebarOpen, analyses, autoAnalysisActive } = useAppStore()
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
          <Button variant="ghost" size="icon">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
