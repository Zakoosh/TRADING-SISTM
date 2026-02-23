import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('@supabase/supabase-js')) return 'vendor-supabase'
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('react-router-dom') || id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || id.includes('react')) return 'vendor-react'
          return
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
