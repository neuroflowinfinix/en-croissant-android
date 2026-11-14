#!/usr/bin/env node
/**
 * Runs after `pnpm tauri android init` in GitHub Actions to:
 * 1. Download official Stockfish 19 for Android ARM64 (`stockfish-android-arm64-universal.tar.gz`)
 *    and place it at `src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/libstockfish.so`.
 * 2. Download nmrugg/stockfish.js v19.0.1 (`stockfish-19-lite-single.js` & `.wasm`) into `public/engines/`.
 * 3. Ensure `android:extractNativeLibs="true"` and `android:usesCleartextTraffic="true"` are set in
 *    `src-tauri/gen/android/app/src/main/AndroidManifest.xml` so Android extracts `libstockfish.so`
 *    with executable permissions for Android 9+.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ANDROID_APP_DIR = path.join(ROOT, 'src-tauri', 'gen', 'android', 'app');

function log(msg) {
  console.log(`[Configure-Android-Engines] ${msg}`);
}

const jniArm64Dir = path.join(ANDROID_APP_DIR, 'src', 'main', 'jniLibs', 'arm64-v8a');
fs.mkdirSync(jniArm64Dir, { recursive: true });

try {
  log('Downloading official Stockfish 19 Android ARM64 binary...');
  execSync(
    'curl -fsSL "https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-android-arm64-universal.tar.gz" -o /tmp/sf19-android.tar.gz && tar -xzf /tmp/sf19-android.tar.gz -C /tmp',
    { stdio: 'inherit' }
  );
  const foundBin = execSync('find /tmp/stockfish* -type f -name "stockfish*" | head -n 1')
    .toString()
    .trim();
  if (foundBin && fs.existsSync(foundBin)) {
    const destSo = path.join(jniArm64Dir, 'libstockfish.so');
    fs.copyFileSync(foundBin, destSo);
    fs.chmodSync(destSo, 0o755);
    log(`Bundled native ARM64 Stockfish 19 at ${destSo}`);
  }
} catch (err) {
  log(`Note: Native ARM64 tar fetch fallback (${err.message})`);
}

const pubEngines = path.join(ROOT, 'public', 'engines');
fs.mkdirSync(pubEngines, { recursive: true });
try {
  log('Downloading nmrugg/stockfish.js v19.0.1 Lite Single-Thread WASM & JS...');
  execSync(
    `curl -fsSL "https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.js" -o "${pubEngines}/stockfish-19-lite-single.js"`,
    { stdio: 'inherit' }
  );
  execSync(
    `curl -fsSL "https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.wasm" -o "${pubEngines}/stockfish-19-lite-single.wasm"`,
    { stdio: 'inherit' }
  );
} catch (err) {
  log(`Note: nmrugg/stockfish.js download warning: ${err.message}`);
}

const manifestPath = path.join(ANDROID_APP_DIR, 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!manifest.includes('extractNativeLibs')) {
    manifest = manifest.replace(
      '<application',
      '<application android:extractNativeLibs="true" android:usesCleartextTraffic="true"'
    );
  }
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  log('Patched AndroidManifest.xml with android:extractNativeLibs="true"');
}
