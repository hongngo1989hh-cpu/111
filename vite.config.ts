import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // By default, Vite doesn't define process.env in the browser.
      // We explicitly define it here so your code `process.env.API_KEY` works.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});