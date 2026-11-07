import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { devBackendPlugin } from './server/devBackend';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, val] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }

  return {
    plugins: [react(), devBackendPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      target: 'esnext',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
          },
        },
      },
    },
  };
});
