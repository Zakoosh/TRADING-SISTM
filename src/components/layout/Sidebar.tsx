import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Home,
  ListFilter,
  Brain,
  Star,
  Gamepad2,
  DollarSign,
  BarChart3,
  Settings,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', icon: Home, label: 'الرئيسية', labelEn: 'Home' },
  { to: '/watchlist', icon: ListFilter, label: 'المتابعة', labelEn: 'Watchlist' },
  { to: '/analyzer', icon: Brain, label: 'المحلل الذكي', labelEn: 'AI Analyzer' },
  { to: '/evaluator', icon: Star, label: 'المقيّم الذكي', labelEn: 'AI Evaluator' },
  { to: '/simulator', icon: Gamepad2, label: 'المحاكي الذكي', labelEn: 'Simulator' },
  { to: '/trading', icon: DollarSign, label: 'التداول الحقيقي', labelEn: 'Real Trading' },
  { to: '/reports', icon: BarChart3, label: 'التقارير', labelEn: 'Reports' },
  { to: '/admin', icon: Settings, label: 'الإدارة', labelEn: 'Admin' },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 h-full bg-card border-l border-border z-40 flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-border',
        sidebarOpen ? 'px-4 py-4 gap-3' : 'justify-center py-4'
      )}>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        {sidebarOpen && (
          <div>
            <div className="font-bold text-sm text-foreground">نظام التداول</div>
            <div className="text-xs text-muted-foreground">AI Investor</div>
          </div>
        )}
      </div>

      {/* Live Indicator */}
      {sidebarOpen && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3 h-3 text-green-500 animate-pulse" />
            <span>النظام نشط</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all text-sm font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    !sidebarOpen && 'justify-center px-0'
                  )
                }
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Toggle Button */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <><ChevronRight className="w-4 h-4" /><span>طي القائمة</span></>
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}
