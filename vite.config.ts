import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // The ArticlesTab virtualization test renders thousands of rows in
    // jsdom, which can take >5s (vitest's default) when the suite runs
    // in parallel; without this it flakes intermittently.
    testTimeout: 30000,
  },
});
