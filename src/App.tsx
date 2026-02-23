import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import { useAppStore } from '@/store'
import {
  supabase,
  isSupabaseConfigured,
  fetchAnalyses,
  fetchEvaluationScores,
  fetchSimulatorTrades,
  fetchRealTrades,
  fetchWatchlist,
  fetchUserSettings,
  saveUserSettings,
  saveSimulatorPortfolio,
  saveAutomationRun,
  saveSystemLog,
} from '@/lib/supabase'
import { runAnalysisPipeline } from '@/lib/analysisPipeline'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
  },
})

const Home = lazy(() => import('@/pages/Home'))
const Watchlist = lazy(() => import('@/pages/Watchlist'))
const AIAnalyzer = lazy(() => import('@/pages/AIAnalyzer'))
const AIEvaluator = lazy(() => import('@/pages/AIEvaluator'))
const Simulator = lazy(() => import('@/pages/Simulator'))
const RealTrading = lazy(() => import('@/pages/RealTrading'))
const Reports = lazy(() => import('@/pages/Reports'))
const Admin = lazy(() => import('@/pages/Admin'))
const Auth = lazy(() => import('@/pages/Auth'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-sm text-muted-foreground">جاري تحميل الصفحة...</div>
    </div>
  )
}

function buildDefaultSettings(userId: string) {
  return {
    id: `default-${userId}`,
    user_id: userId,
    simulatorBalance: 100000,
    riskLevel: 'MEDIUM' as const,
    autoAnalysis: true,
    analysisInterval: 60,
    minSignalScore: 75,
    maxPositionSize: 10,
    enableTelegram: true,
    enableRealTrading: false,
    alpacaMode: 'PAPER' as const,
  }
}

