import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Fallback to upstream for any assets we did not mirror
      '^/(css|js|img|images|fonts|storage)/': {
        target: 'https://efendi.qrmenus.uz',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
