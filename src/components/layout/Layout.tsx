import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'لوحة التحكم الرئيسية', subtitle: 'نظرة عامة على السوق والمحفظة' },
  '/watchlist': { title: 'قائمة المتابعة', subtitle: 'تتبع الأسهم والأصول المفضلة' },
  '/analyzer': { title: 'المحلل الذكي', subtitle: 'تحليل الأسهم بالذكاء الاصطناعي' },
  '/evaluator': { title: 'المقيّم الذكي', subtitle: 'تقييم وتصفية الإشارات' },
  '/simulator': { title: 'المحاكي الذكي', subtitle: 'تداول افتراضي بدون مخاطر' },
  '/trading': { title: 'التداول الحقيقي', subtitle: 'تنفيذ صفقات حقيقية عبر Alpaca' },
  '/reports': { title: 'التقارير والإحصائيات', subtitle: 'تحليل الأداء والنتائج' },
  '/admin': { title: 'لوحة الإدارة', subtitle: 'إعدادات النظام والتكوين' },
}

export function Layout() {
  const { sidebarOpen } = useAppStore()
  const location = useLocation()
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'نظام التداول الذكي', subtitle: '' }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Sidebar />
      <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
      <main
        className={cn(
          'transition-all duration-300 pt-16',
          sidebarOpen ? 'mr-64' : 'mr-16'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
