import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  
  // SECURE CONFIGURATION:
  // We strictly use the environment variable `API_KEY` provided by Vercel or a local .env file.
  // We DO NOT hardcode the key here to prevent GitHub leaks.
  const apiKey = env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Pass the environment variable to the browser-side code
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});