function AppInit() {
  const {
    user,
    setUser,
    watchlist,
    settings,
    simulatorCash,
    setAnalyses,
    addAnalysis,
    setEvaluationScores,
    addEvaluationScore,
    setSimulatorTrades,
    addSimulatorTrade,
    setWatchlist,
    setSimulatorCash,
    setRealTrades,
    simulatorTrades,
    addRealTrade,
    setSettings,
  } = useAppStore()

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const hydrateFromUser = async (currentUser: { id: string; email?: string | null }) => {
      setUser({ id: currentUser.id, email: currentUser.email || 'anonymous' })

      const [remoteAnalyses, remoteScores, remoteTrades, remoteWatchlist, remoteRealTrades, remoteSettings] = await Promise.all([
        fetchAnalyses(currentUser.id),
        fetchEvaluationScores(currentUser.id),
        fetchSimulatorTrades(currentUser.id),
        fetchWatchlist(currentUser.id),
        fetchRealTrades(currentUser.id),
        fetchUserSettings(currentUser.id),
      ])

      setAnalyses(remoteAnalyses)
      setEvaluationScores(remoteScores)
      setSimulatorTrades(remoteTrades)
      setWatchlist(remoteWatchlist)
      setRealTrades(remoteRealTrades)
      if (remoteSettings) {
        setSettings(remoteSettings)
      } else {
        const defaultSettings = buildDefaultSettings(currentUser.id)
        setSettings(defaultSettings)
        await saveUserSettings(defaultSettings)
      }

      const defaultBalance = remoteSettings?.simulatorBalance || 100000
      const openTotal = remoteTrades
        .filter(t => t.status === 'OPEN')
        .reduce((sum, t) => sum + t.total, 0)
      setSimulatorCash(Math.max(0, defaultBalance - openTotal))
    }

    const loadCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await hydrateFromUser(session.user)
      } else {
        setUser(null)
      }
    }

    loadCurrentSession().catch(console.warn)

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await hydrateFromUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('automation:lastStatus')
        localStorage.removeItem('automation:lastMessage')
        localStorage.removeItem('automation:lastStartedAt')
        localStorage.removeItem('automation:lastFinishedAt')
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setAnalyses, setEvaluationScores, setSimulatorTrades, setWatchlist, setRealTrades, setSettings, setSimulatorCash])

  useEffect(() => {
    if (!user?.id || !settings?.autoAnalysis) return
    if (!isSupabaseConfigured()) return

    const intervalMinutes = Math.max(60, Number(settings.analysisInterval || 60))
    const storageKey = `auto-analysis-last-run-${user.id}`
    const hourlyKey = `auto-analysis-last-hour-${user.id}`
    const lockKey = `auto-analysis-lock-${user.id}`

    const runIfDue = async () => {
      const now = Date.now()
      const lastRun = Number(localStorage.getItem(storageKey) || '0')
      if (watchlist.length === 0) return

      const lockUntil = Number(localStorage.getItem(lockKey) || '0')
      if (lockUntil > now) return

      if (intervalMinutes === 60) {
        const date = new Date(now)
        if (date.getMinutes() !== 0) return
        const hourToken = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
        if (localStorage.getItem(hourlyKey) === hourToken) return
        localStorage.setItem(hourlyKey, hourToken)
      } else if (now - lastRun < intervalMinutes * 60 * 1000) {
        return
      }

      localStorage.setItem(lockKey, String(now + 10 * 60 * 1000))
      const startedAt = new Date().toISOString()
      localStorage.setItem('automation:lastStartedAt', startedAt)
      localStorage.setItem('automation:lastStatus', 'STARTED')
      await saveSystemLog({
        user_id: user.id,
        action_type: 'AUTO_PIPELINE_STARTED',
        entity_type: 'AUTOMATION',
        status: 'INFO',
        payload: { scope: 'WATCHLIST', watchlistCount: watchlist.length },
      })
      try {
        const result = await runAnalysisPipeline({
          userId: user.id,
          scope: 'WATCHLIST',
          watchlist,
          settings,
          simulatorCash,
          onAnalysis: addAnalysis,
          onEvaluation: addEvaluationScore,
          onSimulatorTrade: (trade, nextCash) => {
            addSimulatorTrade(trade)
            setSimulatorCash(nextCash)
          },
          onRealTrade: addRealTrade,
          existingSimulatorTrades: simulatorTrades,
        })

        if (result.simulatorTrades.length > 0) {
          const invested = result.simulatorTrades
            .filter(t => t.status === 'OPEN')
            .reduce((sum, t) => sum + t.total, 0)
          await saveSimulatorPortfolio(user.id, result.nextSimulatorCash, invested)
        }

        await saveAutomationRun({
          user_id: user.id,
          run_type: 'AUTO_ANALYSIS',
          scope: 'WATCHLIST',
          status: 'SUCCESS',
          analyses_count: result.analyses.length,
          evaluations_count: result.scores.length,
          simulator_count: result.simulatorTrades.length,
          real_trades_count: result.realTrades.length,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        })

        localStorage.setItem('automation:lastStatus', 'SUCCESS')
        localStorage.setItem('automation:lastMessage', `A:${result.analyses.length} E:${result.scores.length} S:${result.simulatorTrades.length} R:${result.realTrades.length}`)
        localStorage.setItem('automation:lastFinishedAt', new Date().toISOString())
        await saveSystemLog({
          user_id: user.id,
          action_type: 'AUTO_PIPELINE_SUCCESS',
          entity_type: 'AUTOMATION',
          status: 'SUCCESS',
          payload: {
            analyses: result.analyses.length,
            evaluations: result.scores.length,
            simulatorTrades: result.simulatorTrades.length,
            realTrades: result.realTrades.length,
          },
        })

        localStorage.setItem(storageKey, String(now))
      } catch (error) {
        await saveAutomationRun({
          user_id: user.id,
          run_type: 'AUTO_ANALYSIS',
          scope: 'WATCHLIST',
          status: 'FAILED',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        })
        localStorage.setItem('automation:lastStatus', 'FAILED')
        localStorage.setItem('automation:lastMessage', error instanceof Error ? error.message : 'Unknown error')
        localStorage.setItem('automation:lastFinishedAt', new Date().toISOString())
        await saveSystemLog({
          user_id: user.id,
          action_type: 'AUTO_PIPELINE_FAILED',
          entity_type: 'AUTOMATION',
          status: 'FAILED',
          payload: { message: error instanceof Error ? error.message : 'Unknown error' },
        })
        throw error
      } finally {
        localStorage.removeItem(lockKey)
      }
    }

    runIfDue().catch(console.warn)
    const timer = setInterval(() => runIfDue().catch(console.warn), 60000)
    return () => clearInterval(timer)
  }, [
    user?.id,
    watchlist,
    settings,
    simulatorCash,
    simulatorTrades,
    addAnalysis,
    addEvaluationScore,
    addSimulatorTrade,
    addRealTrade,
    setSimulatorCash,
  ])

  return null
}

export default function App() {
  const user = useAppStore(state => state.user)

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppInit />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <Auth />} />
            <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
              <Route index element={<Home />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="analyzer" element={<AIAnalyzer />} />
              <Route path="evaluator" element={<AIEvaluator />} />
              <Route path="simulator" element={<Simulator />} />
              <Route path="trading" element={<RealTrading />} />
              <Route path="reports" element={<Reports />} />
              <Route path="admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
