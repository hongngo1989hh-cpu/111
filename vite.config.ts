import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  
  // Use the provided API Key. 
  // Priority: 1. Environment Variable (Vercel Settings), 2. Hardcoded Key (Fallback)
  const apiKey = env.API_KEY || "AIzaSyCHXpRVPG4tTXycbU4hfKESB_aNDb-x_aY";

  return {
    plugins: [react()],
    define: {
      // We explicitly define process.env.API_KEY so it is available in the browser code.
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});