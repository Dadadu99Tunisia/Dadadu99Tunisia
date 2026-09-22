import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    // Un seul bundle : la page est aussi publiee en fichier unique.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
