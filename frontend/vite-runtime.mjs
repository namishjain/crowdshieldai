import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { build, createServer, preview } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const config = {
  configFile: false,
  root,
  plugins: [react()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
  preview: { host: '127.0.0.1', port: 3000, strictPort: true },
}

const mode = process.argv[2]
if (mode === 'build') {
  await build(config)
} else if (mode === 'preview') {
  await preview(config)
} else {
  const server = await createServer(config)
  await server.listen()
  server.printUrls()
}
