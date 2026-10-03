import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Dev-only: přijímá PNG snímky hry z `?shot=name&wait=ms` háku (viz main.ts)
 * a ukládá je do shots/. Umožňuje headless screenshot test ve WSL (Windows
 * prohlížeč → localhost → tento sink). Do produkčního buildu nijak nezasahuje.
 */
function shotSink(): Plugin {
  return {
    name: 'shot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/shot', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const q = new URL(req.url ?? '', 'http://localhost');
        const name = (q.searchParams.get('name') ?? 'shot').replace(/[^a-z0-9_-]/gi, '_');
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const b64 = body.replace(/^data:image\/png;base64,/, '');
            mkdirSync(resolve('shots'), { recursive: true });
            writeFileSync(resolve('shots', `${name}.png`), Buffer.from(b64, 'base64'));
          } catch { /* dev-only, nevadí */ }
          res.statusCode = 200; res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  // relativní cesty => build funguje na Vercelu i v itch.io zip uploadu
  base: './',
  plugins: [shotSink()],
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    host: true,
    port: 5173,
    // projekt je na /mnt/c (WSL) - inotify tam nefunguje, bez pollingu
    // vite nevidí změny souborů a servíruje starou verzi
    watch: { usePolling: true, interval: 400 },
  },
});
