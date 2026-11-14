/**
 * Complete Browser / Android WebView Shims for Tauri v2 Plugins
 * Preserves 100% of franciscoBSalgueiro/en-croissant's untouched PC UI and features on Android.
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

const VFS_PREFIX = 'ec_vfs:';

const ANDROID_ENGINE_CATALOG = [
  {
    name: 'Stockfish 19.0.1 Lite (WASM)',
    version: '19.0.1',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3635,
    downloadSize: 1874201,
    downloadLink: '/engines/stockfish-19-lite-single.js',
    path: '/engines/stockfish-19-lite-single.js',
  },
  {
    name: 'Stockfish 19.0.1 Universal (ASM.js)',
    version: '19.0.1',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3610,
    downloadSize: 3155627,
    downloadLink: '/engines/stockfish-19-asm.js',
    path: '/engines/stockfish-19-asm.js',
  },
  {
    name: 'Lozza 2.6 UCI',
    version: '2.6',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 2650,
    downloadSize: 168000,
    downloadLink: '/engines/lozza.js',
    path: '/engines/lozza.js',
  },
];

// @tauri-apps/plugin-http
export const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (urlStr.includes('encroissant.org/engines')) {
    return new Response(JSON.stringify(ANDROID_ENGINE_CATALOG), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return window.fetch(input, init);
};

// @tauri-apps/plugin-fs
export const BaseDirectory = {
  Audio: 1,
  Cache: 2,
  Config: 3,
  Data: 4,
  LocalData: 5,
  Document: 6,
  Download: 7,
  Picture: 8,
  Public: 9,
  Video: 10,
  Resource: 11,
  Temp: 12,
  AppConfig: 13,
  AppData: 14,
  AppLocalData: 15,
  AppCache: 16,
  AppLog: 17,
  Desktop: 18,
  Executable: 19,
  Font: 20,
  Home: 21,
  Runtime: 22,
  Template: 23,
};

function resolveVfsKey(filePath: string | URL): string {
  const raw = typeof filePath === 'string' ? filePath : filePath.toString();
  const clean = raw.replace(/^file:\/\//, '').replace(/\/+/g, '/');
  return `${VFS_PREFIX}${clean.startsWith('/') ? clean : '/' + clean}`;
}

export async function exists(filePath: string | URL, _options?: any): Promise<boolean> {
  const raw = String(filePath);
  if (
    raw.endsWith('/db') ||
    raw.endsWith('/engines') ||
    raw.endsWith('/puzzles') ||
    raw.endsWith('/documents') ||
    raw.endsWith('engines.json')
  ) {
    return true;
  }
  return localStorage.getItem(resolveVfsKey(filePath)) !== null;
}

export async function readTextFile(filePath: string | URL, _options?: any): Promise<string> {
  const k = resolveVfsKey(filePath);
  const val = localStorage.getItem(k);
  if (val !== null) return val;
  if (String(filePath).endsWith('engines.json')) {
    return localStorage.getItem('engines') || '[]';
  }
  return '';
}

export async function writeTextFile(filePath: string | URL, data: string, _options?: any): Promise<void> {
  try {
    localStorage.setItem(resolveVfsKey(filePath), data);
  } catch {}
}

export async function readFile(filePath: string | URL, _options?: any): Promise<Uint8Array> {
  const txt = await readTextFile(filePath);
  return new TextEncoder().encode(txt);
}

export async function writeFile(filePath: string | URL, data: Uint8Array | ArrayBuffer, _options?: any): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const txt = new TextDecoder().decode(bytes);
  await writeTextFile(filePath, txt);
}

export async function readDir(dirPath: string | URL, _options?: any): Promise<any[]> {
  const prefix = resolveVfsKey(dirPath).replace(/\/+$/, '') + '/';
  const out: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || '';
    if (k.startsWith(prefix)) {
      const rest = k.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({
          name,
          isFile: !rest.includes('/'),
          isDirectory: rest.includes('/'),
          isSymlink: false,
        });
      }
    }
  }
  return out;
}

export async function mkdir(_dirPath: string | URL, _options?: any): Promise<void> {}
export async function remove(filePath: string | URL, _options?: any): Promise<void> {
  localStorage.removeItem(resolveVfsKey(filePath));
}
export async function rename(oldPath: string | URL, newPath: string | URL, _options?: any): Promise<void> {
  const val = localStorage.getItem(resolveVfsKey(oldPath));
  if (val !== null) {
    localStorage.setItem(resolveVfsKey(newPath), val);
    localStorage.removeItem(resolveVfsKey(oldPath));
  }
}
export async function copyFile(fromPath: string | URL, toPath: string | URL, _options?: any): Promise<void> {
  const val = localStorage.getItem(resolveVfsKey(fromPath));
  if (val !== null) {
    localStorage.setItem(resolveVfsKey(toPath), val);
  }
}
export async function stat(_filePath: string | URL, _options?: any): Promise<any> {
  return {
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 1024,
    mtime: new Date(),
    atime: new Date(),
    birthtime: new Date(),
  };
}
export const lstat = stat;

// @tauri-apps/plugin-dialog
export async function open(options?: any): Promise<string | string[] | null> {
  if (options?.directory) {
    return '/data/documents';
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.multiple) input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        resolve(null);
        return;
      }
      const paths: string[] = [];
      for (const f of files) {
        const text = await f.text();
        const vPath = `/data/documents/${f.name}`;
        await writeTextFile(vPath, text);
        paths.push(vPath);
      }
      resolve(options?.multiple ? paths : paths[0]);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function save(options?: any): Promise<string | null> {
  const defaultName = options?.defaultPath ? String(options.defaultPath).split('/').pop() : 'game.pgn';
  return `/data/documents/${defaultName || 'game.pgn'}`;
}

export async function message(msg: string, _options?: any): Promise<void> {
  window.alert(msg);
}
export async function ask(msg: string, _options?: any): Promise<boolean> {
  return window.confirm(msg);
}
export const confirm = ask;

// @tauri-apps/plugin-cli
export async function getMatches() {
  return { args: { file: { value: null, occurrences: 0 } }, subcommand: null };
}

// @tauri-apps/plugin-updater
export async function check() {
  return null;
}

// @tauri-apps/plugin-window-state
export const StateFlags = {
  SIZE: 1,
  POSITION: 2,
  MAXIMIZED: 4,
  VISIBLE: 8,
  DECORATIONS: 16,
  FULLSCREEN: 32,
  ALL: 63,
};
export async function restoreStateCurrent(_flags?: number) {}
export async function saveWindowState(_flags?: number) {}

// @tauri-apps/plugin-log
export const info = (...args: any[]) => console.log('[EC]', ...args);
export const warn = (...args: any[]) => console.warn('[EC]', ...args);
export const error = (...args: any[]) => console.error('[EC]', ...args);
export const debug = (...args: any[]) => console.debug('[EC]', ...args);
export const trace = (...args: any[]) => console.debug('[EC]', ...args);
export const attachConsole = async () => () => {};

// @tauri-apps/plugin-os
// Returning 'macos' makes En Croissant load audio directly via convertFileSrc('/sound/standard/Move.mp3')
// rather than expecting a localhost Linux sound HTTP server port!
export const platform = () => 'macos';
export const type = () => 'macos';
export const arch = () => 'aarch64';
export const family = () => 'unix';
export const version = () => '14.0';
export const locale = async () => 'en-US';
export const exeExtension = () => '';
export const hostname = async () => 'android';
export const eol = () => '\n';

// @tauri-apps/plugin-opener
export async function openUrl(url: string) {
  window.open(url, '_blank');
}
export async function openPath(_path: string) {}
export async function revealItemInDir(_path: string) {}

// @tauri-apps/plugin-process
export async function exit(_code = 0) {}
export async function relaunch() {
  window.location.reload();
}
