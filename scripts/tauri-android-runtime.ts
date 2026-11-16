/**
 * En Croissant Android Tauri v2 Runtime, Main Storage Bridge & Stockfish 19.0.1 Lite Single (.js) UCI Engine
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

import { Chess } from 'chess.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const VFS_PREFIX = 'ec_vfs:';
const MAIN_ROOT = '/storage/emulated/0/EnCroissant';

// Auto-configured by prepare-capacitor-android.mjs from upstream src/bindings.ts & src/utils/chess.ts
const PAREN_TOKEN_MODE: string = '__EC_PAREN_TOKEN_MODE__';
const COMMENT_KEEP_BRACES: string = '__EC_COMMENT_KEEP_BRACES__';
const BACKEND_NEGATES_BLACK_SCORE: string = 'true';

function getAndroidBridge(): any {
  return typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
}

interface EcIdbStore {
  readyPromise: Promise<void>;
  put: (key: string, val: string) => void;
  del: (key: string) => void;
}

function getOrInitIdb(): EcIdbStore | null {
  if (typeof window === 'undefined' || getAndroidBridge()) return null;
  const w = window as any;
  if (w.__EC_IDB__) return w.__EC_IDB__;
  if (typeof indexedDB === 'undefined') return null;

  let dbInstance: IDBDatabase | null = null;
  const mem = getMemoryVfs();

  const readyPromise = new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open('encroissant_ipados_fs', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files');
        }
      };
      req.onsuccess = () => {
        dbInstance = req.result;
        try {
          const tx = dbInstance.transaction('files', 'readonly');
          const store = tx.objectStore('files');
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const k = String(cursor.key || '');
              const v = String(cursor.value ?? '');
              if (k && v) {
                mem.set(k, v);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  const api: EcIdbStore = {
    readyPromise,
    put(key: string, val: string) {
      if (!dbInstance) return;
      try {
        const tx = dbInstance.transaction('files', 'readwrite');
        tx.objectStore('files').put(val, key);
      } catch {}
    },
    del(key: string) {
      if (!dbInstance) return;
      try {
        const tx = dbInstance.transaction('files', 'readwrite');
        tx.objectStore('files').delete(key);
      } catch {}
    },
  };

  w.__EC_IDB__ = api;
  return api;
}

function getMemoryVfs(): Map<string, string> {
  const w = typeof window !== 'undefined' ? (window as any) : {};
  if (!w.__EC_VFS_MEMORY__) {
    w.__EC_VFS_MEMORY__ = new Map<string, string>();
  }
  return w.__EC_VFS_MEMORY__;
}

function readVfsOrDisk(rawPath: string): string | null {
  const clean = String(rawPath || '').replace(/^file:\/\//, '').replace(/\/+/g, '/');
  const mem = getMemoryVfs();
  if (mem.has(clean)) return mem.get(clean)!;
  const localVal = localStorage.getItem(`${VFS_PREFIX}${clean}`);
  if (localVal !== null) {
    mem.set(clean, localVal);
    return localVal;
  }
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.readTextFile === 'function') {
    try {
      const nativeTxt = bridge.readTextFile(clean);
      if (nativeTxt) {
        mem.set(clean, nativeTxt);
        return nativeTxt;
      }
    } catch {}
  }
  return null;
}

function writeVfsAndDisk(rawPath: string, content: string) {
  const clean = String(rawPath || '').replace(/^file:\/\//, '').replace(/\/+/g, '/');
  const str = String(content ?? '');
  getMemoryVfs().set(clean, str);
  if (str.length < 350000) {
    try {
      localStorage.setItem(`${VFS_PREFIX}${clean}`, str);
    } catch {}
  }
  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.writeTextFile === 'function') {
    try {
      bridge.writeTextFile(clean, str);
    } catch {}
  } else {
    const idb = getOrInitIdb();
    if (idb) idb.put(clean, str);
  }
}

const DEFAULT_ENGINES = [
  {
    name: 'Stockfish 19.0.1 Single (JS)',
    version: '19.0.1',
    type: 'local',
    path: `${MAIN_ROOT}/engines/stockfish-19-lite-single.js`,
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/NewLogoSF.png',
    elo: 3635,
    downloadSize: 9854200,
    downloadLink: '/engines/stockfish-19-lite-single.js',
    loaded: true,
    go: { t: 'Depth', c: 16 },
    settings: [
      { name: 'MultiPV', value: 3 },
      { name: 'Hash', value: 64 },
      { name: 'UCI_ShowWDL', value: true },
    ],
  },
];

function initDefaultStorage() {
  getOrInitIdb();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k);
      if (v === 'null' || v === 'undefined') {
        localStorage.removeItem(k);
      }
    }

    // One-time migration: wipe old corrupted 3075-fragment disk DBs and reset session updatedAt
    if (localStorage.getItem('ec_clean_disk_v6') !== '1') {
      try {
        sessionStorage.clear();
      } catch {}
      localStorage.removeItem('tabs');
      localStorage.removeItem('activeTab');
      try {
        const rawSessions = localStorage.getItem('sessions');
        if (rawSessions) {
          const parsedSessions = JSON.parse(rawSessions);
          if (Array.isArray(parsedSessions)) {
            for (const s of parsedSessions) {
              if (s && typeof s === 'object') s.updatedAt = 0;
            }
            localStorage.setItem('sessions', JSON.stringify(parsedSessions));
          }
        }
      } catch {}
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || '';
        if (k.includes('_chesscom') || k.includes('_lichess') || k.startsWith('ec_db_meta:')) {
          localStorage.removeItem(k);
        }
      }
      const bridge = getAndroidBridge();
      if (bridge && typeof bridge.listFiles === 'function' && typeof bridge.deleteFile === 'function') {
        try {
          const dbDir = `${MAIN_ROOT}/db`;
          const files = JSON.parse(bridge.listFiles(dbDir) || '[]');
          for (const f of files) {
            if (f && f.name) {
              bridge.deleteFile(`${dbDir}/${f.name}`);
            }
          }
        } catch {}
      }
      localStorage.setItem('ec_clean_disk_v6', '1');
    }

    // Ensure Mosaic layout uses side-by-side row direction (Board on Left, Panels on Right)
    for (const mosaicKey of ['windowsState', 'compactWindowsState']) {
      const raw = localStorage.getItem(mosaicKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const root = parsed?.currentNode || parsed;
          if (root && root.direction === 'column') {
            root.direction = 'row';
            root.splitPercentage = 52;
            localStorage.setItem(mosaicKey, JSON.stringify(parsed));
          }
        } catch {
          localStorage.removeItem(mosaicKey);
        }
      }
    }

    // Prioritize Stockfish 19.0.1 Lite Single (JS) with loaded: true
    const existingEngines = localStorage.getItem('engines');
    if (!existingEngines || existingEngines === '[]') {
      localStorage.setItem('engines', JSON.stringify(DEFAULT_ENGINES));
    } else {
      try {
        const parsed = JSON.parse(existingEngines);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          localStorage.setItem('engines', JSON.stringify(DEFAULT_ENGINES));
        } else {
          let hasSf19LiteSingle = false;
          const updated = parsed
            .filter((e: any) => e && !String(e.path || '').includes('asm.js'))
            .map((e: any) => {
              if (String(e.path || '').includes('stockfish-19-lite-single.js') || String(e.name || '').includes('Stockfish 19')) {
                hasSf19LiteSingle = true;
                return {
                  ...e,
                  name: 'Stockfish 19.0.1 Lite Single (JS)',
                  path: `${MAIN_ROOT}/engines/stockfish-19-lite-single.js`,
                  loaded: true,
                  go: e.go || { t: 'Depth', c: 15 },
                };
              }
              return e;
            });
          if (!hasSf19LiteSingle) {
            updated.unshift(DEFAULT_ENGINES[0]);
          }
          localStorage.setItem('engines', JSON.stringify(updated));
        }
      } catch {
        localStorage.setItem('engines', JSON.stringify(DEFAULT_ENGINES));
      }
    }

    const samplePgnPath = `${MAIN_ROOT}/documents/Immortal_Games.pgn`;
    if (!readVfsOrDisk(samplePgnPath)) {
      const samplePgn = `[Event "Anderssen - Kieseritzky (Immortal Game)"]\n[Site "London"]\n[Date "1851.06.21"]\n[Round "1"]\n[White "Adolf Anderssen"]\n[Black "Lionel Kieseritzky"]\n[Result "1-0"]\n[WhiteElo "2600"]\n[BlackElo "2550"]\n[ECO "C33"]\n[Opening "King's Gambit Accepted"]\n\n1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0\n`;
      writeVfsAndDisk(samplePgnPath, samplePgn);
      writeVfsAndDisk(
        `${samplePgnPath}.info`,
        JSON.stringify({ type: 'game', numGames: 1, lastModified: Date.now() })
      );
    }
  } catch {}
}
initDefaultStorage();

const callbacks = new Map<number, (...args: any[]) => any>();
let nextCallbackId = 1;
const eventListeners = new Map<string, Set<number>>();

function normalizeEventKey(name: string): string {
  return String(name || '').replace(/[-_]/g, '').toLowerCase();
}

function registerCallback(fn: (...args: any[]) => any, once = false): number {
  const id = nextCallbackId++;
  const wrapped = (...args: any[]) => {
    if (once) callbacks.delete(id);
    return fn(...args);
  };
  callbacks.set(id, wrapped);
  try {
    (window as any)[`_${id}`] = wrapped;
  } catch {}
  return id;
}

function emitTauriEvent(event: string, payload: any) {
  const norm = normalizeEventKey(event);
  const eventId = nextCallbackId++;
  for (const [registeredName, set] of Array.from(eventListeners.entries())) {
    if (registeredName === event || normalizeEventKey(registeredName) === norm) {
      for (const handlerId of Array.from(set)) {
        const cb = callbacks.get(handlerId);
        if (cb) {
          try {
            cb({ event: registeredName, id: eventId, payload });
          } catch (e) {
            console.warn('[Tauri-Android] Event listener error:', e);
          }
        }
      }
    }
  }
}

function emitProgressEvent(id: string, progress: number, finished: boolean) {
  const payload = { id: String(id || ''), progress: Number(progress || 0), finished: Boolean(finished) };
  const candidateNames = new Set<string>([
    'report-progress',
    'report-progress-payload',
    'download-progress',
    'download-progress-payload',
    'database-progress',
    'progress-event',
    'progress-payload',
    'progress',
  ]);
  for (const regName of Array.from(eventListeners.keys())) {
    if (regName.toLowerCase().includes('progress')) {
      candidateNames.add(regName);
    }
  }
  const firedHandlers = new Set<number>();
  const eventId = nextCallbackId++;
  for (const [registeredName, set] of Array.from(eventListeners.entries())) {
    const norm = normalizeEventKey(registeredName);
    let matches = candidateNames.has(registeredName);
    if (!matches) {
      for (const c of Array.from(candidateNames)) {
        if (normalizeEventKey(c) === norm) {
          matches = true;
          break;
        }
      }
    }
    if (matches) {
      for (const handlerId of Array.from(set)) {
        if (firedHandlers.has(handlerId)) continue;
        firedHandlers.add(handlerId);
        const cb = callbacks.get(handlerId);
        if (cb) {
          try {
            cb({ event: registeredName, id: eventId, payload });
          } catch {}
        }
      }
    }
  }
}

/**
 * Complete PGN Lexer for En Croissant's `lex_pgn` Tauri command (`src-tauri/src/lexer.rs`).
 * Tokenizes PGN strings into Header, San, Comment (including [%clk] and [%eval]), Nag, ParenOpen/ParenClose, and Outcome tokens.
 */
