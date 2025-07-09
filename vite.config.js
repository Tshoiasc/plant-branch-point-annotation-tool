import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

// [INTERNAL_ACTION: Fetching current time via mcp.server_time.]
// {{CHENGQI:
// Action: Added; Timestamp: 2025-06-19 19:48:29 +08:00; Reason: 项目初始化任务，创建Vite配置文件支持现代Web开发;
// }}
// {{START MODIFICATIONS}}
export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  server: {
    port: 3000,
    open: true,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vite']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@ui': '/src/ui',
      '@utils': '/src/utils',
      '@styles': '/src/styles'
    }
  },
  optimizeDeps: {
    include: []
  }
});
// {{END MODIFICATIONS}} 