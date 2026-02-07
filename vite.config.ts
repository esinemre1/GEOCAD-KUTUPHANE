import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/cbs': {
          target: 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cbs/, ''),
          secure: false
        },
        '/api/wms': {
          target: 'https://parselsorgu.tkgm.gov.tr/servis/services/wms',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/wms/, ''),
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              proxyReq.setHeader('Referer', 'https://parselsorgu.tkgm.gov.tr/');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            });
          }
        }
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