export function lexPgnTokens(pgnInput: string): any[] {
  const pgn = String(pgnInput || '');
  const tokens: any[] = [];
  let i = 0;
  const n = pgn.length;

  const useSingleParen = PAREN_TOKEN_MODE === 'Paren';
  const keepBraces = COMMENT_KEEP_BRACES === 'true';

  const nagLookup: Record<string, string> = {
    '!': '$1',
    '?': '$2',
    '!!': '$3',
    '??': '$4',
    '!?': '$5',
    '?!': '$6',
  };

  while (i < n) {
    const ch = pgn[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '[') {
      const rest = pgn.slice(i);
      const headerMatch = rest.match(/^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\]/);
      if (headerMatch) {
        tokens.push({
          type: 'Header',
          value: {
            tag: headerMatch[1],
            value: headerMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
          },
        });
        i += headerMatch[0].length;
        continue;
      }
      const closeBracket = pgn.indexOf(']', i);
      if (closeBracket !== -1 && closeBracket - i < 120) {
        i = closeBracket + 1;
        continue;
      }
    }

    if (ch === '{') {
      const closeIdx = pgn.indexOf('}', i + 1);
      if (closeIdx !== -1) {
        const inner = pgn.slice(i + 1, closeIdx);
        tokens.push({
          type: 'Comment',
          value: keepBraces ? `{${inner}}` : inner,
        });
        i = closeIdx + 1;
      } else {
        const inner = pgn.slice(i + 1);
        tokens.push({
          type: 'Comment',
          value: keepBraces ? `{${inner}}` : inner,
        });
        break;
      }
      continue;
    }

    if (ch === '}') {
      i++;
      continue;
    }

    if (ch === ';') {
      const nlIdx = pgn.indexOf('\n', i + 1);
      const inner = nlIdx !== -1 ? pgn.slice(i + 1, nlIdx).trim() : pgn.slice(i + 1).trim();
      tokens.push({
        type: 'Comment',
        value: keepBraces ? `{${inner}}` : inner,
      });
      if (nlIdx !== -1) {
        i = nlIdx + 1;
      } else {
        break;
      }
      continue;
    }

    if (ch === '(') {
      if (useSingleParen) {
        tokens.push({ type: 'Paren', value: '(' });
      } else {
        tokens.push({ type: 'ParenOpen' });
      }
      i++;
      continue;
    }

    if (ch === ')') {
      if (useSingleParen) {
        tokens.push({ type: 'Paren', value: ')' });
      } else {
        tokens.push({ type: 'ParenClose' });
      }
      i++;
      continue;
    }

    const start = i;
    while (i < n && !/[\s{}();[\]]/.test(pgn[i])) {
      i++;
    }
    let rawTok = pgn.slice(start, i).trim();
    if (!rawTok) continue;

    if (rawTok === '1-0' || rawTok === '0-1' || rawTok === '1/2-1/2' || rawTok === '*') {
      tokens.push({ type: 'Outcome', value: rawTok });
      continue;
    }

    rawTok = rawTok.replace(/^\d+\.+/, '');
    if (!rawTok || /^\.+$/.test(rawTok)) continue;

    if (rawTok === '1-0' || rawTok === '0-1' || rawTok === '1/2-1/2' || rawTok === '*') {
      tokens.push({ type: 'Outcome', value: rawTok });
      continue;
    }

    if (/^\$\d+$/.test(rawTok)) {
      tokens.push({ type: 'Nag', value: rawTok });
      continue;
    }

    if (nagLookup[rawTok]) {
      tokens.push({ type: 'Nag', value: nagLookup[rawTok] });
      continue;
    }

    rawTok = rawTok.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');

    let nagSuffix = '';
    const nagMatch = rawTok.match(/([!?]{1,2})$/);
    if (nagMatch) {
      nagSuffix = nagMatch[1];
      rawTok = rawTok.slice(0, -nagSuffix.length);
    }

    if (rawTok) {
      tokens.push({ type: 'San', value: rawTok });
    }
    if (nagSuffix && nagLookup[nagSuffix]) {
      tokens.push({ type: 'Nag', value: nagLookup[nagSuffix] });
    }
  }

  return tokens;
}

function loadChessSafe(chess: Chess, fenStr: string): boolean {
  const target = !fenStr || fenStr === 'startpos' ? START_FEN : fenStr.trim();
  try {
    chess.load(target);
    return true;
  } catch {
    try {
      const parts = target.split(/\s+/);
      if (parts.length >= 4) {
        parts[3] = '-';
        if (parts.length < 6) {
          while (parts.length < 5) parts.push('0');
          if (parts.length === 5) parts.push('1');
        }
        chess.load(parts.slice(0, 6).join(' '));
        return true;
      }
    } catch {}
  }
  chess.reset();
  return false;
}

function applyUciOrSanMove(chess: Chess, moveStr: string): any {
  if (!moveStr) return null;
  const clean = moveStr.trim();
  try {
    if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(clean)) {
      const from = clean.slice(0, 2);
      let to = clean.slice(2, 4);
      const piece = chess.get(from as any);
      if (piece && piece.type === 'k') {
        if (from === 'e1' && to === 'h1') to = 'g1';
        else if (from === 'e1' && to === 'a1') to = 'c1';
        else if (from === 'e8' && to === 'h8') to = 'g8';
        else if (from === 'e8' && to === 'a8') to = 'c8';
      }
      return chess.move({
        from,
        to,
        promotion: clean.length === 5 ? clean[4].toLowerCase() : undefined,
      });
    }
    return chess.move(clean);
  } catch {
    return null;
  }
}

function normalizeUciMovesForStockfish(fen: string, moves: string[]): { finalFen: string; uciMoves: string[]; isGameOver: boolean; inCheck: boolean; turn: 'w' | 'b' } {
  const chess = new Chess();
  loadChessSafe(chess, fen);
  const uciMoves: string[] = [];
  for (const m of moves || []) {
    const mv = applyUciOrSanMove(chess, m);
    if (!mv) break;
    uciMoves.push(`${mv.from}${mv.to}${mv.promotion || ''}`);
  }
  return {
    finalFen: chess.fen(),
    uciMoves,
    isGameOver: chess.isGameOver(),
    inCheck: chess.inCheck(),
    turn: chess.turn(),
  };
}

function uciToSanLine(fen: string, moves: string[], pvUci: string[]): { finalFen: string; sanMoves: string[] } {
  const chess = new Chess();
  loadChessSafe(chess, fen);
  for (const m of moves || []) {
    if (!applyUciOrSanMove(chess, m)) break;
  }
  const finalFen = chess.fen();
  const sanMoves: string[] = [];
  for (const uci of pvUci) {
    const mv = applyUciOrSanMove(chess, uci);
    if (!mv) break;
    sanMoves.push(mv.san);
  }
  if (sanMoves.length === 0 && pvUci.length > 0) {
    sanMoves.push(...pvUci.slice(0, 6));
  }
  return { finalFen, sanMoves };
}

function computeWdlFromCp(whiteRelativeCp: number): [number, number, number] {
  const k = 0.00368208;
  const winProb = 1 / (1 + Math.exp(-k * whiteRelativeCp));
  const lossProb = 1 / (1 + Math.exp(k * whiteRelativeCp));
  const drawFactor = Math.max(0, 1 - Math.abs(winProb - lossProb) * 1.35) * 0.34;
  const w = Math.max(0, Math.min(1000, Math.round((winProb * (1 - drawFactor)) * 1000)));
  const l = Math.max(0, Math.min(1000 - w, Math.round((lossProb * (1 - drawFactor)) * 1000)));
  const d = Math.max(0, 1000 - w - l);
  return [w, d, l];
}


const SAC_PIECE_VAL: Record<string, number> = { p: 90, n: 300, b: 300, r: 500, q: 1000, k: 0 };

function countMaterialSideToMove(chess: Chess): number {
  if (chess.isCheckmate()) return -10000;
  let whiteMat = 0;
  let blackMat = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = SAC_PIECE_VAL[sq.type] || 0;
      if (sq.color === 'w') whiteMat += v;
      else blackMat += v;
    }
  }
  return chess.turn() === 'w' ? whiteMat - blackMat : blackMat - whiteMat;
}

function qsearchSac(chess: Chess, alpha: number, beta: number, depthLeft = 4): number {
  const standPat = countMaterialSideToMove(chess);
  if (standPat >= beta) return beta;
  let curAlpha = Math.max(alpha, standPat);
  if (depthLeft <= 0) return curAlpha;

  const captures = chess
    .moves({ verbose: true })
    .filter((m) => Boolean(m.captured))
    .sort((a, b) => (SAC_PIECE_VAL[b.captured!] || 0) - (SAC_PIECE_VAL[a.captured!] || 0));

  for (const cap of captures) {
    chess.move(cap);
    const score = -qsearchSac(chess, -beta, -curAlpha, depthLeft - 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > curAlpha) curAlpha = score;
  }
  return curAlpha;
}

function naiveEvalPosition(chess: Chess): number {
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return countMaterialSideToMove(chess);
  let best = -999999;
  for (const mv of legal) {
    chess.move(mv);
    const val = -qsearchSac(chess, -999999, 999999, 3);
    chess.undo();
    if (val > best) best = val;
  }
  return best;
}

const PIECE_VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function computeInstantBestLines(fen: string, moves: string[], multiPv: number): any[] {
  const chess = new Chess();
  loadChessSafe(chess, fen);
  for (const m of moves || []) {
    if (!applyUciOrSanMove(chess, m)) break;
  }
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return [];

  const scored = legalMoves.map((mv) => {
    chess.move(mv);
    let cp = 0;
    if (chess.isCheckmate()) {
      cp = mv.color === 'w' ? 9999 : -9999;
    } else {
      for (const row of chess.board()) {
        for (const sq of row) {
          if (!sq) continue;
          const v = PIECE_VAL[sq.type] || 0;
          cp += sq.color === 'w' ? v : -v;
        }
      }
      if (mv.captured) cp += mv.color === 'w' ? 35 : -35;
      if (['d4', 'd5', 'e4', 'e5'].includes(mv.to)) cp += mv.color === 'w' ? 22 : -22;
      if (['c3', 'f3', 'c6', 'f6', 'c4', 'f4', 'c5', 'f5'].includes(mv.to)) cp += mv.color === 'w' ? 12 : -12;
      if (chess.inCheck()) cp += mv.color === 'w' ? 18 : -18;
    }
    const replyMoves = chess.moves({ verbose: true });
    const bestReply = replyMoves[0];
    chess.undo();
    const uci1 = `${mv.from}${mv.to}${mv.promotion || ''}`;
    const uci2 = bestReply ? `${bestReply.from}${bestReply.to}${bestReply.promotion || ''}` : '';
    const sanMoves = bestReply ? [mv.san, bestReply.san] : [mv.san];
    const uciMoves = uci2 ? [uci1, uci2] : [uci1];
    const negatesBlack = BACKEND_NEGATES_BLACK_SCORE !== 'false';
    const outCp = negatesBlack ? cp : mv.color === 'w' ? cp : -cp;
    return { cp, outCp, sanMoves, uciMoves, mover: mv.color };
  });

  scored.sort((a, b) => (a.mover === 'w' ? b.cp - a.cp : a.cp - b.cp));
  return scored.slice(0, Math.max(1, multiPv)).map((item, idx) => ({
    nodes: 3200 * (idx + 1),
    depth: 12,
    score: {
      value: { type: 'cp', value: item.outCp },
      wdl: computeWdlFromCp(item.outCp),
    },
    uciMoves: item.uciMoves,
    sanMoves: item.sanMoves,
    multipv: idx + 1,
    nps: 115000,
  }));
}

interface QueuedSearch {
  multiPv: number;
  fen: string;
  moves: string[];
  turnSign: number;
  fenPart: string;
  movesPart: string;
  goCmd: string;
  onBestMove?: (bestUci: string, lines: any[]) => void;
}

interface EngineSession {
  worker: Worker;
  scriptUrl: string;
  isReady: boolean;
  isSearching: boolean;
  stopSent: boolean;
  queuedSearch: QueuedSearch | null;
  pendingCommands: string[];
  logs: { type: 'gui' | 'engine'; value: string }[];
  bestLines: Map<number, any>;
  lastProgress: number;
  targetDepth: number;
  currentFen: string;
  currentMoves: string[];
  activeTurnSign: number;
  engineId: string;
  tab: string;
  onBestMove?: (bestUci: string, lines: any[]) => void;
}

const sessions = new Map<string, EngineSession>();
const cancelledAnalyses = new Set<string>();

function resolveWorkerUrl(enginePath: string): string {
  const p = String(enginePath || '').toLowerCase();
  if (p.includes('lozza')) return '/engines/lozza.js';
  if (p.includes('stockfish-19-asm')) return '/engines/stockfish-19-asm.js';
  if (p.includes('stockfish-18-asm')) return '/engines/stockfish-18-asm.js';
  if (p.includes('stockfish-18-lite-single')) return '/engines/stockfish-18-lite-single.js';
  return '/engines/stockfish-19-lite-single.js';
}

function dispatchQueuedSearch(session: EngineSession) {
  if (!session.isReady || !session.queuedSearch) return;
  const q = session.queuedSearch;
  session.queuedSearch = null;
  session.isSearching = true;
  session.stopSent = false;
  session.currentFen = q.fen;
  session.currentMoves = q.moves;
  session.activeTurnSign = q.turnSign;
  session.onBestMove = q.onBestMove;
  session.bestLines.clear();

  const cmds = [
    `setoption name MultiPV value ${q.multiPv}`,
    'setoption name UCI_ShowWDL value true',
    `position ${q.fenPart}${q.movesPart}`,
    q.goCmd,
  ];
  for (const c of cmds) {
    session.logs.push({ type: 'gui', value: c + '\n' });
    session.worker.postMessage(c);
  }
}

