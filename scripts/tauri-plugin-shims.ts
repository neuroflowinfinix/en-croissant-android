/**
 * Complete Browser / Android WebView Shims for Tauri v2 Plugins & Path API
 * Synced with /storage/emulated/0/EnCroissant via window.AndroidBridge + localStorage VFS.
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

const VFS_PREFIX = 'ec_vfs:';
const MAIN_ROOT = '/storage/emulated/0/EnCroissant';

function getMemoryVfs(): Map<string, string> {
  const w = typeof window !== 'undefined' ? (window as any) : {};
  if (!w.__EC_VFS_MEMORY__) {
    w.__EC_VFS_MEMORY__ = new Map<string, string>();
  }
  return w.__EC_VFS_MEMORY__;
}

const ANDROID_DATABASE_CATALOG = [
  {
    title: 'Caissabase 2024',
    description: 'Curated Grandmaster & Master games collection',
    storage_size: 1325400064,
    downloadLink: 'https://www.encroissant.org/databases/caissabase_2024.db3',
    type: 'success',
    file: 'caissabase_2024.db3',
    filename: 'caissabase_2024.db3',
    game_count: 5404926,
    player_count: 324092,
    event_count: 145020,
    indexed: true,
  },
  {
    title: 'Lichess Elite Database',
    description: 'Games from Lichess players rated 2400+ against 2200+',
    storage_size: 850000000,
    downloadLink: 'https://www.encroissant.org/databases/lichess_elite.db3',
    type: 'success',
    file: 'lichess_elite.db3',
    filename: 'lichess_elite.db3',
    game_count: 2850000,
    player_count: 112000,
    event_count: 42000,
    indexed: true,
  },
  {
    title: 'World Championship & GM Classics',
    description: 'Complete World Chess Championship & Super-GM tournament games',
    storage_size: 45000000,
    downloadLink: 'https://www.encroissant.org/databases/gm_classics.db3',
    type: 'success',
    file: 'gm_classics.db3',
    filename: 'gm_classics.db3',
    game_count: 125000,
    player_count: 18500,
    event_count: 4200,
    indexed: true,
  },
];

const ANDROID_PUZZLE_CATALOG = [
  {
    title: 'Lichess Tactical Puzzles',
    description: 'Official tactical puzzles from Lichess games across all themes',
    puzzleCount: 3080529,
    puzzle_count: 3080529,
    storageSize: 335544320,
    storage_size: 335544320,
    path: 'puzzles.db3',
    downloadLink: 'https://www.encroissant.org/puzzle_databases/puzzles.db3',
  },
];

const ANDROID_ENGINE_CATALOG = [
  {
    name: 'Stockfish 19.0.1 Single (JS)',
    version: '19.0.1',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3635,
    downloadSize: 9854200,
    downloadLink: '/engines/stockfish-19-lite-single.js',
    path: `${MAIN_ROOT}/engines/stockfish-19-lite-single.js`,
  },
  {
    name: 'Stockfish 19.0.1 Pure JS (ASM)',
    version: '19.0.1',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3580,
    downloadSize: 3158000,
    downloadLink: '/engines/stockfish-19-asm.js',
    path: `${MAIN_ROOT}/engines/stockfish-19-asm.js`,
  },
  {
    name: 'Stockfish 18 Single 7MB NNUE (JS)',
    version: '18.0',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3625,
    downloadSize: 7298000,
    downloadLink: '/engines/stockfish-18-lite-single.js',
    path: `${MAIN_ROOT}/engines/stockfish-18-lite-single.js`,
  },
  {
    name: 'Stockfish 18 Pure JS 10MB (ASM)',
    version: '18.0',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3560,
    downloadSize: 10485760,
    downloadLink: '/engines/stockfish-18-asm.js',
    path: `${MAIN_ROOT}/engines/stockfish-18-asm.js`,
  },
  {
    name: 'Lozza 2.6 UCI (JS)',
    version: '2.6',
    os: 'macos',
    bmi2: false,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 2650,
    downloadSize: 168000,
    downloadLink: '/engines/lozza.js',
    path: `${MAIN_ROOT}/engines/lozza.js`,
  },
];

function getAndroidBridge(): any {
  return typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
}

function getIosIdb(): any {
  return typeof window !== 'undefined' ? (window as any).__EC_IDB__ : null;
}

// @tauri-apps/plugin-http
export const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr =
    typeof input === 'string'
      ? input
      : input && typeof (input as any).url === 'string'
      ? (input as any).url
      : input && typeof (input as any).toString === 'function'
      ? String(input.toString())
      : '';

  if (urlStr.includes('encroissant.org/engines')) {
    return new Response(JSON.stringify(ANDROID_ENGINE_CATALOG), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (urlStr.includes('encroissant.org/puzzle_databases') || urlStr.includes('encroissant.org/puzzles')) {
    return new Response(JSON.stringify(ANDROID_PUZZLE_CATALOG), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (urlStr.includes('encroissant.org/databases')) {
    return new Response(JSON.stringify(ANDROID_DATABASE_CATALOG), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Strip User-Agent header which triggers CORS preflight rejection in WebView on api.chess.com / lichess.org
  const cleanInit: RequestInit = { ...(init || {}) };
  if (cleanInit.headers) {
    const h = new Headers(cleanInit.headers as HeadersInit);
    h.delete('User-Agent');
    h.delete('user-agent');
    cleanInit.headers = h;
  }
  return window.fetch(input, cleanInit);
};

// @tauri-apps/plugin-fs & @tauri-apps/api/path BaseDirectory
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

const BASE_DIR_PATHS: Record<number, string> = {
  1: `${MAIN_ROOT}/audio`,
  2: `${MAIN_ROOT}/cache`,
  3: `${MAIN_ROOT}/config`,
  4: MAIN_ROOT,
  5: MAIN_ROOT,
  6: `${MAIN_ROOT}/documents`,
  7: '/storage/emulated/0/Download',
  8: `${MAIN_ROOT}/pictures`,
  9: `${MAIN_ROOT}/public`,
  10: `${MAIN_ROOT}/video`,
  11: `${MAIN_ROOT}/resources`,
  12: `${MAIN_ROOT}/temp`,
  13: `${MAIN_ROOT}/config`,
  14: MAIN_ROOT,
  15: MAIN_ROOT,
  16: `${MAIN_ROOT}/cache`,
  17: `${MAIN_ROOT}/logs`,
  18: `${MAIN_ROOT}/desktop`,
  19: `${MAIN_ROOT}/engines`,
  20: `${MAIN_ROOT}/fonts`,
  21: MAIN_ROOT,
  22: `${MAIN_ROOT}/runtime`,
  23: `${MAIN_ROOT}/templates`,
};

function safePathString(filePath: any, options?: any): string {
  let raw = '';
  if (typeof filePath === 'string') {
    raw = filePath;
  } else if (filePath !== null && filePath !== undefined && typeof filePath.toString === 'function') {
    raw = String(filePath.toString());
  } else {
    raw = MAIN_ROOT;
  }
  const baseDirNum = Number(options?.baseDir || options?.dir || 0);
  const basePrefix = baseDirNum ? BASE_DIR_PATHS[baseDirNum] || MAIN_ROOT : '';
  const combined = basePrefix && !raw.startsWith('/') ? `${basePrefix}/${raw}` : raw;
  const clean = combined.replace(/^file:\/\//, '').replace(/\/+/g, '/');
  return clean.startsWith('/') ? clean : `${MAIN_ROOT}/${clean}`.replace(/\/+/g, '/');
}

function resolveVfsKey(filePath: any, options?: any): string {
  return `${VFS_PREFIX}${safePathString(filePath, options)}`;
}

// @tauri-apps/api/path functions
export const sep = () => '/';
export const delimiter = () => ':';
export async function appDataDir(): Promise<string> { return MAIN_ROOT; }
export async function appLocalDataDir(): Promise<string> { return MAIN_ROOT; }
export async function appConfigDir(): Promise<string> { return `${MAIN_ROOT}/config`; }
export async function appCacheDir(): Promise<string> { return `${MAIN_ROOT}/cache`; }
export async function appLogDir(): Promise<string> { return `${MAIN_ROOT}/logs`; }
export async function documentDir(): Promise<string> { return `${MAIN_ROOT}/documents`; }
export async function downloadDir(): Promise<string> { return '/storage/emulated/0/Download'; }
export async function homeDir(): Promise<string> { return MAIN_ROOT; }
export async function tempDir(): Promise<string> { return `${MAIN_ROOT}/temp`; }
export async function resourceDir(): Promise<string> { return `${MAIN_ROOT}/resources`; }
export async function dataDir(): Promise<string> { return MAIN_ROOT; }
export async function localDataDir(): Promise<string> { return MAIN_ROOT; }
export async function configDir(): Promise<string> { return `${MAIN_ROOT}/config`; }
export async function cacheDir(): Promise<string> { return `${MAIN_ROOT}/cache`; }
export async function audioDir(): Promise<string> { return `${MAIN_ROOT}/audio`; }
export async function desktopDir(): Promise<string> { return `${MAIN_ROOT}/desktop`; }
export async function executableDir(): Promise<string> { return `${MAIN_ROOT}/engines`; }
export async function fontDir(): Promise<string> { return `${MAIN_ROOT}/fonts`; }
export async function pictureDir(): Promise<string> { return `${MAIN_ROOT}/pictures`; }
export async function publicDir(): Promise<string> { return `${MAIN_ROOT}/public`; }
export async function runtimeDir(): Promise<string> { return `${MAIN_ROOT}/runtime`; }
export async function templateDir(): Promise<string> { return `${MAIN_ROOT}/templates`; }
export async function videoDir(): Promise<string> { return `${MAIN_ROOT}/video`; }

export async function resolveResource(resourcePath: string): Promise<string> {
  return `${MAIN_ROOT}/resources/${String(resourcePath || '')}`.replace(/\/+/g, '/');
}

export async function resolve(...paths: string[]): Promise<string> {
  const valid = (paths || []).filter((p) => p !== null && p !== undefined && p !== '').map(String);
  if (valid.length === 0) return MAIN_ROOT;
  const joined = valid
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/EnCroissant\/documents\/EnCroissant\b/, '/EnCroissant/documents');
  return joined.startsWith('/') ? joined : `${MAIN_ROOT}/${joined}`.replace(/\/+/g, '/');
}

export async function join(...paths: string[]): Promise<string> {
  return resolve(...paths);
}

export async function normalize(p: string): Promise<string> {
  return safePathString(p);
}

export async function dirname(p: string): Promise<string> {
  const s = safePathString(p).replace(/\/+$/, '');
  return s.slice(0, Math.max(0, s.lastIndexOf('/'))) || '/';
}

export async function basename(p: string, ext?: string): Promise<string> {
  const s = safePathString(p).replace(/\/+$/, '');
  let base = s.slice(s.lastIndexOf('/') + 1);
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  return base;
}

export async function extname(p: string): Promise<string> {
  const base = await basename(p);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1) : '';
}

export async function isAbsolute(p: string): Promise<boolean> {
  return String(p || '').startsWith('/');
}

// @tauri-apps/plugin-fs functions (Backed by both Android main storage & localStorage VFS)
export async function exists(filePath: any, options?: any): Promise<boolean> {
  const raw = safePathString(filePath, options);
  if (
    raw === MAIN_ROOT ||
    raw.endsWith('/db') ||
    raw.endsWith('/engines') ||
    raw.endsWith('/puzzles') ||
    raw.endsWith('/documents') ||
    raw.endsWith('/EnCroissant') ||
    raw.endsWith('engines.json') ||
    raw.endsWith('.js') ||
    raw.endsWith('.wasm')
  ) {
    return true;
  }
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.exists === 'function') {
    try {
      if (bridge.exists(raw)) return true;
    } catch {}
  }
  if (getMemoryVfs().has(raw)) return true;
  if (localStorage.getItem(`ec_db_meta:${raw}`) !== null) return true;
  return localStorage.getItem(resolveVfsKey(filePath, options)) !== null;
}

export async function readTextFile(filePath: any, options?: any): Promise<string> {
  const raw = safePathString(filePath, options);
  const mem = getMemoryVfs();
  if (mem.has(raw)) return mem.get(raw)!;
  const k = resolveVfsKey(filePath, options);
  const val = localStorage.getItem(k);
  if (val !== null) {
    mem.set(raw, val);
    return val;
  }
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.readTextFile === 'function') {
    try {
      const nativeTxt = bridge.readTextFile(raw);
      if (nativeTxt) {
        mem.set(raw, nativeTxt);
        return nativeTxt;
      }
    } catch {}
  }
  if (raw.endsWith('engines.json')) {
    return localStorage.getItem('engines') || '[]';
  }
  return '';
}

export async function writeTextFile(filePath: any, data: string, options?: any): Promise<void> {
  const raw = safePathString(filePath, options);
  const chunk = String(data ?? '');
  const isAppend = Boolean(options?.append);
  const mem = getMemoryVfs();
  const prev = isAppend ? (mem.get(raw) ?? localStorage.getItem(resolveVfsKey(filePath, options)) ?? '') : '';
  const fullStr = isAppend && prev ? prev + (prev.endsWith('\n') ? '' : '\n') + chunk : chunk;
  mem.set(raw, fullStr);
  if (fullStr.length < 350000) {
    try {
      localStorage.setItem(resolveVfsKey(filePath, options), fullStr);
    } catch {}
  }
  const bridge = getAndroidBridge();
  if (bridge) {
    try {
      if (isAppend && typeof bridge.appendTextFile === 'function') {
        bridge.appendTextFile(raw, (prev && !prev.endsWith('\n') ? '\n' : '') + chunk);
      } else if (typeof bridge.writeTextFile === 'function') {
        bridge.writeTextFile(raw, fullStr);
      }
    } catch {}
  } else {
    const idb = getIosIdb();
    if (idb && typeof idb.put === 'function') {
      idb.put(raw, fullStr);
    }
  }
}

export async function readFile(filePath: any, options?: any): Promise<Uint8Array> {
  const txt = await readTextFile(filePath, options);
  return new TextEncoder().encode(txt);
}

export async function writeFile(filePath: any, data: Uint8Array | ArrayBuffer, options?: any): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data || new ArrayBuffer(0));
  const txt = new TextDecoder().decode(bytes);
  await writeTextFile(filePath, txt, options);
}

export async function readDir(dirPath: any, options?: any): Promise<any[]> {
  const idb = getIosIdb();
  if (idb && idb.readyPromise) {
    await idb.readyPromise;
  }
  const rawDir = safePathString(dirPath, options).replace(/\/+$/, '');
  const prefix = `${VFS_PREFIX}${rawDir}/`;
  const out: any[] = [];
  const seen = new Set<string>();

  for (const k of Array.from(getMemoryVfs().keys())) {
    if (k.startsWith(`${rawDir}/`)) {
      const rest = k.slice(rawDir.length + 1);
      const name = rest.split('/')[0];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({
          name,
          path: `${rawDir}/${name}`,
          isFile: !rest.includes('/'),
          isDirectory: rest.includes('/'),
          isSymlink: false,
        });
      }
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || '';
    if (k.startsWith(prefix)) {
      const rest = k.slice(prefix.length);
      const name = rest.split('/')[0];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({
          name,
          path: `${rawDir}/${name}`,
          isFile: !rest.includes('/'),
          isDirectory: rest.includes('/'),
          isSymlink: false,
        });
      }
    } else if (k.startsWith(`ec_db_meta:${rawDir}/`)) {
      const rest = k.slice(`ec_db_meta:${rawDir}/`.length);
      const name = rest.split('/')[0];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({
          name,
          path: `${rawDir}/${name}`,
          isFile: true,
          isDirectory: false,
          isSymlink: false,
        });
      }
    }
  }

  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.listFiles === 'function') {
    try {
      const jsonStr = bridge.listFiles(rawDir);
      const nativeEntries = JSON.parse(jsonStr || '[]');
      for (const item of nativeEntries) {
        if (item && item.name && !seen.has(item.name)) {
          seen.add(item.name);
          out.push({
            name: item.name,
            isFile: Boolean(item.isFile),
            isDirectory: Boolean(item.isDirectory),
            isSymlink: false,
          });
        }
      }
    } catch {}
  }

  return out;
}

export async function mkdir(dirPath: any, options?: any): Promise<void> {
  const raw = safePathString(dirPath, options);
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.mkdir === 'function') {
    try {
      bridge.mkdir(raw);
    } catch {}
  }
}

export async function remove(filePath: any, options?: any): Promise<void> {
  const raw = safePathString(filePath, options);
  localStorage.removeItem(resolveVfsKey(filePath, options));
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.deleteFile === 'function') {
    try {
      bridge.deleteFile(raw);
    } catch {}
  }
}

export async function rename(oldPath: any, newPath: any, options?: any): Promise<void> {
  const val = await readTextFile(oldPath, options);
  if (val !== null) {
    await writeTextFile(newPath, val, options);
    await remove(oldPath, options);
  }
}

export async function copyFile(fromPath: any, toPath: any, options?: any): Promise<void> {
  const val = await readTextFile(fromPath, options);
  if (val !== null) {
    await writeTextFile(toPath, val, options);
  }
}

export async function stat(_filePath: any, _options?: any): Promise<any> {
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
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.openFolder === 'function') {
      try {
        bridge.openFolder(options?.defaultPath || MAIN_ROOT);
      } catch {}
    }
    return options?.defaultPath || `${MAIN_ROOT}/documents`;
  }
  return new Promise((resolvePromise) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.multiple) input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        resolvePromise(null);
        return;
      }
      const paths: string[] = [];
      for (const f of files) {
        if (f.name.endsWith('.js') || f.name.endsWith('.wasm')) {
          paths.push(`${MAIN_ROOT}/engines/${f.name}`);
        } else {
          const text = await f.text();
          const vPath = `${MAIN_ROOT}/documents/${f.name}`;
          await writeTextFile(vPath, text);
          paths.push(vPath);
        }
      }
      resolvePromise(options?.multiple ? paths : paths[0]);
    };
    input.oncancel = () => resolvePromise(null);
    input.click();
  });
}

export async function save(options?: any): Promise<string | null> {
  const defaultName = options?.defaultPath ? String(options.defaultPath).split('/').pop() : 'game.pgn';
  return `${MAIN_ROOT}/documents/${defaultName || 'game.pgn'}`;
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
export const platform = () => 'macos';
export const type = () => 'macos';
export const arch = () => 'aarch64';
export const family = () => 'unix';
export const version = () => '14.0';
export const locale = async () => 'en-US';
export const exeExtension = () => '';
export const hostname = async () => 'android';
export const eol = () => '\n';

// @tauri-apps/plugin-opener (Opens /storage/emulated/0/EnCroissant on clicking the Folder icon!)
export async function openUrl(url: string) {
  window.open(url, '_blank');
}
export async function openPath(targetPath: string) {
  const clean = safePathString(targetPath);
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.openFolder === 'function') {
    try {
      bridge.openFolder(clean);
      return;
    } catch {}
  }
  window.alert(`En Croissant Storage Folder:\n${clean}\n\nAccessible in your Android Files app under Internal Storage > EnCroissant.`);
}
export async function revealItemInDir(targetPath: string) {
  await openPath(targetPath);
}

// @tauri-apps/plugin-process
export async function exit(_code = 0) {}
export async function relaunch() {
  window.location.reload();
}

// @tauri-apps/plugin-clipboard-manager
export async function writeText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
}
export async function readText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

// @tauri-apps/plugin-shell
export const openShell = openPath;
export const Command = {
  create: (_program: string, _args?: string | string[]) => ({
    execute: async () => ({ code: 0, signal: null, stdout: '', stderr: '' }),
    spawn: async () => ({ pid: 1, write: async () => {}, kill: async () => {} }),
    on: () => {},
    stdout: { on: () => {} },
    stderr: { on: () => {} },
  }),
};
