import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

/**
 * Auto-concatenate js/parts/*.js → js/app.js + js/enhancements.js
 * Watches part files in dev and rebuilds on change.
 */
function concatParts(): Plugin {
  const partsDir = resolve(__dirname, 'js/parts');

  function rebuild() {
    if (!existsSync(partsDir)) return;
    const files = readdirSync(partsDir).filter(f => f.endsWith('.js')).sort();
    const appParts = files.filter(f => parseInt(f) <= 33);
    const enhParts = files.filter(f => parseInt(f) >= 34);

    const concat = (parts: string[]) =>
      parts.map(f => readFileSync(resolve(partsDir, f), 'utf8')).join('\n');

    try {
      if (appParts.length) {
        writeFileSync(resolve(__dirname, 'js/app.js'), concat(appParts), 'utf8');
      }
      if (enhParts.length) {
        writeFileSync(resolve(__dirname, 'js/enhancements.js'), concat(enhParts), 'utf8');
      }
      console.log(`[concat-parts] ${appParts.length}+${enhParts.length} files → app.js + enhancements.js`);
    } catch (e: any) {
      console.log(`[concat-parts] Skipping write (${e.code || e.message}) — using existing app.js`);
    }
  }

  return {
    name: 'concat-parts',
    buildStart() { rebuild(); },
    configureServer(server) {
      server.watcher.add(resolve(partsDir, '*.js'));
      server.watcher.on('change', (file) => {
        if (file.includes('js/parts/') && !file.includes('app.js') && !file.includes('enhancements.js')) {
          rebuild();
        }
      });
    },
  };
}

/**
 * Stamp the SW with a build timestamp so each build busts the cache.
 */
function stampServiceWorker(): Plugin {
  return {
    name: 'stamp-sw',
    closeBundle() {
      const swPath = resolve(__dirname, 'www/sw.js');
      if (existsSync(swPath)) {
        let sw = readFileSync(swPath, 'utf8');
        const stamp = Date.now().toString(36);
        sw = sw.replace(/__BUILD_TIMESTAMP__/g, stamp);
        writeFileSync(swPath, sw, 'utf8');
        console.log(`[stamp-sw] Cache version: benam-v9.1-${stamp}`);
      }
    },
  };
}

/**
 * Custom Vite plugin to copy legacy assets into the build output.
 *
 * During the migration period, legacy vanilla JS files (app.js, enhancements.js,
 * vendor libs) and static assets (CSS, icons, SW, manifest) are NOT processed
 * by Vite's bundler. This plugin copies them into www/ after each build so that
 * the Capacitor Android app and the production build have everything they need.
 *
 * This plugin will be removed in Phase 8 when all legacy code is migrated.
 */
function copyLegacyAssets(): Plugin {
  const legacyDirs = ['js', 'icons'];
  const legacyFiles = ['sw.js', 'manifest.json'];

  return {
    name: 'copy-legacy-assets',
    closeBundle() {
      const root = resolve(__dirname);
      const outDir = resolve(__dirname, 'www');

      for (const dir of legacyDirs) {
        const src = resolve(root, dir);
        const dest = resolve(outDir, dir);
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true, force: true });
        }
      }

      for (const file of legacyFiles) {
        const src = resolve(root, file);
        const dest = resolve(outDir, file);
        if (existsSync(src)) {
          cpSync(src, dest, { force: true });
        }
      }

      console.log('[copy-legacy-assets] Legacy JS, icons, SW, manifest copied to www/');
    },
  };
}

export default defineConfig({
  root: '.',
  base: './',

  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@data': resolve(__dirname, 'src/data'),
      '@presentation': resolve(__dirname, 'src/presentation'),
      '@features': resolve(__dirname, 'src/features'),
      '@background': resolve(__dirname, 'src/background'),
    },
  },

  server: {
    port: parseInt(process.env.PORT || '8080'),
    strictPort: false,
    open: false,
  },

  build: {
    outDir: 'www',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },

  plugins: [concatParts(), copyLegacyAssets(), stampServiceWorker()],
});