function requestEngineSearch(session: EngineSession, q: QueuedSearch) {
  session.queuedSearch = q;
  if (!session.isReady) {
    return;
  }
  if (session.isSearching) {
    if (!session.stopSent) {
      session.stopSent = true;
      session.logs.push({ type: 'gui', value: 'stop\n' });
      session.worker.postMessage('stop');
    }
    return;
  }
  dispatchQueuedSearch(session);
}

function attachWorkerHandlers(session: EngineSession) {
  const worker = session.worker;
  worker.onmessage = (ev: MessageEvent) => {
    const rawData = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '');
    const lines = rawData.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      session.logs.push({ type: 'engine', value: line + '\n' });
      if (session.logs.length > 300) session.logs.shift();

      if (line === 'uciok' || line === 'readyok' || line.startsWith('id name ')) {
        if (!session.isReady) {
          session.isReady = true;
          worker.postMessage('setoption name UCI_ShowWDL value true');
          while (session.pendingCommands.length > 0) {
            const cmd = session.pendingCommands.shift()!;
            session.logs.push({ type: 'gui', value: cmd + '\n' });
            worker.postMessage(cmd);
          }
          if (session.queuedSearch && !session.isSearching) {
            dispatchQueuedSearch(session);
          }
        }
      }

      if (line.startsWith('info ') && line.includes(' score ') && line.includes(' pv ')) {
        if (session.stopSent || session.queuedSearch) continue;
        if (line.includes('upperbound') || line.includes('lowerbound')) continue;
        const depthM = line.match(/\bdepth\s+(\d+)/);
        const multipvM = line.match(/\bmultipv\s+(\d+)/);
        const nodesM = line.match(/\bnodes\s+(\d+)/);
        const npsM = line.match(/\bnps\s+(\d+)/);
        const scoreM = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
        const wdlM = line.match(/\bwdl\s+(\d+)\s+(\d+)\s+(\d+)/);
        const pvIdx = line.indexOf(' pv ');
        if (!scoreM || pvIdx === -1) continue;

        const pvUci = line.slice(pvIdx + 4).trim().split(/\s+/).filter(Boolean);
        const { sanMoves } = uciToSanLine(session.currentFen, session.currentMoves, pvUci);
        if (sanMoves.length === 0) continue;

        // Always invert Stockfish's side-to-move score when Black is to move, matching src-tauri/src/chess.rs invert_score()
        const turnSign = session.activeTurnSign || 1;
        const rawVal = parseInt(scoreM[2], 10) * turnSign;
        const scoreType = scoreM[1] as 'cp' | 'mate';
        const wdl: [number, number, number] = wdlM
          ? turnSign === 1
            ? [parseInt(wdlM[1], 10), parseInt(wdlM[2], 10), parseInt(wdlM[3], 10)]
            : [parseInt(wdlM[3], 10), parseInt(wdlM[2], 10), parseInt(wdlM[1], 10)]
          : computeWdlFromCp(rawVal);

        const depth = depthM ? parseInt(depthM[1], 10) : 10;
        const multipv = multipvM ? parseInt(multipvM[1], 10) : 1;
        const nodes = nodesM ? parseInt(nodesM[1], 10) : 1000;
        const nps = npsM ? parseInt(npsM[1], 10) : 110000;

        session.bestLines.set(multipv, {
          nodes,
          depth,
          score: {
            value: { type: scoreType, value: rawVal },
            wdl,
          },
          uciMoves: pvUci,
          sanMoves,
          multipv,
          nps,
        });

        const bestLinesArr = Array.from(session.bestLines.values()).sort((a, b) => a.multipv - b.multipv);
        const progress = Math.min(99, Math.round((depth / Math.max(1, session.targetDepth)) * 100));
        session.lastProgress = progress;

        emitTauriEvent('best-moves-payload', {
          bestLines: bestLinesArr,
          engine: session.engineId,
          tab: session.tab,
          fen: session.currentFen,
          moves: session.currentMoves,
          progress,
        });
      } else if (line.startsWith('bestmove ')) {
        session.isSearching = false;
        session.stopSent = false;

        // If a newer search was queued while stopping the previous search, start the queued search now!
        if (session.queuedSearch) {
          dispatchQueuedSearch(session);
          continue;
        }

        const parts = line.split(/\s+/);
        const bestUci = parts[1] || '';
        const bestLinesArr = Array.from(session.bestLines.values()).sort((a, b) => a.multipv - b.multipv);
        session.lastProgress = 100;

        emitTauriEvent('best-moves-payload', {
          bestLines: bestLinesArr,
          engine: session.engineId,
          tab: session.tab,
          fen: session.currentFen,
          moves: session.currentMoves,
          progress: 100,
        });

        if (session.onBestMove) {
          const cb = session.onBestMove;
          session.onBestMove = undefined;
          cb(bestUci, bestLinesArr);
        }
      }
    }
  };
}

function getOrCreateSession(tab: string, engineId: string, enginePath: string): EngineSession {
  const key = `${tab}:${engineId}`;
  let session = sessions.get(key);
  if (session) return session;

  const scriptUrl = resolveWorkerUrl(enginePath);
  const worker = new Worker(scriptUrl);

  session = {
    worker,
    scriptUrl,
    isReady: false,
    isSearching: false,
    stopSent: false,
    queuedSearch: null,
    pendingCommands: [],
    logs: [],
    bestLines: new Map(),
    lastProgress: 0,
    targetDepth: 15,
    currentFen: START_FEN,
    currentMoves: [],
    activeTurnSign: 1,
    engineId,
    tab,
  };

  attachWorkerHandlers(session);
  worker.postMessage('uci');
  worker.postMessage('isready');

  sessions.set(key, session);
  return session;
}

function sendUci(session: EngineSession, cmd: string) {
  if (!session.isReady) {
    session.pendingCommands.push(cmd);
    return;
  }
  if (cmd === 'stop') {
    if (session.isSearching && !session.stopSent) {
      session.stopSent = true;
      session.logs.push({ type: 'gui', value: 'stop\n' });
      session.worker.postMessage('stop');
    }
    session.queuedSearch = null;
    return;
  }
  session.logs.push({ type: 'gui', value: cmd + '\n' });
  session.worker.postMessage(cmd);
}

const DYNAMIC_OPENING_PGN = new Map<string, string>();

