#!/usr/bin/env node
/**
 * Adapts franciscoBSalgueiro/en-croissant (src-tauri & src/) for Tauri v2 Android compilation:
 * 1. Ensures src-tauri/Cargo.toml has [lib] crate-type = ["staticlib", "cdylib", "rlib"]
 *    and strips desktop-only plugins (window-state, updater, cli) so Cargo & tauri-build succeed.
 * 2. Strips desktop-only permission identifiers (updater:*, window-state:*, cli:*) from
 *    src-tauri/capabilities/*.json so tauri-build ACL validation never fails on Android.
 * 3. Ensures src-tauri/src/lib.rs exposes #[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()
 *    and strips desktop-only plugin registrations.
 * 4. Updates src-tauri/src/engine/process.rs so on Android, spawning an engine automatically resolves
 *    bundled native ARM64 Stockfish 19 (`libstockfish.so`) in the APK's executable nativeLibraryDir.
 * 5. Cleans desktop-only updater fields in src-tauri/tauri.conf.json and sets visible: true.
 *
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TAURI_DIR = path.join(ROOT, 'src-tauri');

function log(msg) {
  console.log(`[Prepare-Tauri-Android] ${msg}`);
}

// 1. Patch src-tauri/Cargo.toml
const cargoTomlPath = path.join(TAURI_DIR, 'Cargo.toml');
let libCrateName = 'en_croissant_lib';
if (fs.existsSync(cargoTomlPath)) {
  let cargo = fs.readFileSync(cargoTomlPath, 'utf8');

  const existingLibName = cargo.match(/\[lib\][\s\S]*?name\s*=\s*"([^"]+)"/);
  if (existingLibName) {
    libCrateName = existingLibName[1];
  }

  if (!cargo.includes('[lib]')) {
    const libBlock = [
      '',
      '[lib]',
      `name = "${libCrateName}"`,
      'path = "src/lib.rs"',
      'crate-type = ["staticlib", "cdylib", "rlib"]',
      '',
    ].join('\n');
    cargo = cargo.replace(/(\[package\][\s\S]*?)(?=\n\[)/, `$1${libBlock}\n`);
    log(`Added [lib] section (${libCrateName}) to src-tauri/Cargo.toml`);
  } else if (!cargo.includes('cdylib')) {
    cargo = cargo.replace(
      /crate-type\s*=\s*\[[^\]]*\]/,
      'crate-type = ["staticlib", "cdylib", "rlib"]'
    );
  }

  // Remove desktop-only plugins from Cargo.toml so Android build never compiles them
  const desktopOnlyCrates = [
    'tauri-plugin-window-state',
    'tauri-plugin-updater',
    'tauri-plugin-cli',
    'tauri-plugin-single-instance',
    'tauri-plugin-global-shortcut',
  ];
  for (const crateName of desktopOnlyCrates) {
    const regex = new RegExp(`^\\s*${crateName}\\s*=[^\\n]*\\n`, 'gm');
    cargo = cargo.replace(regex, '');
  }

  // Ensure reqwest uses rustls-tls instead of native OpenSSL C headers when cross-compiling
  cargo = cargo.replace(
    /reqwest\s*=\s*\{\s*version\s*=\s*"([^"]+)"\s*,\s*features\s*=\s*\[([^\]]*)\]\s*\}/,
    (_, ver, feats) => {
      const addRustls = feats.includes('rustls-tls')
        ? feats
        : `${feats}, "rustls-tls"`;
      return `reqwest = { version = "${ver}", default-features = false, features = [${addRustls}] }`;
    }
  );

  fs.writeFileSync(cargoTomlPath, cargo, 'utf8');
}

// 2. Clean desktop-only permissions from src-tauri/capabilities/*.json
const capDir = path.join(TAURI_DIR, 'capabilities');
if (fs.existsSync(capDir)) {
  for (const file of fs.readdirSync(capDir)) {
    if (file.endsWith('.json')) {
      const capPath = path.join(capDir, file);
      try {
        const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
        if (Array.isArray(cap.permissions)) {
          cap.permissions = cap.permissions.filter((p) => {
            const id = typeof p === 'string' ? p : p?.identifier || '';
            return (
              !id.startsWith('updater:') &&
              !id.startsWith('window-state:') &&
              !id.startsWith('cli:') &&
              !id.startsWith('single-instance:') &&
              !id.startsWith('global-shortcut:')
            );
          });
        }
        delete cap.platforms; // allow capability on Android
        fs.writeFileSync(capPath, JSON.stringify(cap, null, 2) + '\n', 'utf8');
        log(`Cleaned desktop-only permissions in capabilities/${file}`);
      } catch (e) {
        log(`Warning parsing capabilities/${file}: ${e.message}`);
      }
    }
  }
}

// 3. Patch src-tauri/src/lib.rs & src-tauri/src/main.rs
const mainRsPath = path.join(TAURI_DIR, 'src', 'main.rs');
const libRsPath = path.join(TAURI_DIR, 'src', 'lib.rs');

function stripDesktopPluginsInRust(code) {
  let out = code;
  // Remove use statements for desktop-only plugins
  out = out.replace(/^\s*use\s+tauri_plugin_(window_state|updater|cli)[^;]*;\s*\n/gm, '');
  // Remove .plugin(...) calls for desktop-only plugins (including multi-line Builder chains)
  out = out.replace(
    /\.plugin\(\s*tauri_plugin_window_state::Builder[\s\S]*?\.build\(\)\s*,?\s*\)/g,
    ''
  );
  out = out.replace(
    /\.plugin\(\s*tauri_plugin_updater::Builder[\s\S]*?\.build\(\)\s*,?\s*\)/g,
    ''
  );
  out = out.replace(/\.plugin\(\s*tauri_plugin_cli::init\(\)\s*\)/g, '');
  return out;
}

if (fs.existsSync(mainRsPath) && !fs.existsSync(libRsPath)) {
  let mainCode = fs.readFileSync(mainRsPath, 'utf8');
  mainCode = stripDesktopPluginsInRust(mainCode);
  const libCode = mainCode.replace(
    /fn\s+main\s*\(\s*\)/,
    '#[cfg_attr(mobile, tauri::mobile_entry_point)]\npub fn run()'
  );
  fs.writeFileSync(libRsPath, libCode, 'utf8');
  fs.writeFileSync(
    mainRsPath,
    [
      '#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]',
      '',
      'fn main() {',
      `    ${libCrateName}::run();`,
      '}',
      '',
    ].join('\n'),
    'utf8'
  );
  log('Created src-tauri/src/lib.rs with #[cfg_attr(mobile, tauri::mobile_entry_point)]');
} else if (fs.existsSync(libRsPath)) {
  let libCode = fs.readFileSync(libRsPath, 'utf8');
  libCode = stripDesktopPluginsInRust(libCode);
  if (!libCode.includes('mobile_entry_point')) {
    libCode = libCode.replace(
      /pub\s+fn\s+run\s*\(/,
      '#[cfg_attr(mobile, tauri::mobile_entry_point)]\npub fn run('
    );
  }
  fs.writeFileSync(libRsPath, libCode, 'utf8');
  if (fs.existsSync(mainRsPath)) {
    const mCode = stripDesktopPluginsInRust(fs.readFileSync(mainRsPath, 'utf8'));
    fs.writeFileSync(mainRsPath, mCode, 'utf8');
  }
  log('Updated existing src-tauri/src/lib.rs with mobile_entry_point');
}

// 4. Patch src-tauri/src/engine/process.rs to resolve bundled Android ARM64 libstockfish.so
const processRsPath = path.join(TAURI_DIR, 'src', 'engine', 'process.rs');
if (fs.existsSync(processRsPath)) {
  let procCode = fs.readFileSync(processRsPath, 'utf8');
  const androidResolverFn = `
#[cfg(target_os = "android")]
fn resolve_android_engine_binary(requested: &std::path::Path) -> std::path::PathBuf {
    if let Ok(maps) = std::fs::read_to_string("/proc/self/maps") {
        for line in maps.lines() {
            if line.contains("/lib/") && line.ends_with(".so") {
                if let Some(idx) = line.find('/') {
                    let so_path = std::path::Path::new(&line[idx..]);
                    if let Some(lib_dir) = so_path.parent() {
                        let sf = lib_dir.join("libstockfish.so");
                        if sf.exists() {
                            return sf;
                        }
                    }
                }
            }
        }
    }
    requested.to_path_buf()
}
`;
  if (!procCode.includes('resolve_android_engine_binary')) {
    procCode += `\n${androidResolverFn}\n`;
    procCode = procCode.replace(
      /Command::new\(&?path\)/,
      'Command::new({ #[cfg(target_os = "android")] { resolve_android_engine_binary(&path) } #[cfg(not(target_os = "android"))] { &path } })'
    );
    fs.writeFileSync(processRsPath, procCode, 'utf8');
    log('Patched src-tauri/src/engine/process.rs to auto-resolve native ARM64 libstockfish.so on Android');
  }
}

// 5. Patch src-tauri/tauri.conf.json (remove desktop updater config, set visible: true & minSdkVersion: 28)
const tauriConfPath = path.join(TAURI_DIR, 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const conf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  if (conf.app && Array.isArray(conf.app.windows)) {
    conf.app.windows = conf.app.windows.map((w) => ({
      ...w,
      visible: true,
    }));
  }
  if (conf.plugins) {
    delete conf.plugins.updater;
    delete conf.plugins.cli;
  }
  if (!conf.bundle) conf.bundle = {};
  delete conf.bundle.createUpdaterArtifacts;
  conf.bundle.android = {
    minSdkVersion: 28,
  };
  fs.writeFileSync(tauriConfPath, JSON.stringify(conf, null, 2) + '\n', 'utf8');
  log('Updated src-tauri/tauri.conf.json (removed desktop updater config, set visible: true, minSdkVersion: 28)');
}

// 6. Inject Android responsive CSS & auto-registered Stockfish 19 profile into index.html
const indexHtmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const mobileStyleAndInit = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <style>
      body {
        padding-top: env(safe-area-inset-top, 0px);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        overscroll-behavior: none;
        -webkit-user-select: none;
        user-select: none;
      }
      @media (max-width: 768px) {
        .mantine-AppShell-main {
          overflow-y: auto !important;
        }
      }
    </style>
    <script>
      try {
        if (!localStorage.getItem("engines")) {
          localStorage.setItem("engines", JSON.stringify([
            {
              id: "stockfish-19-android-arm64",
              name: "Stockfish 19 (Android ARM64 / nmrugg v19.0.1)",
              version: "19",
              type: "local",
              path: "libstockfish.so",
              elo: 3635,
              loaded: true,
              go: { t: "Depth", c: 18 },
              settings: [
                { name: "Threads", value: 2 },
                { name: "Hash", value: 32 },
                { name: "MultiPV", value: 3 }
              ]
            }
          ]));
        }
      } catch (e) {}
    </script>
  `;
  if (!html.includes('stockfish-19-android-arm64')) {
    html = html.replace('</head>', `${mobileStyleAndInit}\n  </head>`);
    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    log('Injected Android responsive styles and pre-configured Stockfish 19 in index.html');
  }
}

log('All Tauri v2 Android adaptations applied successfully!');
