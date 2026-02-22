import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import Home from '@/pages/Home'
import Watchlist from '@/pages/Watchlist'
import AIAnalyzer from '@/pages/AIAnalyzer'
import AIEvaluator from '@/pages/AIEvaluator'
import Simulator from '@/pages/Simulator'
import RealTrading from '@/pages/RealTrading'
import Reports from '@/pages/Reports'
import Admin from '@/pages/Admin'
import { useAppStore } from '@/store'
import {
  supabase,
  isSupabaseConfigured,
  signInAnonymously,
  fetchAnalyses,
  fetchSimulatorTrades,
  fetchWatchlist,
} from '@/lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
  },
})

function AppInit() {
  const { setUser, setAnalyses, setSimulatorTrades, setWatchlist, setSimulatorCash, analyses } = useAppStore()

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || 'anonymous' })

        // Load data from Supabase (only if local store is empty)
        const [remoteAnalyses, remoteTrades, remoteWatchlist] = await Promise.all([
          fetchAnalyses(session.user.id),
          fetchSimulatorTrades(session.user.id),
          fetchWatchlist(session.user.id),
        ])

        if (remoteAnalyses.length > 0) setAnalyses(remoteAnalyses)
        if (remoteTrades.length > 0) {
          setSimulatorTrades(remoteTrades)
          // Recalculate cash from open trades
          const openTotal = remoteTrades
            .filter(t => t.status === 'OPEN')
            .reduce((sum, t) => sum + t.total, 0)
          setSimulatorCash(100000 - openTotal)
        }
        if (remoteWatchlist.length > 0) setWatchlist(remoteWatchlist)
      }
    })

    // Try anonymous sign-in on mount
    signInAnonymously().catch(console.warn)

    return () => subscription.unsubscribe()
  }, [setUser, setAnalyses, setSimulatorTrades, setWatchlist, setSimulatorCash])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="analyzer" element={<AIAnalyzer />} />
            <Route path="evaluator" element={<AIEvaluator />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="trading" element={<RealTrading />} />
            <Route path="reports" element={<Reports />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