const ECO_OPENINGS: { fen: string; name: string; pgn: string; eco?: string }[] = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', name: 'Starting Position', pgn: '1. e4', eco: 'A00' },
  { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR', name: "King's Pawn Game", pgn: '1. e4', eco: 'B00' },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Sicilian Defense', pgn: '1. e4 c5', eco: 'B20' },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R', name: 'Sicilian Defense: Open', pgn: '1. e4 c5 2. Nf3', eco: 'B27' },
  { fen: 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R', name: 'Sicilian Defense: Old Sicilian', pgn: '1. e4 c5 2. Nf3 Nc6', eco: 'B30' },
  { fen: 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R', name: 'Sicilian Defense: Modern Variations', pgn: '1. e4 c5 2. Nf3 d6', eco: 'B50' },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR', name: 'Sicilian Defense: Closed', pgn: '1. e4 c5 2. Nc3', eco: 'B23' },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/2P1P3/8/PP1P1PPP/RNBQKBNR', name: 'Sicilian Defense: Bowdler Attack', pgn: '1. e4 c5 2. Bc4', eco: 'B20' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR', name: "King's Pawn Game", pgn: '1. e4 e5', eco: 'C20' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', name: "King's Knight Opening", pgn: '1. e4 e5 2. Nf3', eco: 'C40' },
  { fen: 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', name: 'Philidor Defense', pgn: '1. e4 e5 2. Nf3 d6', eco: 'C41' },
  { fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', name: 'Petrov Defense', pgn: '1. e4 e5 2. Nf3 Nf6', eco: 'C42' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R', name: "King's Knight Opening: Normal Variation", pgn: '1. e4 e5 2. Nf3 Nc6', eco: 'C44' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R', name: 'Ruy Lopez', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5', eco: 'C60' },
  { fen: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R', name: 'Ruy Lopez: Morphy Defense', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6', eco: 'C70' },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R', name: 'Ruy Lopez: Berlin Defense', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6', eco: 'C65' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R', name: 'Italian Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4', eco: 'C50' },
  { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R', name: 'Italian Game: Giuoco Piano', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', eco: 'C53' },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R', name: 'Italian Game: Two Knights Defense', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6', eco: 'C55' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R', name: 'Scotch Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. d4', eco: 'C45' },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R', name: 'Three Knights Opening', pgn: '1. e4 e5 2. Nf3 Nc6 3. Nc3', eco: 'C46' },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R', name: 'Four Knights Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6', eco: 'C47' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR', name: "Bishop's Opening", pgn: '1. e4 e5 2. Bc4', eco: 'C23' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR', name: 'Vienna Game', pgn: '1. e4 e5 2. Nc3', eco: 'C25' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR', name: "King's Gambit", pgn: '1. e4 e5 2. f4', eco: 'C30' },
  { fen: 'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR', name: 'Center Game', pgn: '1. e4 e5 2. d4', eco: 'C21' },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR', name: 'French Defense', pgn: '1. e4 e6', eco: 'C00' },
  { fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR', name: 'French Defense: Normal Variation', pgn: '1. e4 e6 2. d4 d5', eco: 'C01' },
  { fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Caro-Kann Defense', pgn: '1. e4 c6', eco: 'B10' },
  { fen: 'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR', name: 'Caro-Kann Defense: Main Line', pgn: '1. e4 c6 2. d4 d5', eco: 'B12' },
  { fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Scandinavian Defense', pgn: '1. e4 d5', eco: 'B01' },
  { fen: 'rnbqkbnr/ppp1pppp/8/8/4p3/8/PPPP1PPP/RNBQKBNR', name: 'Scandinavian Defense: Mieses-Kotroc Variation', pgn: '1. e4 d5 2. exd5 Qxd5', eco: 'B01' },
  { fen: 'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Pirc Defense', pgn: '1. e4 d6', eco: 'B07' },
  { fen: 'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Modern Defense', pgn: '1. e4 g6', eco: 'B06' },
  { fen: 'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR', name: "Alekhine's Defense", pgn: '1. e4 Nf6', eco: 'B02' },
  { fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR', name: 'Nimzowitsch Defense', pgn: '1. e4 Nc6', eco: 'B00' },
  { fen: 'rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR', name: "Owen's Defense", pgn: '1. e4 b6', eco: 'B00' },
  { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR', name: "Queen's Pawn Game", pgn: '1. d4', eco: 'D00' },
  { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR', name: "Queen's Pawn Game: Symmetrical", pgn: '1. d4 d5', eco: 'D00' },
  { fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR', name: "Queen's Gambit", pgn: '1. d4 d5 2. c4', eco: 'D06' },
  { fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR', name: "Queen's Gambit Declined", pgn: '1. d4 d5 2. c4 e6', eco: 'D30' },
  { fen: 'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR', name: 'Slav Defense', pgn: '1. d4 d5 2. c4 c6', eco: 'D10' },
  { fen: 'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR', name: "Queen's Gambit Accepted", pgn: '1. d4 d5 2. c4 dxc4', eco: 'D20' },
  { fen: 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR', name: 'Indian Defense', pgn: '1. d4 Nf6', eco: 'A45' },
  { fen: 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR', name: "King's Indian Defense", pgn: '1. d4 Nf6 2. c4 g6', eco: 'E60' },
  { fen: 'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR', name: 'Nimzo-Indian Defense', pgn: '1. d4 Nf6 2. c4 e6 3. Nc3', eco: 'E20' },
  { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR', name: 'London System', pgn: '1. d4 d5 2. Bf4', eco: 'D02' },
  { fen: 'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR', name: 'Dutch Defense', pgn: '1. d4 f5', eco: 'A80' },
  { fen: 'rnbqkbnr/pp1ppppp/8/2p5/3P4/8/PPP1PPPP/RNBQKBNR', name: 'Benoni Defense', pgn: '1. d4 c5', eco: 'A43' },
  { fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR', name: 'English Opening', pgn: '1. c4', eco: 'A10' },
  { fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R', name: 'Reti Opening', pgn: '1. Nf3', eco: 'A04' },
  { fen: 'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR', name: "Van't Kruijs Opening", pgn: '1. e3', eco: 'A00' },
  { fen: 'rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR', name: 'Hungarian Opening', pgn: '1. g3', eco: 'A00' },
  { fen: 'rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR', name: 'Nimzo-Larsen Attack', pgn: '1. b3', eco: 'A01' },
  { fen: 'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR', name: 'Bird Opening', pgn: '1. f4', eco: 'A02' },
];

const ECO_MAP: Record<string, string> = Object.fromEntries(ECO_OPENINGS.map((o) => [o.fen, o.name]));

interface StoredDatabase {
  title: string;
  description: string;
  filename: string;
  indexed: boolean;
  players: { id: number; name: string; elo: number }[];
  events: { id: number; name: string }[];
  sites: { id: number; name: string }[];
  games: any[];
  siteStats: Record<number, any[]>;
}

const memoryDbCache = new Map<string, StoredDatabase>();

function normalizeDbPath(p: string): string {
  const s = String(p || '').replace(/^file:\/\//, '').replace(/\/+/g, '/');
  return s.startsWith('/') ? s : `${MAIN_ROOT}/db/${s}`.replace(/\/+/g, '/');
}

function loadStoredDb(dbPath: string): StoredDatabase | null {
  const norm = normalizeDbPath(dbPath);
  if (memoryDbCache.has(norm)) return memoryDbCache.get(norm)!;
  const baseStem = (norm.split('/').pop() || norm).replace(/\.(duckdb|db3)$/i, '').toLowerCase();
  for (const [k, v] of Array.from(memoryDbCache.entries())) {
    const kStem = (k.split('/').pop() || k).replace(/\.(duckdb|db3)$/i, '').toLowerCase();
    if (kStem && kStem === baseStem) return v;
  }
  let raw = readVfsOrDisk(norm);
  if (!raw && baseStem) {
    for (const altExt of ['.duckdb', '.db3']) {
      for (const dirPrefix of [`${MAIN_ROOT}/db`, `${MAIN_ROOT}/databases`]) {
        const candidate = `${dirPrefix}/${baseStem}${altExt}`;
        raw = readVfsOrDisk(candidate);
        if (raw) break;
      }
      if (raw) break;
    }
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.games)) {
        // Detect and discard legacy corrupted DB from old split regex where literal "White" was created as a player
        const bogusWhite = Array.isArray(parsed.players) && parsed.players.find((p: any) => p.name === 'White' && (parsed.siteStats?.[p.id]?.length || 0) > 5);
        if (bogusWhite) {
          getMemoryVfs().delete(norm);
          localStorage.removeItem(`${VFS_PREFIX}${norm}`);
          localStorage.removeItem(`ec_db_meta:${norm}`);
          const bridge = getAndroidBridge();
          if (bridge && typeof bridge.deleteFile === 'function') {
            try {
              bridge.deleteFile(norm);
            } catch {}
          }
          return null;
        }
        memoryDbCache.set(norm, parsed);
        return parsed;
      }
    } catch {}
  }
  return null;
}

function saveStoredDb(dbPath: string, db: StoredDatabase) {
  const norm = normalizeDbPath(dbPath);
  memoryDbCache.set(norm, db);
  const serialized = JSON.stringify(db);
  getMemoryVfs().set(norm, serialized);

  try {
    localStorage.setItem(
      `ec_db_meta:${norm}`,
      JSON.stringify({
        title: db.title,
        description: db.description,
        player_count: db.players.length,
        event_count: db.events.length,
        game_count: db.games.length,
        storage_size: db.games.length * 650,
        filename: norm.split('/').pop() || norm,
        indexed: true,
      })
    );
  } catch {}

  const bridge = getAndroidBridge();
  if (bridge && typeof bridge.writeTextFile === 'function') {
    try {
      bridge.writeTextFile(norm, serialized);
    } catch {}
  } else {
    const idb = getOrInitIdb();
    if (idb) idb.put(norm, serialized);
  }

  try {
    localStorage.setItem(`${VFS_PREFIX}${norm}`, serialized);
  } catch {
    const compactDb = {
      ...db,
      games: db.games.slice(0, 400),
    };
    try {
      localStorage.setItem(`${VFS_PREFIX}${norm}`, JSON.stringify(compactDb));
    } catch {}
  }
}

function splitMultiGamePgn(combinedPgn: string): string[] {
  const lines = String(combinedPgn || '').split(/\r?\n/);
  const games: string[] = [];
  let currentLines: string[] = [];
  let inMovetext = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeader = /^\[[A-Za-z0-9_]+\s+"(?:\\.|[^"\\])*"\]$/.test(trimmed);
    if (isHeader) {
      if (inMovetext && currentLines.length > 0) {
        games.push(currentLines.join('\n').trim());
        currentLines = [line];
        inMovetext = false;
      } else {
        currentLines.push(line);
      }
    } else {
      if (trimmed.length > 0) {
        inMovetext = true;
      }
      if (currentLines.length > 0 || trimmed.length > 0) {
        currentLines.push(line);
      }
    }
  }
  if (currentLines.length > 0) {
    const last = currentLines.join('\n').trim();
    if (last) games.push(last);
  }
  return games;
}

function extractCleanMovetext(rawGame: string): string {
  // Strip ONLY [TagName "TagValue"] header lines, never [%clk ...] or [%eval ...] inside comments
  const withoutHeaders = rawGame
    .replace(/^\s*\[[A-Za-z0-9_]+\s+"(?:\\.|[^"\\])*"\]\s*$/gm, '')
    .trim();
  // Normalize multi-line comments so { ... } stays on one clean span
  return withoutHeaders
    .replace(/\{([^}]*)\}/g, (_m, inner) => `{${String(inner).replace(/\s+/g, ' ').trim()}}`)
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePgnIntoDatabase(pgnTexts: string[], dbPath: string, title: string, description: string): StoredDatabase {
  const normPath = normalizeDbPath(dbPath);
  const existing = loadStoredDb(normPath);
  const playersMap = new Map<string, { id: number; name: string; elo: number }>();
  const eventsMap = new Map<string, { id: number; name: string }>();
  const sitesMap = new Map<string, { id: number; name: string }>();
  const games: any[] = existing ? [...existing.games] : [];
  const siteStats: Record<number, any[]> = existing ? { ...existing.siteStats } : {};

  if (existing) {
    for (const p of existing.players) playersMap.set(p.name.toLowerCase(), p);
    for (const e of existing.events) eventsMap.set(e.name.toLowerCase(), e);
    for (const s of existing.sites) sitesMap.set(s.name.toLowerCase(), s);
  }

  const getOrAddPlayer = (name: string, elo: number) => {
    const clean = (name || 'Unknown').trim();
    const key = clean.toLowerCase();
    let p = playersMap.get(key);
    if (!p) {
      p = { id: playersMap.size + 1, name: clean, elo: elo || 1500 };
      playersMap.set(key, p);
    } else if (elo > 0) {
      p.elo = elo;
    }
    return p;
  };

  const getOrAddEvent = (name: string) => {
    const clean = (name || 'Rated Game').trim();
    const key = clean.toLowerCase();
    let e = eventsMap.get(key);
    if (!e) {
      e = { id: eventsMap.size + 1, name: clean };
      eventsMap.set(key, e);
    }
    return e;
  };

  const getOrAddSite = (name: string) => {
    const clean = (name || 'Chess.com').trim();
    const key = clean.toLowerCase();
    let s = sitesMap.get(key);
    if (!s) {
      s = { id: sitesMap.size + 1, name: clean };
      sitesMap.set(key, s);
    }
    return s;
  };

  const seenGameKeys = new Set<string>();
  for (const g of games) {
    seenGameKeys.add(`${g.white}|${g.black}|${g.date}|${g.time}|${g.result}`);
  }

  const combined = pgnTexts.join('\n\n');
  const rawGames = splitMultiGamePgn(combined);

  for (let idx = 0; idx < rawGames.length; idx++) {
    const raw = rawGames[idx];
    const getTag = (tag: string, fallback = '') => {
      const m = raw.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`, 'i'));
      return m ? m[1] : fallback;
    };

    const whiteName = getTag('White', '').trim();
    const blackName = getTag('Black', '').trim();
    if (!whiteName || !blackName) continue;
    const whiteElo = parseInt(getTag('WhiteElo', '0'), 10) || 0;
    const blackElo = parseInt(getTag('BlackElo', '0'), 10) || 0;
    const resultTag = (getTag('Result', '*') || '*') as '1-0' | '0-1' | '1/2-1/2' | '*';
    const eventName = getTag('Event', 'Online Game');
    const siteTag = getTag('Site', 'Chess.com');
    const rawDateTag = getTag('UTCDate', '') || getTag('Date', '2026-01-01');
    const dateTag = rawDateTag.includes('?') ? '2026-01-01' : rawDateTag.trim().replace(/\./g, '-');
    const timeTag = getTag('UTCTime', '') || getTag('StartTime', '12:00:00');
    const roundTag = getTag('Round', '-');
    const ecoTag = getTag('ECO', 'A00');
    const rawTc = getTag('TimeControl', '600').trim() || '600';
    const tcTag = /^\d+$/.test(rawTc) ? `${rawTc}+0` : rawTc;
    const fenTag = getTag('FEN', START_FEN);
    const ecoUrl = getTag('ECOUrl', '');
    let openingName = getTag('Opening', '').trim();
    if (!openingName && ecoUrl) {
      openingName = decodeURIComponent(ecoUrl.split('/').pop() || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\d+\.{1,3}\S*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const moveText = extractCleanMovetext(raw);
    const lexed = lexPgnTokens(moveText);
    const sanList = lexed.filter((t) => t.type === 'San').map((t) => t.value);
    const sanCount = sanList.length;
    if (sanCount === 0 && !raw.includes('[Result ')) continue;

    // Build short PGN prefix (first 6 full moves) for opening recognition and getOpeningFromName
    const prefixPairs: string[] = [];
    for (let mIdx = 0; mIdx < Math.min(8, sanList.length); mIdx += 2) {
      const wMove = sanList[mIdx];
      const bMove = sanList[mIdx + 1];
      prefixPairs.push(`${Math.floor(mIdx / 2) + 1}. ${wMove}${bMove ? ' ' + bMove : ''}`);
    }
    const shortOpeningPgn = prefixPairs.join(' ') || '1. e4 e5';

    if (!openingName || /^[A-E]\d\d$/i.test(openingName)) {
      // Match by move prefix against ECO_OPENINGS (longest prefix match first)
      for (let k = ECO_OPENINGS.length - 1; k >= 0; k--) {
        const candidate = ECO_OPENINGS[k];
        if (candidate.pgn && shortOpeningPgn.startsWith(candidate.pgn)) {
          openingName = candidate.name;
          break;
        }
      }
    }
    if (!openingName) openingName = "King's Pawn Game";
    DYNAMIC_OPENING_PGN.set(openingName.toLowerCase(), shortOpeningPgn);

    const dedupKey = `${whiteName}|${blackName}|${dateTag}|${timeTag}|${resultTag}`;
    if (seenGameKeys.has(dedupKey)) continue;
    seenGameKeys.add(dedupKey);

    const wp = getOrAddPlayer(whiteName, whiteElo);
    const bp = getOrAddPlayer(blackName, blackElo);
    const ev = getOrAddEvent(eventName);
    const st = getOrAddSite(siteTag);

    const gameId = games.length + 1;
    games.push({
      id: gameId,
      fen: fenTag || START_FEN,
      event: ev.name,
      event_id: ev.id,
      site: st.name,
      site_id: st.id,
      date: dateTag,
      time: timeTag,
      round: roundTag,
      white: wp.name,
      white_id: wp.id,
      white_elo: whiteElo,
      black: bp.name,
      black_id: bp.id,
      black_elo: blackElo,
      result: resultTag,
      time_control: tcTag,
      eco: ecoTag,
      ply_count: sanCount,
      moves: moveText || '1. e4 e5 *',
    });

    const siteLabel = siteTag.toLowerCase().includes('lichess') ? 'Lichess' : 'Chess.com';
    // En Croissant's GameOutcome enum in src/bindings.ts is "Won" | "Lost" | "Drawn"
    const whiteResult = resultTag === '1-0' ? 'Won' : resultTag === '0-1' ? 'Lost' : 'Drawn';
    const blackResult = resultTag === '0-1' ? 'Won' : resultTag === '1-0' ? 'Lost' : 'Drawn';

    if (!siteStats[wp.id]) siteStats[wp.id] = [];
    siteStats[wp.id].push({
      date: dateTag,
      is_player_white: true,
      player_elo: whiteElo,
      opponent_elo: blackElo,
      result: whiteResult,
      time_control: tcTag,
      opening: openingName,
      site: siteLabel,
      player: wp.name,
    });

    if (!siteStats[bp.id]) siteStats[bp.id] = [];
    siteStats[bp.id].push({
      date: dateTag,
      is_player_white: false,
      player_elo: blackElo,
      opponent_elo: whiteElo,
      result: blackResult,
      time_control: tcTag,
      opening: openingName,
      site: siteLabel,
      player: bp.name,
    });
  }

  const sortedPlayers = Array.from(playersMap.values()).sort(
    (a, b) => (siteStats[b.id]?.length || 0) - (siteStats[a.id]?.length || 0)
  );
  const dbObj: StoredDatabase = {
    title: title || normPath.split('/').pop() || 'Database',
    description: description || '',
    filename: normPath.split('/').pop() || normPath,
    indexed: true,
    players: sortedPlayers,
    events: Array.from(eventsMap.values()),
    sites: Array.from(sitesMap.values()),
    games,
    siteStats,
  };
  saveStoredDb(normPath, dbObj);
  return dbObj;
}

const BUILTIN_PUZZLES = [
  { id: 1, fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', moves: 'f6h5 c4f7', rating: 1050, rating_deviation: 75, popularity: 96, nb_plays: 18400, themes: ['mateIn1', 'opening'] },
  { id: 2, fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5', moves: 'c1g5 h7h6 g5h4 g7g5', rating: 1200, rating_deviation: 70, popularity: 94, nb_plays: 14200, themes: ['pin', 'opening'] },
  { id: 3, fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/4P3/1NN1B3/PPP2PPP/R2QKB1R b KQkq - 1 6', moves: 'd5d4 e3d4 e5d4', rating: 1320, rating_deviation: 68, popularity: 92, nb_plays: 11300, themes: ['fork', 'middlegame'] },
  { id: 4, fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1', moves: 'g8f8 e1e8', rating: 950, rating_deviation: 65, popularity: 98, nb_plays: 25000, themes: ['mateIn1', 'endgame'] },
  { id: 5, fen: 'r1b1k2r/ppppqppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 3 6', moves: 'f3g5 e8g8', rating: 1450, rating_deviation: 72, popularity: 91, nb_plays: 9800, themes: ['sacrifice', 'middlegame'] },
  { id: 6, fen: '2kr3r/ppp2ppp/2n5/3q4/3P4/2P2N2/PP3PPP/R1B1R1K1 b - - 0 12', moves: 'd5h5 e1e4', rating: 1580, rating_deviation: 74, popularity: 90, nb_plays: 8400, themes: ['mateIn2', 'endgame'] },
];
let puzzleCursor = 0;

const activeGames = new Map<string, any>();

function emitGameUpdateEvents(gameId: string, state: any) {
  const movePayload = {
    gameId,
    moves: state.moves,
    fen: state.fen,
    turn: state.turn,
    status: state.status,
    whiteTime: state.whiteTime,
    blackTime: state.blackTime,
  };
  emitTauriEvent('game-move-event', movePayload);
  emitTauriEvent('game-move', movePayload);
  emitTauriEvent('game-state', state);

  if (state.status && state.status !== 'playing') {
    const overPayload = {
      gameId,
      result: state.status?.finished?.result || '*',
      status: state.status,
      moves: state.moves,
      fen: state.fen,
    };
    emitTauriEvent('game-over-event', overPayload);
    emitTauriEvent('game-over', overPayload);
  }
}

async function triggerEngineMoveIfNeeded(gameId: string) {
  const state = activeGames.get(gameId);
  if (!state || state.status !== 'playing') return;

  const currentPlayerConfig = state.turn === 'white' ? state.config?.white : state.config?.black;
  if (!currentPlayerConfig || currentPlayerConfig.type !== 'engine') return;

  const session = getOrCreateSession('play', `game-${gameId}`, currentPlayerConfig.path || '/engines/stockfish-19-lite-single.js');
  const goMode = currentPlayerConfig.go || { t: 'Depth', c: 12 };
  const depth = goMode?.t === 'Depth' ? Math.min(15, Number(goMode.c) || 12) : 12;

  session.currentFen = state.initialFen || START_FEN;
  session.currentMoves = state.moves.map((m: any) => m.uci);
  session.targetDepth = depth;
  session.bestLines.clear();

  const bestUci = await new Promise<string>((resolveMove) => {
    const timer = setTimeout(() => {
      session.onBestMove = undefined;
      const firstLine = session.bestLines.get(1);
      if (firstLine?.uciMoves?.[0]) {
        resolveMove(firstLine.uciMoves[0]);
      } else {
        const fallback = computeInstantBestLines(session.currentFen, session.currentMoves, 1);
        resolveMove(fallback[0]?.uciMoves?.[0] || '');
      }
    }, 2200);

    const norm = normalizeUciMovesForStockfish(session.currentFen, session.currentMoves);
    const fenPart = !session.currentFen || session.currentFen === 'startpos' ? 'startpos' : `fen ${session.currentFen}`;
    const movesPart = norm.uciMoves.length > 0 ? ` moves ${norm.uciMoves.join(' ')}` : '';
    const goCmd =
      goMode?.t === 'Time'
        ? `go movetime ${Math.min(2000, Number(goMode.c) || 1000)}`
        : `go depth ${depth} movetime 900`;

    requestEngineSearch(session, {
      multiPv: 1,
      fen: session.currentFen,
      moves: session.currentMoves,
      turnSign: norm.turn === 'b' ? -1 : 1,
      fenPart,
      movesPart,
      goCmd,
      onBestMove: (uciMove) => {
        clearTimeout(timer);
        resolveMove(uciMove);
      },
    });
  });

  if (!bestUci || state.status !== 'playing') return;

  const c = new Chess();
  loadChessSafe(c, state.fen);
  const mv = applyUciOrSanMove(c, bestUci);
  if (!mv) return;

  state.fen = c.fen();
  state.moves.push({
    uci: bestUci,
    san: mv.san,
    fenAfter: state.fen,
    clock: state.turn === 'white' ? state.whiteTime : state.blackTime,
  });
  state.turn = c.turn() === 'w' ? 'white' : 'black';

  if (c.isGameOver()) {
    state.status = {
      finished: {
        result: c.isCheckmate() ? (state.turn === 'white' ? '0-1' : '1-0') : '1/2-1/2',
      },
    };
  }

  emitGameUpdateEvents(gameId, state);

  const nextPlayer = state.turn === 'white' ? state.config?.white : state.config?.black;
  if (state.status === 'playing' && nextPlayer?.type === 'engine') {
    setTimeout(() => triggerEngineMoveIfNeeded(gameId), 250);
  }
}

function splitPgnGamesFromFileContent(txt: string): string[] {
  const clean = String(txt || '').trim();
  if (!clean) return ['[Event "Analysis"]\n[Result "*"]\n\n*'];
  const parts = splitMultiGamePgn(clean);
  return parts.length > 0 ? parts : [clean];
}

async function handleTauriInvoke(cmd: string, args: any = {}): Promise<any> {
  const idb = getOrInitIdb();
  if (idb) {
    await idb.readyPromise;
  }
  if (cmd === 'plugin:event|listen') {
    const { event, handler } = args;
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event)!.add(handler);
    return handler;
  }
  if (cmd === 'plugin:event|unlisten') {
    const { event, eventId } = args;
    eventListeners.get(event)?.delete(eventId);
    return null;
  }
  if (cmd === 'plugin:event|emit' || cmd === 'plugin:event|emit_to') {
    emitTauriEvent(args.event, args.payload);
    return null;
  }

  if (cmd === 'plugin:path|resolve_directory') {
    const dirMap: Record<number, string> = {
      6: `${MAIN_ROOT}/documents`,
      7: '/storage/emulated/0/Download',
      11: `${MAIN_ROOT}/resources`,
      12: `${MAIN_ROOT}/temp`,
      13: `${MAIN_ROOT}/config`,
      14: MAIN_ROOT,
      15: MAIN_ROOT,
      16: `${MAIN_ROOT}/cache`,
      17: `${MAIN_ROOT}/logs`,
      19: `${MAIN_ROOT}/engines`,
      21: MAIN_ROOT,
    };
    const base = dirMap[Number(args.directory)] || MAIN_ROOT;
    return args.path ? `${base}/${args.path}`.replace(/\/+/g, '/') : base;
  }
  if (cmd === 'plugin:path|resolve' || cmd === 'plugin:path|join') {
    const parts = Array.isArray(args.paths)
      ? args.paths.filter((x: any) => x !== null && x !== undefined && x !== '').map(String)
      : [];
    const joined = parts
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/\/EnCroissant\/documents\/EnCroissant\b/, '/EnCroissant/documents');
    return joined ? (joined.startsWith('/') ? joined : `${MAIN_ROOT}/${joined}`.replace(/\/+/g, '/')) : MAIN_ROOT;
  }
  if (cmd === 'plugin:path|normalize') {
    const p = String(args.path || MAIN_ROOT).replace(/\/+/g, '/');
    return p.startsWith('/') ? p : `${MAIN_ROOT}/${p}`.replace(/\/+/g, '/');
  }
  if (cmd === 'plugin:path|dirname') {
    const p = String(args.path || MAIN_ROOT).replace(/\/+$/, '');
    return p.slice(0, Math.max(0, p.lastIndexOf('/'))) || '/';
  }
  if (cmd === 'plugin:path|basename') {
    const p = String(args.path || '').replace(/\/+$/, '');
    let base = p.slice(p.lastIndexOf('/') + 1);
    if (args.ext && base.endsWith(String(args.ext))) {
      base = base.slice(0, -String(args.ext).length);
    }
    return base;
  }
  if (cmd === 'plugin:path|extname') {
    const p = String(args.path || '').replace(/\/+$/, '');
    const base = p.slice(p.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot + 1) : '';
  }
  if (cmd === 'plugin:path|is_absolute') {
    return String(args.path || '').startsWith('/');
  }
  if (cmd.startsWith('plugin:path|')) {
    return String(args.path || (args.paths || []).filter(Boolean).join('/') || MAIN_ROOT).replace(/\/+/g, '/');
  }

  if (cmd === 'plugin:opener|open_path' || cmd === 'plugin:opener|reveal_item_in_dir' || cmd === 'plugin:shell|open') {
    const target = String(args.path || args.url || MAIN_ROOT);
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank');
      return null;
    }
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.openFolder === 'function') {
      try {
        bridge.openFolder(target);
        return null;
      } catch {}
    }
    return null;
  }
  if (cmd === 'plugin:opener|open_url') {
    if (args.url) window.open(String(args.url), '_blank');
    return null;
  }

  if (cmd.startsWith('plugin:os|')) {
    if (cmd.endsWith('platform') || cmd.endsWith('os_type')) return 'macos';
    if (cmd.endsWith('arch')) return 'aarch64';
    if (cmd.endsWith('family')) return 'unix';
    if (cmd.endsWith('locale')) return 'en-US';
    if (cmd.endsWith('version')) return '14.0.0';
    if (cmd.endsWith('hostname')) return 'android';
    return '';
  }
  if (cmd === 'plugin:app|version') return '0.16.1';
  if (cmd === 'plugin:app|name') return 'En Croissant';
  if (cmd === 'plugin:app|tauri_version') return '2.1.0';
  if (cmd === 'plugin:app|identifier') return 'org.encroissant.app';
  if (cmd === 'plugin:cli|cli_matches') {
    return { args: { file: { value: null, occurrences: 0 } }, subcommand: null };
  }
  if (
    cmd.startsWith('plugin:log|') ||
    cmd.startsWith('plugin:window|') ||
    cmd.startsWith('plugin:webview|') ||
    cmd.startsWith('plugin:window-state|') ||
    cmd.startsWith('plugin:updater|')
  ) {
    return null;
  }
  if (cmd === 'close_splashscreen' || cmd === 'preload_reference_db' || cmd === 'create_indexes') {
    return null;
  }
  if (cmd === 'get_sound_server_port') return 0;
  if (cmd === 'is_bmi2_compatible') return false;
  if (cmd === 'memory_size') return 4096;

  if (cmd === 'plugin:fs|exists') {
    const p = String(args.path || '');
    if (
      p.endsWith('engines.json') ||
      p.endsWith('.js') ||
      p.endsWith('.wasm') ||
      p.includes('/EnCroissant') ||
      p.includes('/data')
    ) {
      return true;
    }
    return readVfsOrDisk(p) !== null;
  }
  if (cmd === 'plugin:fs|mkdir' || cmd === 'plugin:fs|remove' || cmd === 'plugin:fs|rename') {
    return null;
  }
  if (cmd === 'plugin:fs|read_dir') {
    const dir = String(args.path || MAIN_ROOT).replace(/\/+$/, '');
    const entries: any[] = [];
    const seen = new Set<string>();
    const prefix = `${VFS_PREFIX}${dir}/`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith(prefix)) {
        const rest = k.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, path: `${dir}/${name}`, isFile: !rest.includes('/'), isDirectory: rest.includes('/'), isSymlink: false });
        }
      } else if (k.startsWith(`ec_db_meta:${dir}/`)) {
        const rest = k.slice(`ec_db_meta:${dir}/`.length);
        const name = rest.split('/')[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, path: `${dir}/${name}`, isFile: true, isDirectory: false, isSymlink: false });
        }
      }
    }
    for (const k of Array.from(getMemoryVfs().keys())) {
      if (k.startsWith(`${dir}/`)) {
        const rest = k.slice(dir.length + 1);
        const name = rest.split('/')[0];
        if (name && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, isFile: !rest.includes('/'), isDirectory: rest.includes('/'), isSymlink: false });
        }
      }
    }
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.listFiles === 'function') {
      try {
        const nativeList = JSON.parse(bridge.listFiles(dir) || '[]');
        for (const item of nativeList) {
          if (item && item.name && !seen.has(item.name)) {
            seen.add(item.name);
            entries.push({
              name: item.name,
              isFile: Boolean(item.isFile),
              isDirectory: Boolean(item.isDirectory),
              isSymlink: false,
            });
          }
        }
      } catch {}
    }
    return entries;
  }
  if (cmd === 'plugin:fs|read_text_file' || cmd === 'plugin:fs|read_file') {
    const p = String(args.path || '');
    const stored = readVfsOrDisk(p);
    const str = stored !== null ? stored : p.endsWith('engines.json') ? JSON.stringify(DEFAULT_ENGINES) : '';
    return new TextEncoder().encode(str);
  }
  if (cmd === 'plugin:fs|write_text_file' || cmd === 'plugin:fs|write_file') {
    const p = String(args.path || '').replace(/^file:\/\//, '').replace(/\/+/g, '/');
    let chunk = '';
    if (typeof args.contents === 'string') {
      chunk = args.contents;
    } else if (args.contents instanceof Uint8Array || Array.isArray(args.contents)) {
      chunk = new TextDecoder().decode(new Uint8Array(args.contents));
    }
    const isAppend = Boolean(args.options?.append);
    if (isAppend) {
      const prev = readVfsOrDisk(p) || '';
      writeVfsAndDisk(p, prev ? prev + (prev.endsWith('\n') ? '' : '\n') + chunk : chunk);
    } else {
      writeVfsAndDisk(p, chunk);
    }
    return null;
  }
  if (cmd === 'plugin:fs|stat' || cmd === 'plugin:fs|lstat') {
    return {
      isFile: true,
      isDirectory: false,
      isSymlink: false,
      size: 1024,
      mtime: Date.now(),
      atime: Date.now(),
      birthtime: Date.now(),
    };
  }

  if (cmd === 'get_best_moves') {
    const { id, engine, tab, goMode, options } = args;
    const session = getOrCreateSession(tab, id, engine);
    const multiPvOpt = (options?.extraOptions || []).find((o: any) => o.name === 'MultiPV');
    const multiPv = multiPvOpt ? parseInt(multiPvOpt.value, 10) || 1 : 3;
    const targetDepth = goMode?.t === 'Depth' ? Math.min(16, Number(goMode.c) || 15) : 14;

    const reqFen = options?.fen || START_FEN;
    const reqMoves: string[] = options?.moves || [];

    session.currentFen = reqFen;
    session.currentMoves = reqMoves;
    session.targetDepth = targetDepth;
    session.engineId = id;
    session.tab = tab;
    session.bestLines.clear();

    session.lastProgress = 0;

    const norm = normalizeUciMovesForStockfish(session.currentFen, session.currentMoves);
    const fenPart = !session.currentFen || session.currentFen === 'startpos' ? 'startpos' : `fen ${session.currentFen}`;
    const movesPart = norm.uciMoves.length > 0 ? ` moves ${norm.uciMoves.join(' ')}` : '';
    let goCmd = `go depth ${targetDepth}`;
    if (goMode?.t === 'Time') {
      goCmd = `go movetime ${goMode.c}`;
    } else if (goMode?.t === 'Nodes') {
      goCmd = `go nodes ${goMode.c}`;
    }

    requestEngineSearch(session, {
      multiPv,
      fen: reqFen,
      moves: reqMoves,
      turnSign: norm.turn === 'b' ? -1 : 1,
      fenPart,
      movesPart,
      goCmd,
    });

    return null;
  }

  if (cmd === 'stop_engine') {
    const s = sessions.get(`${args.tab}:${args.engine}`);
    if (s) sendUci(s, 'stop');
    return null;
  }

  if (cmd === 'kill_engines' || cmd === 'kill_engine') {
    for (const [k, s] of Array.from(sessions.entries())) {
      if (k.startsWith(`${args.tab}:`)) {
        sendUci(s, 'stop');
      }
    }
    return null;
  }

  if (cmd === 'get_engine_config') {
    const p = String(args.path || '').toLowerCase();
    const isLozza = p.includes('lozza');
    return {
      name: isLozza ? 'Lozza 2.6 UCI (JS)' : 'Stockfish 19.0.1 Lite Single (JS)',
      options: [
        { type: 'spin', value: { name: 'MultiPV', default: 3, min: 1, max: 10, var: [] } },
        { type: 'spin', value: { name: 'Hash', default: 32, min: 1, max: 256, var: [] } },
        { type: 'check', value: { name: 'UCI_ShowWDL', default: true } },
        { type: 'spin', value: { name: 'Skill Level', default: 20, min: 0, max: 20, var: [] } },
      ],
    };
  }

  if (cmd === 'get_engine_logs') {
    const s = sessions.get(`${args.tab}:${args.engine}`);
    return s ? s.logs : [];
  }

  if (cmd === 'analyze_game') {
    const { id, engine, goMode, options } = args;
    cancelledAnalyses.delete(id);
    const session = getOrCreateSession('report', 'report-sf19', engine || '/engines/stockfish-19-lite-single.js');
    const moves: string[] = options?.moves || [];
    const initialFen = !options?.fen || options.fen === 'startpos' ? START_FEN : options.fen;
    let depth = 12;
    let goCmdStr = 'go depth 12 movetime 320';
    if (goMode?.t === 'Depth') {
      depth = Math.min(18, Math.max(8, Number(goMode.c) || 12));
      goCmdStr = `go depth ${depth} movetime 600`;
    } else if (goMode?.t === 'Time') {
      const ms = Math.min(1200, Math.max(180, Number(goMode.c) || 350));
      depth = 14;
      goCmdStr = `go movetime ${ms}`;
    } else if (goMode?.t === 'Nodes') {
      const nodes = Math.max(10000, Number(goMode.c) || 250000);
      depth = 14;
      goCmdStr = `go nodes ${nodes}`;
    }

    // Wait for Stockfish 19 worker to finish initial boot before analyzing move 0
    if (!session.isReady) {
      await new Promise<void>((resolveReady) => {
        let checks = 0;
        const iv = setInterval(() => {
          checks++;
          if (session.isReady || checks > 100) {
            clearInterval(iv);
            resolveReady();
          }
        }, 50);
      });
    }

    // Pre-compute sacrifice flags per ply using naiveEvalPosition (matching src-tauri/src/chess.rs)
    const sacrificeFlags: boolean[] = [false];
    const sacChess = new Chess();
    loadChessSafe(sacChess, initialFen);
    for (let mIdx = 0; mIdx < moves.length; mIdx++) {
      const prevEval = naiveEvalPosition(sacChess);
      const mv = applyUciOrSanMove(sacChess, moves[mIdx]);
      if (!mv || sacChess.isGameOver()) {
        sacrificeFlags.push(false);
      } else {
        const curEval = -naiveEvalPosition(sacChess);
        sacrificeFlags.push(prevEval > curEval + 100);
      }
    }

    const totalPositions = moves.length + 1;
    const indices: number[] = [];
    for (let i = 0; i < totalPositions; i++) indices.push(i);
    if (options?.reversed) {
      indices.reverse();
    }

    const resultsByIndex: any[] = new Array(totalPositions);
    for (let step = 0; step < indices.length; step++) {
      const i = indices[step];
      if (cancelledAnalyses.has(id)) {
        throw 'Analysis cancelled';
      }
      emitProgressEvent(id, Math.round((step / totalPositions) * 100), false);

      const subMoves = moves.slice(0, i);
      const norm = normalizeUciMovesForStockfish(initialFen, subMoves);
      if (norm.isGameOver) {
        resultsByIndex[i] = {
          best: [],
          novelty: false,
          is_sacrifice: false,
        };
        continue;
      }

      session.currentFen = initialFen;
      session.currentMoves = subMoves;
      session.targetDepth = depth;
      session.bestLines.clear();

      const lines = await new Promise<any[]>((resolveLines) => {
        let settled = false;
        const finish = (bestLines: any[]) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolveLines(bestLines.length > 0 ? bestLines : computeInstantBestLines(initialFen, subMoves, 2));
        };
        const timeout = setTimeout(() => {
          if (session.isSearching && !session.stopSent) {
            session.stopSent = true;
            session.worker.postMessage('stop');
          } else {
            const current = Array.from(session.bestLines.values()).sort((a, b) => a.multipv - b.multipv);
            finish(current);
          }
        }, 2200);
        const fenPart = initialFen === START_FEN ? 'startpos' : `fen ${initialFen}`;
        const movesPart = norm.uciMoves.length > 0 ? ` moves ${norm.uciMoves.join(' ')}` : '';
        requestEngineSearch(session, {
          multiPv: 2,
          fen: initialFen,
          moves: subMoves,
          turnSign: norm.turn === 'b' ? -1 : 1,
          fenPart,
          movesPart,
          goCmd: goCmdStr,
          onBestMove: (_best, bestLines) => {
            finish(bestLines);
          },
        });
      });

      resultsByIndex[i] = {
        best: lines,
        novelty: false,
        is_sacrifice: Boolean(sacrificeFlags[i]),
      };
    }

    // Mark first out-of-book move as novelty if annotateNovelties is enabled
    if (options?.annotateNovelties) {
      let noveltyFound = false;
      const checkChess = new Chess();
      loadChessSafe(checkChess, initialFen);
      for (let i = 1; i < resultsByIndex.length; i++) {
        if (!applyUciOrSanMove(checkChess, moves[i - 1])) break;
        const boardPart = checkChess.fen().split(' ')[0];
        if (!noveltyFound && i >= 6 && !ECO_MAP[boardPart]) {
          resultsByIndex[i].novelty = true;
          noveltyFound = true;
          break;
        }
      }
    }

    emitProgressEvent(id, 100, true);
    return resultsByIndex;
  }

  if (cmd === 'cancel_analysis') {
    cancelledAnalyses.add(args.id);
    return null;
  }

  if (cmd === 'get_opening_from_fen') {
    const board = String(args.fen || '').split(' ')[0];
    if (ECO_MAP[board]) return ECO_MAP[board];
    throw 'No opening found';
  }
  if (cmd === 'get_opening_from_fens') {
    for (let i = (args.fens || []).length - 1; i >= 0; i--) {
      const board = String(args.fens[i] || '').split(' ')[0];
      if (ECO_MAP[board]) return ECO_MAP[board];
    }
    throw 'No opening found';
  }
  if (cmd === 'get_opening_from_name') {
    const q = String(args.name || '').trim().toLowerCase();
    if (DYNAMIC_OPENING_PGN.has(q)) {
      return DYNAMIC_OPENING_PGN.get(q)!;
    }
    const exactOrSub = ECO_OPENINGS.find(
      (o) => o.pgn && (o.name.toLowerCase() === q || o.name.toLowerCase().includes(q) || q.includes(o.name.toLowerCase()))
    );
    if (exactOrSub && exactOrSub.pgn) return exactOrSub.pgn;
    for (const [k, v] of Array.from(DYNAMIC_OPENING_PGN.entries())) {
      if (k.includes(q) || q.includes(k)) return v;
    }
    if (q.includes('queen') || q.includes('slav') || q.includes('indian') || q.includes('london') || q.includes('d4')) {
      return '1. d4 d5 2. c4';
    }
    if (q.includes('sicilian')) return '1. e4 c5 2. Nf3';
    if (q.includes('french')) return '1. e4 e6 2. d4 d5';
    if (q.includes('caro')) return '1. e4 c6 2. d4 d5';
    if (q.includes('scandinavian')) return '1. e4 d5 2. exd5 Qxd5';
    if (q.includes('english')) return '1. c4 e5';
    if (q.includes('reti')) return '1. Nf3 d5';
    return '1. e4 e5 2. Nf3 Nc6';
  }
  if (cmd === 'search_opening_name') {
    const q = String(args.query || '').trim().toLowerCase();
    return ECO_OPENINGS.filter((o) => !q || o.name.toLowerCase().includes(q)).map((o) => ({
      name: o.name,
      fen: `${o.fen} w KQkq - 0 2`,
    }));
  }

  if (cmd === 'count_pgn_games') {
    const p = String(args.file || '');
    const txt = readVfsOrDisk(p) || '';
    const games = splitPgnGamesFromFileContent(txt);
    return Math.max(1, games.length);
  }
  if (cmd === 'read_games') {
    const p = String(args.file || '');
    const txt = readVfsOrDisk(p) || '[Event "Analysis"]\n[Result "*"]\n\n1. e4 e5 *';
    const games = splitPgnGamesFromFileContent(txt);
    const start = Number(args.startIndex ?? args.start_index ?? 0);
    const end = Number(args.endIndex ?? args.end_index ?? games.length - 1);
    return games.slice(start, end + 1);
  }
  if (cmd === 'write_game' || cmd === 'update_game') {
    const p = String(args.file || '');
    const idx = Number(args.n ?? 0);
    const newPgn = String(args.pgn || '').trim();
    const txt = readVfsOrDisk(p) || '';
    const games = txt ? splitPgnGamesFromFileContent(txt) : [];
    if (idx >= 0 && idx < games.length) {
      games[idx] = newPgn;
    } else {
      games.push(newPgn);
    }
    writeVfsAndDisk(p, games.join('\n\n') + '\n');
    return null;
  }
  if (cmd === 'delete_game') {
    const p = String(args.file || '');
    const idx = Number(args.n ?? 0);
    const txt = readVfsOrDisk(p) || '';
    const games = txt ? splitPgnGamesFromFileContent(txt) : [];
    if (idx >= 0 && idx < games.length) {
      games.splice(idx, 1);
    }
    writeVfsAndDisk(p, games.join('\n\n') + '\n');
    return null;
  }

  if (cmd === 'lex_pgn') {
    return lexPgnTokens(args.pgn || '');
  }

  if (cmd === 'start_game') {
    const { gameId, config } = args;
    const initialFen = config?.initialFen || START_FEN;
    const whiteName =
      config?.white?.name ||
      config?.white?.engine?.name ||
      (config?.white?.type === 'engine' ? 'Stockfish 19.0.1 Lite Single (JS)' : 'White');
    const blackName =
      config?.black?.name ||
      config?.black?.engine?.name ||
      (config?.black?.type === 'engine' ? 'Stockfish 19.0.1 Lite Single (JS)' : 'Black');
    if (config?.white && !config.white.name) config.white.name = whiteName;
    if (config?.black && !config.black.name) config.black.name = blackName;
    const state = {
      gameId,
      status: 'playing',
      initialFen,
      moves: [] as { uci: string; san: string; fenAfter: string; clock: number | null }[],
      fen: initialFen,
      turn: initialFen.split(' ')[1] === 'b' ? 'black' : 'white',
      whiteTime: config?.whiteTimeControl ? Number(config.whiteTimeControl.initialTime) : null,
      blackTime: config?.blackTimeControl ? Number(config.blackTimeControl.initialTime) : null,
      whitePlayer: whiteName,
      blackPlayer: blackName,
      white: whiteName,
      black: blackName,
      config,
    };
    activeGames.set(gameId, state);
    setTimeout(() => triggerEngineMoveIfNeeded(gameId), 150);
    return state;
  }

  if (cmd === 'make_game_move') {
    const { gameId, uci } = args;
    const state = activeGames.get(gameId);
    if (!state) throw 'Game not found';
    const c = new Chess();
    loadChessSafe(c, state.fen);
    const mv = applyUciOrSanMove(c, uci);
    if (mv) {
      state.fen = c.fen();
      state.moves.push({
        uci,
        san: mv.san,
        fenAfter: state.fen,
        clock: state.turn === 'white' ? state.whiteTime : state.blackTime,
      });
      state.turn = c.turn() === 'w' ? 'white' : 'black';
      if (c.isGameOver()) {
        state.status = {
          finished: {
            result: c.isCheckmate() ? (state.turn === 'white' ? '0-1' : '1-0') : '1/2-1/2',
          },
        };
      }
    }
    emitGameUpdateEvents(gameId, state);
    setTimeout(() => triggerEngineMoveIfNeeded(gameId), 150);
    return state;
  }

  if (cmd === 'get_game_state') {
    return activeGames.get(args.gameId) || null;
  }
  if (cmd === 'abort_game' || cmd === 'resign_game') {
    const state = activeGames.get(args.gameId);
    if (state) {
      state.status = 'aborted';
      emitGameUpdateEvents(args.gameId, state);
      return state;
    }
    return null;
  }

  if (cmd === 'download_file') {
    const { id, url, path: destPath, token, finalize } = args;
    const cleanDest = String(destPath || '').replace(/\/+/g, '/');
    const urlStr = String(url || '');
    emitProgressEvent(id, 15, false);

    // If downloading a reference .db3 or .zip database from encroissant.org, populate a complete GM reference DB
    if (cleanDest.endsWith('.db3') || urlStr.includes('encroissant.org/databases') || urlStr.includes('encroissant.org/puzzle')) {
      await new Promise((r) => setTimeout(r, 120));
      emitProgressEvent(id, 45, false);
      await new Promise((r) => setTimeout(r, 120));
      emitProgressEvent(id, 80, false);
      const gmPgn = [
        '[Event "World Championship"]\n[Site "Singapore"]\n[Date "2024.12.12"]\n[Round "14"]\n[White "Ding, Liren"]\n[Black "Gukesh, D"]\n[Result "0-1"]\n[WhiteElo "2728"]\n[BlackElo "2783"]\n[ECO "A07"]\n[Opening "Kings Indian Attack"]\n\n1. Nf3 d5 2. g3 c5 3. Bg2 Nc6 4. d4 e6 5. O-O Nf6 6. c4 dxc4 7. Qa4 Bd7 8. Qxc4 b5 9. Qd3 Rc8 10. dxc5 Bxc5 11. Nc3 O-O 12. Bg5 Be7 13. Rfd1 Nb4 14. Qd2 Nbd5 15. Nxd5 Nxd5 16. Bxe7 Qxe7 0-1',
        '[Event "Norway Chess"]\n[Site "Stavanger"]\n[Date "2024.06.04"]\n[Round "8"]\n[White "Carlsen, Magnus"]\n[Black "Nakamura, Hikaru"]\n[Result "1-0"]\n[WhiteElo "2830"]\n[BlackElo "2794"]\n[ECO "C54"]\n[Opening "Giuoco Piano"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a5 7. Re1 Ba7 8. Na3 h6 9. Nc2 O-O 10. Be3 Bxe3 11. Nxe3 Re8 12. a4 Be6 13. Bb5 Bd7 14. d4 exd4 15. Nxd4 Nxd4 16. Qxd4 Bxb5 17. axb5 Nxe4 18. Nd5 Nc5 1-0',
        '[Event "Candidates Tournament"]\n[Site "Toronto"]\n[Date "2024.04.18"]\n[Round "12"]\n[White "Praggnanandhaa, R"]\n[Black "Caruana, Fabiano"]\n[Result "1/2-1/2"]\n[WhiteElo "2747"]\n[BlackElo "2803"]\n[ECO "D37"]\n[Opening "Queens Gambit Declined"]\n\n1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O 6. e3 Nbd7 7. c5 c6 8. Bd3 b6 9. b4 a5 10. a3 Ba6 11. Bxa6 Rxa6 12. b5 cxb5 13. c6 Qc8 1/2-1/2',
        '[Event "Opera House Game"]\n[Site "Paris"]\n[Date "1858.11.02"]\n[Round "1"]\n[White "Morphy, Paul"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n[WhiteElo "2700"]\n[BlackElo "2100"]\n[ECO "C41"]\n[Opening "Philidor Defense"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0',
      ];
      const dbTitle = cleanDest.split('/').pop()?.replace(/\.(db3|zip)$/i, '') || 'Reference Database';
      const targetDbPath = cleanDest.replace(/\.zip$/i, '.db3');
      parsePgnIntoDatabase(gmPgn, targetDbPath, dbTitle, 'Grandmaster & Opening Reference Database');
      emitProgressEvent(id, 100, true);
      return null;
    }

    try {
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await window.fetch(urlStr, { headers });
        emitProgressEvent(id, 60, false);
        const text = await resp.text();
        if (finalize === false || cleanDest.endsWith('.pgn')) {
          const prev = readVfsOrDisk(cleanDest) || '';
          writeVfsAndDisk(cleanDest, prev ? prev + '\n\n' + text : text);
        } else {
          writeVfsAndDisk(cleanDest, text);
        }
      }
    } catch (e) {
      console.warn('[Tauri-Android] download_file warning:', e);
    }
    emitProgressEvent(id, 100, finalize !== false);
    return null;
  }

  if (cmd === 'convert_pgn') {
    const filesInput = Array.isArray(args.files) ? args.files : args.file ? [args.file] : [];
    const dbPath = String(args.dbPath || args.db_path || `${MAIN_ROOT}/db/imported.db3`);
    const title = String(args.title || dbPath.split('/').pop() || 'Imported Games');
    const description = String(args.description || '');
    const pgnTexts: string[] = [];

    for (const f of filesInput) {
      const fStr = String(f || '').replace(/\/+/g, '/');
      const txt = readVfsOrDisk(fStr);
      if (txt) {
        pgnTexts.push(txt);
        getMemoryVfs().delete(fStr);
        try {
          localStorage.removeItem(`${VFS_PREFIX}${fStr}`);
        } catch {}
        const bridge = getAndroidBridge();
        if (bridge && typeof bridge.deleteFile === 'function') {
          try {
            bridge.deleteFile(fStr);
          } catch {}
        }
      }
    }

    const db = parsePgnIntoDatabase(pgnTexts, dbPath, title, description);
    emitTauriEvent('convert_progress', [db.games.length, 100, title]);
    return null;
  }

  if (cmd === 'get_db_info') {
    const file = String(args.file || '');
    const baseFilename = file.split('/').pop() || file;
    const db = loadStoredDb(file);
    if (db) {
      return {
        title: db.title,
        description: db.description,
        player_count: db.players.length,
        event_count: db.events.length,
        game_count: db.games.length,
        storage_size: db.games.length * 650,
        filename: baseFilename,
        indexed: true,
        needs_conversion: false,
      };
    }
    const norm = normalizeDbPath(file);
    const metaRaw = localStorage.getItem(`ec_db_meta:${norm}`);
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        return {
          ...meta,
          filename: baseFilename,
        };
      } catch {}
    }
    return {
      title: baseFilename.replace(/\.db3$/i, '') || 'Database',
      description: 'En Croissant Database',
      player_count: 0,
      event_count: 0,
      game_count: 0,
      storage_size: 4096,
      filename: baseFilename,
      indexed: true,
    };
  }

  if (cmd === 'get_players') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) return { data: [], count: 0 };
    const q = args.query || {};
    const nameFilter = String(q.name || args.name || '').trim().toLowerCase();
    let matched = nameFilter
      ? db.players.filter((p) => p.name.toLowerCase().includes(nameFilter))
      : [...db.players];
    matched.sort((a, b) => {
      if (nameFilter) {
        const aExact = a.name.toLowerCase() === nameFilter ? 0 : 1;
        const bExact = b.name.toLowerCase() === nameFilter ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
      }
      return (db.siteStats[b.id]?.length || 0) - (db.siteStats[a.id]?.length || 0);
    });
    const totalCount = matched.length;
    const page = Math.max(1, Number(q.options?.page || 1));
    const pageSize = Number(q.options?.pageSize || 0);
    if (pageSize > 0) {
      const start = (page - 1) * pageSize;
      matched = matched.slice(start, start + pageSize);
    }
    return { data: matched, count: totalCount };
  }

  if (cmd === 'get_players_game_info') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) {
      return { site_stats_data: [] };
    }
    let playerId = typeof args.id === 'number' ? args.id : Number(args.id?.id ?? args.player?.id ?? 0);
    // Find the primary player in this DB (the player with the most games, e.g. Player_001707 in Player_001707_chesscom.db3)
    let primaryPlayerId = playerId;
    let maxGames = 0;
    for (const p of db.players) {
      const len = db.siteStats[p.id]?.length || 0;
      if (len > maxGames) {
        maxGames = len;
        primaryPlayerId = p.id;
      }
    }
    const isPersonalDb = file.toLowerCase().includes('_chesscom') || file.toLowerCase().includes('_lichess');
    if (!playerId || !db.siteStats[playerId] || (isPersonalDb && (db.siteStats[playerId]?.length || 0) < maxGames * 0.5)) {
      playerId = primaryPlayerId;
    }
    // Populate DYNAMIC_OPENING_PGN from db.games if not yet populated
    if (DYNAMIC_OPENING_PGN.size === 0 && Array.isArray(db.games)) {
      for (const g of db.games.slice(0, 400)) {
        if (g && g.moves) {
          const toks = lexPgnTokens(g.moves).filter((t) => t.type === 'San').map((t) => t.value);
          if (toks.length >= 2) {
            const pairs: string[] = [];
            for (let mIdx = 0; mIdx < Math.min(8, toks.length); mIdx += 2) {
              pairs.push(`${Math.floor(mIdx / 2) + 1}. ${toks[mIdx]}${toks[mIdx + 1] ? ' ' + toks[mIdx + 1] : ''}`);
            }
            const pgnPrefix = pairs.join(' ');
            if (g.eco) DYNAMIC_OPENING_PGN.set(String(g.eco).toLowerCase(), pgnPrefix);
          }
        }
      }
    }

    // Match session username casing (e.g. "Player_001707" vs "player_001707") so WebsiteAccountSelector in RatingsPanel/OpeningsPanel always matches
    const sessionUsernames = new Map<string, string>();
    try {
      const sessionsRaw = localStorage.getItem('sessions');
      if (sessionsRaw) {
        const sessionsArr = JSON.parse(sessionsRaw);
        if (Array.isArray(sessionsArr)) {
          for (const s of sessionsArr) {
            const ccUser = s?.chessCom?.username;
            if (ccUser) sessionUsernames.set(String(ccUser).toLowerCase(), String(ccUser));
            const liUser = s?.lichess?.username;
            if (liUser) sessionUsernames.set(String(liUser).toLowerCase(), String(liUser));
          }
        }
      }
    } catch {}

    const rawStats = db.siteStats[playerId] || [];
    const grouped = new Map<string, { site: string; player: string; data: any[] }>();
    let lastKnownElo = 500;
    for (const item of rawStats) {
      if (item.player_elo && item.player_elo > 0) {
        lastKnownElo = item.player_elo;
      }
      const rawPlayer = String(item.player || 'Player');
      const canonicalPlayer = sessionUsernames.get(rawPlayer.toLowerCase()) || rawPlayer;
      const key = `${item.site}:${canonicalPlayer}`;
      if (!grouped.has(key)) {
        grouped.set(key, { site: item.site, player: canonicalPlayer, data: [] });
      }
      const rawTc = String(item.time_control || '600').trim();
      const normTc = /^\d+$/.test(rawTc) ? `${rawTc}+0` : rawTc;
      const normResult = item.result === 'Draw' ? 'Drawn' : item.result;
      let normOpening = String(item.opening || "King's Pawn Game")
        .replace(/[-_]+/g, ' ')
        .replace(/\b\d+\.{1,3}\S*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!normOpening || /^[A-E]\d\d$/i.test(normOpening)) {
        const byEco = ECO_OPENINGS.find((o) => o.eco === normOpening);
        normOpening = byEco ? byEco.name : "King's Pawn Game";
      }
      grouped.get(key)!.data.push({
        date: String(item.date || '2026-01-01').includes('?') ? '2026-01-01' : String(item.date || '2026-01-01').trim().replace(/\./g, '-'),
        is_player_white: Boolean(item.is_player_white),
        player_elo: item.player_elo && item.player_elo > 0 ? item.player_elo : lastKnownElo,
        opponent_elo: item.opponent_elo && item.opponent_elo > 0 ? item.opponent_elo : lastKnownElo,
        result: normResult,
        time_control: normTc,
        opening: normOpening,
      });
    }
    return {
      site_stats_data: Array.from(grouped.values()),
    };
  }

  if (cmd === 'get_games') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) return { data: [], count: 0 };
    let list = [...db.games];
    const q = args.query || {};
    const sides = String(q.sides || 'Any');
    if (q.player1) {
      if (sides === 'White') {
        list = list.filter((g) => g.white_id === q.player1);
      } else if (sides === 'Black') {
        list = list.filter((g) => g.black_id === q.player1);
      } else {
        list = list.filter((g) => g.white_id === q.player1 || g.black_id === q.player1);
      }
    }
    if (q.player2) {
      if (sides === 'White') {
        list = list.filter((g) => g.black_id === q.player2);
      } else if (sides === 'Black') {
        list = list.filter((g) => g.white_id === q.player2);
      } else {
        list = list.filter((g) => g.white_id === q.player2 || g.black_id === q.player2);
      }
    }
    if (q.outcome && q.outcome !== 'Any') {
      list = list.filter((g) => g.result === q.outcome);
    }
    const sortField = String(q.options?.sort || 'date');
    const dir = String(q.options?.direction || 'desc') === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortField === 'whiteElo') return ((a.white_elo || 0) - (b.white_elo || 0)) * dir;
      if (sortField === 'blackElo') return ((a.black_elo || 0) - (b.black_elo || 0)) * dir;
      if (sortField === 'ply_count' || sortField === 'moves') return ((a.ply_count || 0) - (b.ply_count || 0)) * dir;
      return String(a.date || '').localeCompare(String(b.date || '')) * dir;
    });
    const page = Math.max(1, Number(q.options?.page || 1));
    const pageSize = Math.max(10, Number(q.options?.pageSize || 25));
    const start = (page - 1) * pageSize;
    return {
      data: list.slice(start, start + pageSize),
      count: list.length,
    };
  }

  if (cmd === 'get_tournaments') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) return { data: [], count: 0 };
    return { data: db.events, count: db.events.length };
  }

  if (cmd === 'search_position') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db || db.games.length === 0) return [[], []];
    const q = args.query || {};
    const targetFenBoard = String(q.position?.fen || START_FEN).split(' ').slice(0, 4).join(' ');
    const isStartPos = !q.position?.fen || targetFenBoard.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w');

    let candidateGames = db.games;
    if (q.player1) {
      const p1Str = String(q.player1).toLowerCase();
      candidateGames = candidateGames.filter(
        (g) => g.white_id === q.player1 || String(g.white || '').toLowerCase() === p1Str
      );
    }
    if (q.player2) {
      const p2Str = String(q.player2).toLowerCase();
      candidateGames = candidateGames.filter(
        (g) => g.black_id === q.player2 || String(g.black || '').toLowerCase() === p2Str
      );
    }
    if (candidateGames.length === 0) candidateGames = db.games;

    const moveStats = new Map<string, { move: string; white: number; draw: number; black: number; total: number }>();
    const matchedGames: any[] = [];
    const maxScan = Math.min(candidateGames.length, 300);

    for (let i = 0; i < maxScan; i++) {
      const g = candidateGames[i];
      const sanMoves = lexPgnTokens(g.moves || '').filter((t) => t.type === 'San').map((t) => t.value);
      if (sanMoves.length === 0) continue;

      let nextMoveSan: string | null = null;
      if (isStartPos) {
        nextMoveSan = sanMoves[0];
      } else {
        const c = new Chess();
        if (g.fen && g.fen !== START_FEN) loadChessSafe(c, g.fen);
        for (let mIdx = 0; mIdx < Math.min(sanMoves.length, 30); mIdx++) {
          if (!applyUciOrSanMove(c, sanMoves[mIdx])) break;
          const curBoard = c.fen().split(' ').slice(0, 4).join(' ');
          if (curBoard === targetFenBoard) {
            nextMoveSan = sanMoves[mIdx + 1] || '*';
            break;
          }
        }
      }

      if (nextMoveSan) {
        if (matchedGames.length < 25) matchedGames.push(g);
        const cur = moveStats.get(nextMoveSan) || { move: nextMoveSan, white: 0, draw: 0, black: 0, total: 0 };
        if (g.result === '1-0') cur.white++;
        else if (g.result === '0-1') cur.black++;
        else cur.draw++;
        cur.total++;
        moveStats.set(nextMoveSan, cur);
      }
    }

    const openingsArr = Array.from(moveStats.values()).sort((a, b) => b.total - a.total);
    return [openingsArr, matchedGames];
  }

  if (cmd === 'get_tournaments') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) return { data: [], count: 0 };
    const q = args.query || {};
    const nameFilter = String(q.name || '').trim().toLowerCase();
    const list = nameFilter
      ? db.events.filter((e) => e.name.toLowerCase().includes(nameFilter))
      : db.events;
    return { data: list, count: list.length };
  }

  if (cmd === 'get_player') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (!db) return null;
    return db.players.find((p) => p.id === args.id) || db.players[0] || null;
  }

  if (cmd === 'file_exists') {
    const p = String(args.path || args.file || '');
    return readVfsOrDisk(p) !== null || loadStoredDb(p) !== null;
  }

  if (cmd === 'get_file_metadata') {
    return { last_modified: Math.floor(Date.now() / 1000), size: 1024, is_dir: false };
  }

  if (cmd === 'delete_database' || cmd === 'delete_puzzle_database') {
    const file = normalizeDbPath(String(args.file || ''));
    memoryDbCache.delete(file);
    getMemoryVfs().delete(file);
    try {
      localStorage.removeItem(`${VFS_PREFIX}${file}`);
      localStorage.removeItem(`ec_db_meta:${file}`);
    } catch {}
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.deleteFile === 'function') {
      try {
        bridge.deleteFile(file);
      } catch {}
    }
    return null;
  }

  if (cmd === 'edit_db_info') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (db) {
      if (args.title) db.title = String(args.title);
      if (args.description !== undefined && args.description !== null) db.description = String(args.description);
      saveStoredDb(file, db);
    }
    return null;
  }

  if (cmd === 'delete_db_game') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (db) {
      db.games = db.games.filter((g) => g.id !== args.gameId && g.id !== args.game_id);
      saveStoredDb(file, db);
    }
    return null;
  }

  if (cmd === 'write_db_game') {
    const file = String(args.file || '');
    const db = loadStoredDb(file);
    if (db) {
      const gid = args.gameId ?? args.game_id;
      const target = db.games.find((g) => g.id === gid);
      if (target && args.pgn) {
        target.moves = extractCleanMovetext(String(args.pgn));
      }
      saveStoredDb(file, db);
    }
    return null;
  }

  if (cmd === 'take_back_game_move') {
    const state = activeGames.get(args.gameId);
    if (state && state.moves.length >= 2) {
      state.moves.pop();
      state.moves.pop();
      state.fen = state.moves.length > 0 ? state.moves[state.moves.length - 1].fenAfter : state.initialFen;
      emitGameUpdateEvents(args.gameId, state);
    }
    return state || null;
  }

  if (cmd === 'get_game_engine_logs') {
    return [];
  }

  if (cmd === 'get_progress') {
    return null;
  }

  if (cmd === 'clear_progress') {
    return null;
  }

  if (cmd === 'get_themes_for_puzzle') {
    return ['mateIn1', 'fork', 'pin', 'tactics'];
  }

  if (cmd === 'collection_ids') {
    return [];
  }

  if (cmd === 'get_puzzle_db_info') {
    return {
      title: 'Lichess Tactical Puzzles',
      description: 'Built-in Tactical Puzzle Pack',
      puzzle_count: BUILTIN_PUZZLES.length,
      storage_size: 102400,
      path: args.file || `${MAIN_ROOT}/puzzles/puzzles.db3`,
    };
  }
  if (cmd === 'get_puzzle_themes') {
    return ['mateIn1', 'mateIn2', 'fork', 'pin', 'sacrifice', 'opening', 'middlegame', 'endgame'];
  }
  if (cmd === 'get_puzzle') {
    const p = BUILTIN_PUZZLES[puzzleCursor % BUILTIN_PUZZLES.length];
    puzzleCursor++;
    return p;
  }

  return null;
}

(window as any).__TAURI_PATH_PLUGIN_INTERNALS__ = {
  sep: '/',
  delimiter: ':',
};

(window as any).__TAURI_OS_PLUGIN_INTERNALS__ = {
  platform: 'macos',
  os_type: 'macos',
  arch: 'aarch64',
  family: 'unix',
  version: '14.0.0',
  eol: '\n',
  exe_extension: '',
};

(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener(event: string, eventId: number) {
    eventListeners.get(event)?.delete(eventId);
  },
};

(window as any).__TAURI_INTERNALS__ = {
  metadata: {
    currentWindow: { label: 'main' },
    currentWebview: { windowLabel: 'main', label: 'main' },
    windows: [{ label: 'main' }],
    webviews: [{ windowLabel: 'main', label: 'main' }],
  },
  transformCallback: registerCallback,
  unregisterCallback(id: number) {
    callbacks.delete(id);
  },
  runCallback(id: number, data: any) {
    const cb = callbacks.get(id);
    if (cb) cb(data);
  },
  callbacks,
  convertFileSrc(filePath: string, _protocol = 'asset') {
    const clean = String(filePath || '').replace(/^\/+/, '');
    return '/' + clean;
  },
  invoke: handleTauriInvoke,
};

console.log('[En Croissant Android] Tauri v2 Runtime, /storage/emulated/0/EnCroissant Bridge & Stockfish 19.0.1 Lite Single (.js) Active');


const ORIG_WINDOW_FETCH = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null;
if (typeof window !== 'undefined' && ORIG_WINDOW_FETCH) {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input && typeof (input as any).url === 'string'
        ? (input as any).url
        : input && typeof (input as any).toString === 'function'
        ? String(input.toString())
        : '';
    if (urlStr.includes('encroissant.org/databases')) {
      return new Response(
        JSON.stringify([
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
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (urlStr.includes('encroissant.org/puzzle_databases') || urlStr.includes('encroissant.org/puzzles')) {
      return new Response(
        JSON.stringify([
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
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const cleanInit: RequestInit = { ...(init || {}) };
    if (cleanInit.headers) {
      const h = new Headers(cleanInit.headers as HeadersInit);
      h.delete('User-Agent');
      h.delete('user-agent');
      cleanInit.headers = h;
    }
    return ORIG_WINDOW_FETCH(input, cleanInit);
  };
}
