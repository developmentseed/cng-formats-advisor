/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { plausiblePlugin } from './plausible-html.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: '/cng-formats-advisor/',
    plugins: [react(), plausiblePlugin(env.VITE_PLAUSIBLE_SRC)],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
