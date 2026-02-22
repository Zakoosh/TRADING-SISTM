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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
