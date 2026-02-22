import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AIAnalysis, EvaluationScore, SimulatorTrade, UserSettings, WatchlistItem } from '../types'

interface AppState {
  // Auth
  user: { id: string; email: string } | null
  setUser: (user: { id: string; email: string } | null) => void

  // Watchlist
  watchlist: WatchlistItem[]
  setWatchlist: (items: WatchlistItem[]) => void
  addToWatchlist: (item: WatchlistItem) => void
  removeFromWatchlist: (symbol: string) => void

  // AI Analyses
  analyses: AIAnalysis[]
  setAnalyses: (analyses: AIAnalysis[]) => void
  addAnalysis: (analysis: AIAnalysis) => void

  // Evaluation Scores
  evaluationScores: EvaluationScore[]
  setEvaluationScores: (scores: EvaluationScore[]) => void
  addEvaluationScore: (score: EvaluationScore) => void

  // Simulator
  simulatorTrades: SimulatorTrade[]
  setSimulatorTrades: (trades: SimulatorTrade[]) => void
  addSimulatorTrade: (trade: SimulatorTrade) => void
  simulatorCash: number
  setSimulatorCash: (cash: number) => void

  // Settings
  settings: UserSettings | null
  setSettings: (settings: UserSettings) => void

  // UI State
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  activeAnalysisId: string | null
  setActiveAnalysisId: (id: string | null) => void
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void
  autoAnalysisActive: boolean
  setAutoAnalysisActive: (active: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),

      // Watchlist
      watchlist: [],
      setWatchlist: (watchlist) => set({ watchlist }),
      addToWatchlist: (item) => set((state) => ({
        watchlist: state.watchlist.some(w => w.symbol === item.symbol)
          ? state.watchlist
          : [...state.watchlist, item]
      })),
      removeFromWatchlist: (symbol) => set((state) => ({
        watchlist: state.watchlist.filter(w => w.symbol !== symbol)
      })),

      // Analyses
      analyses: [],
      setAnalyses: (analyses) => set({ analyses }),
      addAnalysis: (analysis) => set((state) => ({
        analyses: [analysis, ...state.analyses.slice(0, 99)]
      })),

      // Evaluation Scores
      evaluationScores: [],
      setEvaluationScores: (evaluationScores) => set({ evaluationScores }),
      addEvaluationScore: (score) => set((state) => ({
        evaluationScores: [score, ...state.evaluationScores.slice(0, 99)]
      })),

      // Simulator
      simulatorTrades: [],
      setSimulatorTrades: (simulatorTrades) => set({ simulatorTrades }),
      addSimulatorTrade: (trade) => set((state) => ({
        simulatorTrades: [trade, ...state.simulatorTrades]
      })),
      simulatorCash: 100000,
      setSimulatorCash: (simulatorCash) => set({ simulatorCash }),

      // Settings
      settings: null,
      setSettings: (settings) => set({ settings }),

      // UI State
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      activeAnalysisId: null,
      setActiveAnalysisId: (activeAnalysisId) => set({ activeAnalysisId }),
      isAnalyzing: false,
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      autoAnalysisActive: false,
      setAutoAnalysisActive: (autoAnalysisActive) => set({ autoAnalysisActive }),
    }),
    {
      name: 'trading-sistem-store',
      partialize: (state) => ({
        watchlist: state.watchlist,
        simulatorCash: state.simulatorCash,
        simulatorTrades: state.simulatorTrades,
        settings: state.settings,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
