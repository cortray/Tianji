import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Web 形态构建配置：浏览器直接运行（无 Electron 壳）
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'out/web'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'next-themes', 'sonner'],
          radix: ['radix-ui'],
          icons: ['lucide-react'],
          markdown: ['marked']
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true
  }
})
