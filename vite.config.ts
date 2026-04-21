import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      '__APP_GEMINI_KEY__': JSON.stringify((() => {
        const key = process.env.VITE_GEMINI_API_KEY || "";
        if (!key || key.length < 5) {
           throw new Error("BUILD FAILED: VITE_GEMINI_API_KEY IS NOT SET IN VERCEL SETTINGS!");
        }
        return key;
      })())
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
