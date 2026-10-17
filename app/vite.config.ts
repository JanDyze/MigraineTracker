import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port (5173 is often taken by other projects); must match site_url in supabase/config.toml
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
})
