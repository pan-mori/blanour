import { defineConfig } from 'vite';

export default defineConfig({
  // relativní cesty => build funguje na Vercelu i v itch.io zip uploadu
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    host: true,
    port: 5173,
    // projekt je na /mnt/c (WSL) — inotify tam nefunguje, bez pollingu
    // vite nevidí změny souborů a servíruje starou verzi
    watch: { usePolling: true, interval: 400 },
  },
});
