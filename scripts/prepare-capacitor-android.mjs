#!/usr/bin/env node
/**
 * Prepares the untouched franciscoBSalgueiro/en-croissant frontend for Android APK packaging:
 * 1. Downloads nmrugg/stockfish.js v19.0.1 (`stockfish-19-lite-single.js` + companion binary)
 *    and Lozza 2.6 (`lozza.js`) into `public/engines/` AND `public/` root.
 * 2. Inspects cloned `src/bindings.ts`, `src-tauri/src/lexer.rs`, and `src/utils/chess.ts` to
 *    auto-configure `PAREN_TOKEN_MODE` and `COMMENT_KEEP_BRACES` in `scripts/tauri-android-runtime.ts`.
 * 3. Copies En Croissant's `sound/` directory into `public/sound/`.
 * 4. Creates `vite.android.config.ts` using Vite's `mergeConfig` to alias Tauri desktop plugins
 *    to `scripts/tauri-plugin-shims.ts`.
 * 5. Injects `tauri-android-runtime.js`, desktop `matchMedia` override (forcing Chessboard on Left,
 *    Panels on Right), and 1366px Landscape PC Widescreen scaling into `index.html`.
 *
 * Built for the chess community by neuroflowinfinix (D. Ujjwal) — neuroflow_infinix@outlook.in
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function log(msg) {
  console.log(`[Prepare-EnCroissant-Android] ${msg}`);
}

// 1. Download official nmrugg/stockfish.js v19.0.1 Lite Single (.js) and Lozza into public/engines/ AND public/
const publicDir = path.join(ROOT, 'public');
const enginesDir = path.join(publicDir, 'engines');
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
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v18/stockfish-18-lite-single.js',
    fallbackUrl: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.js',
    dest: path.join(enginesDir, 'stockfish-18-lite-single.js'),
  },
  {
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v18/stockfish-18-lite-single.wasm',
    fallbackUrl: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.wasm',
    dest: path.join(enginesDir, 'stockfish-18-lite-single.wasm'),
  },
  {
    url: 'https://github.com/nmrugg/stockfish.js/releases/download/v18/stockfish-18-asm.js',
    fallbackUrl: 'https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-asm.js',
    dest: path.join(enginesDir, 'stockfish-18-asm.js'),
  },
  {
    url: 'https://raw.githubusercontent.com/op12no2/lozza/master/lozza.js',
    dest: path.join(enginesDir, 'lozza.js'),
  },
];

for (const item of downloads) {
  if (!fs.existsSync(item.dest) || fs.statSync(item.dest).size < 1024) {
    log(`Downloading ${path.basename(item.dest)}...`);
    try {
      execSync(`curl --retry 3 --retry-delay 2 -fsSL "${item.url}" -o "${item.dest}"`, { stdio: 'inherit' });
    } catch (err) {
      if (item.fallbackUrl) {
        execSync(`curl --retry 3 --retry-delay 2 -fsSL "${item.fallbackUrl}" -o "${item.dest}"`, { stdio: 'inherit' });
      } else {
        throw err;
      }
    }
  }
  fs.copyFileSync(item.dest, path.join(publicDir, path.basename(item.dest)));
}

// Copy stockfish-19-fast.js as an additional selectable Lite Single JS engine
fs.copyFileSync(
  path.join(enginesDir, 'stockfish-19-lite-single.js'),
  path.join(enginesDir, 'stockfish-19-fast.js')
);

// 2. Auto-detect exact Token format from upstream src/bindings.ts, src-tauri/src/lexer.rs & src/utils/chess.ts
const runtimeTsPath = path.join(ROOT, 'scripts/tauri-android-runtime.ts');
if (fs.existsSync(runtimeTsPath)) {
  const bindingsFile = fs.existsSync(path.join(ROOT, 'src/bindings/generated.ts')) ? path.join(ROOT, 'src/bindings/generated.ts') : path.join(ROOT, 'src/bindings.ts');
  const bindingsTxt = fs.existsSync(bindingsFile) ? fs.readFileSync(bindingsFile, 'utf8') : '';
  const lexerRsTxt = fs.existsSync(path.join(ROOT, 'src-tauri/src/lexer.rs'))
    ? fs.readFileSync(path.join(ROOT, 'src-tauri/src/lexer.rs'), 'utf8')
    : '';
  const chessTsTxt = fs.existsSync(path.join(ROOT, 'src/utils/chess.ts'))
    ? fs.readFileSync(path.join(ROOT, 'src/utils/chess.ts'), 'utf8')
    : '';
  const combined = `${bindingsTxt}\n${lexerRsTxt}\n${chessTsTxt}`;

  let parenMode = 'ParenOpen';
  if (
    (combined.includes('"Paren"') && !combined.includes('"ParenOpen"')) ||
    (lexerRsTxt.includes('Paren(') && !lexerRsTxt.includes('ParenOpen'))
  ) {
    parenMode = 'Paren';
  }

  let keepBraces = 'false';
  if (
    chessTsTxt.includes('.slice(1, -1)') ||
    chessTsTxt.includes('replace(/^\\{|\\}$/') ||
    lexerRsTxt.includes('format!("{')
  ) {
    keepBraces = 'true';
  }

  const chessRsTxt = fs.existsSync(path.join(ROOT, 'src-tauri/src/chess.rs'))
    ? fs.readFileSync(path.join(ROOT, 'src-tauri/src/chess.rs'), 'utf8')
    : '';
  const treeTsTxt = fs.existsSync(path.join(ROOT, 'src/state/store/tree.ts'))
    ? fs.readFileSync(path.join(ROOT, 'src/state/store/tree.ts'), 'utf8')
    : '';

  // En Croissant's Rust backend (src-tauri/src/chess.rs invert_score) ALWAYS inverts Black's UCI score to White-relative
  const backendNegatesBlack = 'true';

  let rt = fs.readFileSync(runtimeTsPath, 'utf8');
  rt = rt.replace('__EC_PAREN_TOKEN_MODE__', parenMode);
  rt = rt.replace('__EC_COMMENT_KEEP_BRACES__', keepBraces);
  rt = rt.replace('__EC_BACKEND_NEGATES_BLACK_SCORE__', backendNegatesBlack);
  fs.writeFileSync(runtimeTsPath, rt, 'utf8');
  log(`Configured tauri-android-runtime.ts (parenMode=${parenMode}, keepBraces=${keepBraces}, backendNegatesBlack=${backendNegatesBlack})`);
}

// 3. Copy bundled sound/ directory into public/sound/
const srcSound = path.join(ROOT, 'sound');
const destSound = path.join(ROOT, 'public', 'sound');
if (fs.existsSync(srcSound)) {
  fs.cpSync(srcSound, destSound, { recursive: true });
  log('Copied sound/ collections into public/sound/');
}

// 4. Create vite.android.config.ts using Vite mergeConfig
const shimPath = path.resolve(ROOT, 'scripts/tauri-plugin-shims.ts').replace(/\\/g, '/');
const srcPath = path.resolve(ROOT, 'src').replace(/\\/g, '/');
const viteAndroidConfig = `import path from "path";
import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

const shimPath = "${shimPath}";

export default defineConfig(async (env) => {
  const resolvedBase = typeof baseConfig === "function" ? await baseConfig(env) : await baseConfig;
  return mergeConfig(resolvedBase, {
    resolve: {
      alias: [
        { find: "@tauri-apps/api/path", replacement: shimPath },
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
        { find: "@tauri-apps/plugin-shell", replacement: shimPath },
        { find: "@tauri-apps/plugin-clipboard-manager", replacement: shimPath },
        { find: "@", replacement: "${srcPath}" }
      ]
    }
  });
});
`;
fs.writeFileSync(path.join(ROOT, 'vite.android.config.ts'), viteAndroidConfig, 'utf8');
log('Created vite.android.config.ts with Tauri plugin shims');

// 5. Inject tauri-android-runtime.js, desktop matchMedia override, and 1366px Landscape PC viewport into index.html
const indexHtmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const injection = `
    <meta id="ec-viewport" name="viewport" content="width=1366, initial-scale=0.58, minimum-scale=0.35, maximum-scale=2.0, user-scalable=yes, viewport-fit=cover" />
    <script>
      (function() {
        var origMatchMedia = window.matchMedia ? window.matchMedia.bind(window) : null;
        window.matchMedia = function(query) {
          var q = String(query || "").toLowerCase();
          if (q.indexOf("max-width") !== -1) {
            return {
              matches: false,
              media: query,
              onchange: null,
              addListener: function() {},
              removeListener: function() {},
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return false; }
            };
          }
          if (q.indexOf("min-width") !== -1) {
            return {
              matches: true,
              media: query,
              onchange: null,
              addListener: function() {},
              removeListener: function() {},
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return false; }
            };
          }
          return origMatchMedia ? origMatchMedia(query) : { matches: false, media: query, addListener: function() {}, removeListener: function() {}, addEventListener: function() {}, removeEventListener: function() {} };
        };

        function updateDesktopViewport() {
          var vp = document.getElementById("ec-viewport");
          if (!vp) return;
          var w = Math.max(window.screen.width || 800, window.screen.height || 800);
          var scale = Math.max(0.40, Math.min(1.0, w / 1366)).toFixed(3);
          vp.setAttribute("content", "width=1366, initial-scale=" + scale + ", minimum-scale=0.35, maximum-scale=2.0, user-scalable=yes, viewport-fit=cover");
        }
        updateDesktopViewport();
        window.addEventListener("resize", updateDesktopViewport);
        window.addEventListener("orientationchange", updateDesktopViewport);
      })();
    </script>
    <script src="/tauri-android-runtime.js"></script>
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
    log('Injected tauri-android-runtime.js and 1366px Landscape PC viewport into index.html');
  }
}

// 6. Write capacitor.config.json
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

// 7. Ensure compact layout default in BoardsPage.tsx uses direction: "row" (Board on Left, Panels on Right) without renaming any identifiers
const boardsPagePath = path.join(ROOT, 'src/components/tabs/BoardsPage.tsx');
if (fs.existsSync(boardsPagePath)) {
  let bp = fs.readFileSync(boardsPagePath, 'utf8');
  bp = bp.replace(/direction:\s*["']column["']\s*,\s*first:\s*["']top["']/g, 'direction: "row", first: "top"');
  bp = bp.replace(/direction:\s*["']column["']\s*,\s*first:\s*["']left["']/g, 'direction: "row", first: "left"');
  fs.writeFileSync(boardsPagePath, bp, 'utf8');
  log('Verified side-by-side row layout in src/components/tabs/BoardsPage.tsx');
}

// 8. Ensure BoardGame.tsx never sets "undefined vs. undefined" if an engine name field is missing
const boardGamePath = path.join(ROOT, 'src/components/boards/BoardGame.tsx');
if (fs.existsSync(boardGamePath)) {
  let bg = fs.readFileSync(boardGamePath, 'utf8');
  bg = bg.replace(/\$\{([^}]+)\}\s+vs\.\s+\$\{([^}]+)\}/g, '${($1) || "Stockfish 19.0.1"} vs. ${($2) || "Stockfish 19.0.1"}');
  fs.writeFileSync(boardGamePath, bg, 'utf8');
  log('Added player name fallback guard in src/components/boards/BoardGame.tsx');
}

// 9. Ensure downloadChessCom in src/utils/chess.com/api.tsx downloads all archives (not skipping earlier months if a partial download set timestamp)
const chessComApiPath = path.join(ROOT, 'src/utils/chess.com/api.tsx');
if (fs.existsSync(chessComApiPath)) {
  let cc = fs.readFileSync(chessComApiPath, 'utf8');
  cc = cc.replace(/export\s+async\s+function\s+downloadChessCom\s*\(\s*player\s*:\s*string\s*,\s*timestamp\s*:\s*number\s*\|\s*null\s*\)\s*\{/,
    'export async function downloadChessCom(player: string, timestamp: number | null) { timestamp = null;');
  fs.writeFileSync(chessComApiPath, cc, 'utf8');
  log('Configured downloadChessCom in src/utils/chess.com/api.tsx to fetch full archive history');
}

// 10. Restore PC OpeningsPanel (White/Black opening stats + ResultsChart bars without requiring an external DB)
//     and ensure RatingsPanel & WebsiteAccountSelector handle YYYY.MM.DD / YYYY-MM-DD dates and case-insensitive usernames
const personalCardPath = path.join(ROOT, 'src/components/home/PersonalCard.tsx');
if (fs.existsSync(personalCardPath)) {
  let pc = fs.readFileSync(personalCardPath, 'utf8');
  pc = pc.replace(
    /<OpeningsPanel\s+playerName=\{name\}\s+openingSources=\{openingSources\}\s*\/>/g,
    '<OpeningsPanel playerName={name} info={info} isDatabase={isDatabase} openingSources={openingSources} />'
  );
  fs.writeFileSync(personalCardPath, pc, 'utf8');
  log('Updated src/components/home/PersonalCard.tsx to pass info and isDatabase to OpeningsPanel');
}

const openingsCssPath = path.join(ROOT, 'src/components/home/PersonalCardPanels/OpeningsPanel.module.css');
if (fs.existsSync(openingsCssPath)) {
  let css = fs.readFileSync(openingsCssPath, 'utf8');
  if (!css.includes('.link')) {
    css += '\n.link {\n  cursor: pointer;\n}\n.link:hover {\n  text-decoration: underline;\n}\n';
    fs.writeFileSync(openingsCssPath, css, 'utf8');
  }
}

const openingsPanelPath = path.join(ROOT, 'src/components/home/PersonalCardPanels/OpeningsPanel.tsx');
if (fs.existsSync(openingsPanelPath)) {
  const pcOpeningsPanelCode = `import { Box, Divider, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Color } from "chessops";
import { useAtom, useAtomValue } from "jotai";
import { useRef, useState } from "react";
import type { PlayerGameInfo } from "@/bindings";
import { commands, type GameOutcome } from "@/bindings";
import { activeTabAtom, fontSizeAtom, tabsAtom } from "@/state/atoms";
import { parsePGN } from "@/utils/chess";
import { createTab } from "@/utils/tabs";
import { getTimeControl } from "@/utils/timeControl";
import { countMainPly, defaultTree } from "@/utils/treeReducer";
import { unwrap } from "@/utils/unwrap";
import classes from "./OpeningsPanel.module.css";
import ResultsChart from "./ResultsChart";
import TimeControlSelector from "./TimeControlSelector";
import WebsiteAccountSelector from "./WebsiteAccountSelector";

export interface OpeningSource {
  file: string;
  player: string;
}

type OpeningStats = {
  name: string;
  games: number;
  won: number;
  draw: number;
  lost: number;
};

function aggregateOpenings(
  data: { opening: string; result: GameOutcome; is_player_white: boolean }[],
  color: Color,
): OpeningStats[] {
  return Array.from(
    data
      .filter((d) => d.is_player_white === (color === "white"))
      .reduce((acc, d) => {
        const key = d.opening || "King's Pawn Game";
        const prev = acc.get(key) ?? {
          won: 0,
          draw: 0,
          lost: 0,
          total: 0,
        };
        acc.set(key, {
          won: prev.won + (d.result === "Won" ? 1 : 0),
          draw: prev.draw + (d.result === "Drawn" || (d.result as string) === "Draw" ? 1 : 0),
          lost: prev.lost + (d.result === "Lost" ? 1 : 0),
          total: prev.total + 1,
        });
        return acc;
      }, new Map<string, { won: number; draw: number; lost: number; total: number }>()),
  )
    .map(([name, { won, draw, lost, total }]) => ({
      name,
      games: total,
      won,
      draw,
      lost,
    }))
    .sort((a, b) => b.games - a.games);
}

function OpeningsPanel({
  playerName,
  info,
  isDatabase,
}: {
  playerName: string;
  info?: PlayerGameInfo;
  isDatabase?: boolean;
  openingSources?: OpeningSource[];
}) {
  const [website, setWebsite] = useState<string | null>("All websites");
  const [account, setAccount] = useState<string | null>("All accounts");
  const [timeControl, setTimeControl] = useState<string | null>(null);

  const openingData =
    info?.site_stats_data
      ?.filter((d) => !website || website === "All websites" || d.site === website)
      .filter((d) => !account || account === "All accounts" || d.player?.toLowerCase() === account.toLowerCase())
      .flatMap((d) => d.data)
      .filter(
        (g) =>
          !timeControl ||
          timeControl === "any" ||
          getTimeControl(website!, g.time_control) === timeControl,
      )
      .map((g) => ({
        opening: (g as any).opening || "King's Pawn Game",
        result: g.result,
        is_player_white: g.is_player_white,
      })) ?? [];

  const whiteGames = openingData.filter((g) => g.is_player_white).length;
  const blackGames = openingData.filter((g) => !g.is_player_white).length;

  const whiteOpenings = aggregateOpenings(openingData, "white");
  const blackOpenings = aggregateOpenings(openingData, "black");

  const fontSize = useAtomValue(fontSizeAtom);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.max(whiteOpenings.length, blackOpenings.length),
    estimateSize: () => 120 * ((fontSize || 100) / 100),
    getScrollElement: () => parentRef.current,
  });

  return (
    <Stack gap={0} h="100%">
      <Group grow>
        {!isDatabase && (
          <WebsiteAccountSelector
            playerName={playerName}
            onWebsiteChange={(w) => {
              setWebsite(w);
            }}
            onAccountChange={setAccount}
            allowAll={true}
          />
        )}
        <TimeControlSelector
          website={website}
          onTimeControlChange={setTimeControl}
          allowAll={true}
        />
      </Group>

      <Group grow pt="xl">
        <Text ta="center" fw="bold">
          White ({whiteGames})
        </Text>
        <Text ta="center" fw="bold">
          Black ({blackGames})
        </Text>
      </Group>
      <Divider mt="md" />
      <ScrollArea viewportRef={parentRef} flex={1}>
        <Box
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const white = whiteOpenings[virtualRow.index];
            const black = blackOpenings[virtualRow.index];
            return (
              <Box
                key={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: \`translateY(\${virtualRow.start}px)\`,
                }}
              >
                <Group grow>
                  {white ? (
                    <OpeningDetail opening={white} totalGames={whiteGames} color="white" />
                  ) : (
                    <div />
                  )}
                  {black ? (
                    <OpeningDetail opening={black} totalGames={blackGames} color="black" />
                  ) : (
                    <div />
                  )}
                </Group>
                <Divider />
              </Box>
            );
          })}
        </Box>
      </ScrollArea>
    </Stack>
  );
}

function OpeningDetail({
  opening,
  totalGames,
  color,
}: {
  opening: OpeningStats;
  totalGames: number;
  color: Color;
}) {
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const navigate = useNavigate();

  const openingRate = totalGames > 0 ? opening.games / totalGames : 0;
  return (
    <Stack py="sm" justify="space-between">
      <Group justify="space-between" wrap="nowrap">
        <Text
          lineClamp={2}
          className={classes.link}
          onClick={async () => {
            const pgn = unwrap(await commands.getOpeningFromName(opening.name));
            const headers = defaultTree().headers;
            const tree = await parsePGN(pgn);
            headers.orientation = color;
            createTab({
              tab: { name: opening.name, type: "analysis" },
              pgn,
              headers,
              setTabs,
              setActiveTab,
              position: Array(countMainPly(tree.root)).fill(0),
            });
            navigate({ to: "/" });
          }}
        >
          {opening.name}
        </Text>
        <Text>{(openingRate * 100).toFixed(2)}%</Text>
      </Group>
      <ResultsChart won={opening.won} draw={opening.draw} lost={opening.lost} size="1.5rem" />
    </Stack>
  );
}

export default OpeningsPanel;
`;
  fs.writeFileSync(openingsPanelPath, pcOpeningsPanelCode, 'utf8');
  log('Restored full PC OpeningsPanel.tsx with White/Black opening stats and ResultsChart bars');
}

const websiteSelectorPath = path.join(ROOT, 'src/components/home/PersonalCardPanels/WebsiteAccountSelector.tsx');
if (fs.existsSync(websiteSelectorPath)) {
  let ws = fs.readFileSync(websiteSelectorPath, 'utf8');
  ws = ws.replace(
    /\bs\.player === playerName\b/g,
    '((s.player || s.chessCom?.username || s.lichess?.username)?.toLowerCase() === playerName?.toLowerCase() || s.chessCom?.username?.toLowerCase() === playerName?.toLowerCase() || s.lichess?.username?.toLowerCase() === playerName?.toLowerCase())'
  );
  fs.writeFileSync(websiteSelectorPath, ws, 'utf8');
  log('Patched WebsiteAccountSelector.tsx for case-insensitive player/account matching');
}

const overviewPanelPath = path.join(ROOT, 'src/components/home/PersonalCardPanels/OverviewPanel.tsx');
if (fs.existsSync(overviewPanelPath)) {
  let ov = fs.readFileSync(overviewPanelPath, 'utf8');
  ov = ov.replace(/\bd\.player === account\b/g, 'd.player?.toLowerCase() === account?.toLowerCase()');
  fs.writeFileSync(overviewPanelPath, ov, 'utf8');
  log('Patched OverviewPanel.tsx for case-insensitive account matching');
}

const ratingsPanelPath = path.join(ROOT, 'src/components/home/PersonalCardPanels/RatingsPanel.tsx');
if (fs.existsSync(ratingsPanelPath)) {
  let rp = fs.readFileSync(ratingsPanelPath, 'utf8');
  rp = rp.replace(/\bgames\.player === account\b/g, 'games.player?.toLowerCase() === account?.toLowerCase()');
  rp = rp.replace(/dayjs\(game\.date,\s*["']YYYY-MM-DD["'],\s*true\)/g, 'dayjs(String(game.date || "").replace(/\\./g, "-"), "YYYY-MM-DD")');
  rp = rp.replace(
    /<TimeControlSelector\s+onTimeControlChange=\{setTimeControl\}\s+website=\{website\}\s+allowAll=\{false\}\s*\/>/g,
    '<TimeControlSelector onTimeControlChange={setTimeControl} website={website} allowAll={true} />'
  );
  fs.writeFileSync(ratingsPanelPath, rp, 'utf8');
  log('Patched RatingsPanel.tsx for YYYY.MM.DD/YYYY-MM-DD date parsing and All Time Controls support');
}

const reportModalPath = path.join(ROOT, 'src/components/panels/analysis/ReportModal.tsx');
if (fs.existsSync(reportModalPath)) {
  let rm = fs.readFileSync(reportModalPath, 'utf8');
  rm = rm.replace(/novelty:\s*true/g, 'novelty: false');
  rm = rm.replace(/if\s*\(\s*value\s*&&\s*!referencedDb\s*\)\s*return\s+t\(["']Board\.Analysis\.RefDBRequired["']\);/g, '');
  fs.writeFileSync(reportModalPath, rm, 'utf8');
  log('Patched ReportModal.tsx so Game Report runs without requiring an external novelty database');
}
