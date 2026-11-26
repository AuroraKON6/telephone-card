import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 默认指向本地 cardshop 后端（联调远程 ECS 时在本地 .env.local 配置 VITE_PROXY_TARGET）
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8307';

  const proxyConfig = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
    },
    '/health': {
      target: proxyTarget,
      changeOrigin: true,
    },
    '/admin': {
      target: proxyTarget,
      changeOrigin: true,
    },
    '/site-config.json': {
      target: proxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5178,
      proxy: proxyConfig,
    },
    preview: {
      host: '127.0.0.1',
      port: 4178,
      proxy: proxyConfig,
    },
  };
});
