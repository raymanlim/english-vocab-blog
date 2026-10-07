import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 使用相对 base，便于部署到任意静态托管子路径（含 WorkBuddy App Publishing）。
// 路由采用 hash 模式，因此不需要服务端 SPA fallback 支持。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1200,
  },
});
