import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env': {
      NODE_ENV: JSON.stringify('development'),
      IS_PREACT: JSON.stringify('false'),
    },
    global: 'window',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
      },
    },
  },
});
