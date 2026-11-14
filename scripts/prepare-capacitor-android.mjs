#!/usr/bin/env node
/**
 * Prepares the untouched franciscoBSalgueiro/en-croissant frontend for Android APK packaging:
 * 1. Downloads nmrugg/stockfish.js v19.0.1 (`stockfish-19-lite-single.js` + `.wasm` and `stockfish-19-asm.js`)
 *    and Lozza 2.6 (`lozza.js`) into `public/engines/`.
 * 2. Copies En Croissant's `sound/` directory into `public/sound/`.
 * 3. Creates `vite.android.config.ts` using Vite's `mergeConfig` to alias Tauri desktop plugins
 *    to `scripts/tauri-plugin-shims.ts` without modifying `vite.config.ts`.
 * 4. Injects `tauri-android-runtime.js` and automatic 1280px Landscape PC Widescreen scaling into `index.html`.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function log(msg) {
  console.log(`[Prepare-EnCroissant-Android] ${msg}`);
}

// 1. Download official nmrugg/stockfish.js v19.0.1 and Lozza into public/engines/
const enginesDir = path.join(ROOT, 'public', 'engines');
fs.mkdirSync(enginesDir, { recursive: true });

const downloads = [
  {
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.js',
    dest: path.join(enginesDir, 'stockfish-19-lite-single.js'),
  },
  {
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.wasm',
    dest: path.join(enginesDir, 'stockfish-19-lite-single.wasm'),
  },
  {
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-asm.js',
    dest: path.join(enginesDir, 'stockfish-19-asm.js'),
  },
  {
    url: 'https://raw.githubusercontent.com/op12no2/lozza/master/lozza.js',
    dest: path.join(enginesDir, 'lozza.js'),
  },
];

for (const item of downloads) {
  log(`Downloading ${path.basename(item.dest)}...`);
  execSync(`curl -fsSL "${item.url}" -o "${item.dest}"`, { stdio: 'inherit' });
}

// 2. Copy bundled sound/ directory into public/sound/
const srcSound = path.join(ROOT, 'sound');
const destSound = path.join(ROOT, 'public', 'sound');
if (fs.existsSync(srcSound)) {
  fs.cpSync(srcSound, destSound, { recursive: true });
  log('Copied sound/ collections into public/sound/');
}

// 3. Create vite.android.config.ts using Vite mergeConfig
const shimPath = path.resolve(ROOT, 'scripts/tauri-plugin-shims.ts').replace(/\\/g, '/');
const viteAndroidConfig = `import path from "path";
import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

const shimPath = "${shimPath}";

export default defineConfig(async (env) => {
  const resolvedBase = typeof baseConfig === "function" ? await baseConfig(env) : await baseConfig;
  return mergeConfig(resolvedBase, {
    resolve: {
      alias: [
        { find: "@tauri-apps/plugin-http", replacement: shimPath },
        { find: "@tauri-apps/plugin-fs", replacement: shimPath },
        { find: "@tauri-apps/plugin-dialog", replacement: shimPath },
        { find: "@tauri-apps/plugin-cli", replacement: shimPath },
        { find: "@tauri-apps/plugin-updater", replacement: shimPath },
        { find: "@tauri-apps/plugin-window-state", replacement: shimPath },
        { find: "@tauri-apps/plugin-log", replacement: shimPath },
        { find: "@tauri-apps/plugin-os", replacement: shimPath },
        { find: "@tauri-apps/plugin-opener", replacement: shimPath },
        { find: "@tauri-apps/plugin-process", replacement: shimPath },
        { find: "@", replacement: path.resolve(__dirname, "./src") }
      ]
    }
  });
});
`;
fs.writeFileSync(path.join(ROOT, 'vite.android.config.ts'), viteAndroidConfig, 'utf8');
log('Created vite.android.config.ts with Tauri plugin shims');

// 4. Inject tauri-android-runtime.js and Landscape PC Widescreen scaling into index.html
const indexHtmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const injection = `
    <meta id="ec-viewport" name="viewport" content="width=1280, initial-scale=0.65, minimum-scale=0.35, maximum-scale=2.0, user-scalable=yes, viewport-fit=cover" />
    <script src="/tauri-android-runtime.js"></script>
    <script>
      (function() {
        function updateDesktopViewport() {
          var vp = document.getElementById("ec-viewport");
          if (!vp) return;
          var w = Math.max(window.screen.width || 800, window.screen.height || 800);
          var scale = Math.max(0.4, Math.min(1.0, w / 1280)).toFixed(3);
          vp.setAttribute("content", "width=1280, initial-scale=" + scale + ", minimum-scale=0.35, maximum-scale=2.0, user-scalable=yes, viewport-fit=cover");
        }
        updateDesktopViewport();
        window.addEventListener("resize", updateDesktopViewport);
        window.addEventListener("orientationchange", updateDesktopViewport);
      })();
    </script>
    <style>
      html, body, #root, #app {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #1a1b1e !important;
        overscroll-behavior: none !important;
      }
    </style>
  `;
  if (!html.includes('tauri-android-runtime.js')) {
    html = html.replace(/<meta[^>]*name=["']viewport["'][^>]*>/i, '');
    html = html.replace('<head>', `<head>\n${injection}`);
    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    log('Injected tauri-android-runtime.js and 1280px Landscape PC viewport into index.html');
  }
}

// 5. Write capacitor.config.json
const capConfig = {
  appId: 'org.encroissant.app',
  appName: 'En Croissant',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
};
fs.writeFileSync(path.join(ROOT, 'capacitor.config.json'), JSON.stringify(capConfig, null, 2) + '\n', 'utf8');
log('Created capacitor.config.json');
