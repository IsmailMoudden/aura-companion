import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

// Standalone Vite config for the Electron overlay renderer.
// Outputs to dist-overlay/ — completely separate from the TanStack Start web build.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  root: '.',
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist-overlay',
    emptyOutDir: true,
    rollupOptions: {
      input: { overlay: path.resolve(__dirname, 'overlay.html') },
    },
  },
  server: {
    port: 54322,
    strictPort: true,
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    ),
  },
});
