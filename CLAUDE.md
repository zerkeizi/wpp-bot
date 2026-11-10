# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Autozap" — a WhatsApp bot built on Baileys (`@whiskeysockets/baileys`). It turns images/videos (or an image found on Bing with `-s`) into WhatsApp stickers, optionally with outlined meme-style text, and serves a small web page that shows the WhatsApp pairing QR code and connection status in real time over Socket.IO.

Plain JavaScript ES modules (`"type": "module"`), no build step, no TypeScript (source files use `// @ts-nocheck`; `jsconfig.json` enables `checkJs`). There are no tests or linter configured.

## Commands

Package manager is pnpm.

```bash
pnpm install
pnpm generate   # REQUIRED before first run: builds public/js/globals.js from .env
pnpm dev        # node-dev with auto-restart
pnpm start      # node src/server.js
```

- Copy `.env.default` to `.env` and set `AUTOZAP_SOCKET_URL` (the Socket.IO URL the browser client connects to). `scripts/generate.sh` reads `.env` and writes the gitignored `public/js/globals.js`; without it the web client throws `globals.SOCKET_URL not set!`.
- `PORT` env var sets the HTTP port (default 8080); `WA_LOG_LEVEL` sets the Baileys log level written to `wa-logs.txt` (default `info`, use `trace` to debug Baileys). Note `.env` is not loaded into the Node process — it is only consumed by `generate.sh`.
- ffmpeg is bundled via `@ffmpeg-installer/ffmpeg` (a 2018 build; e.g. no `drawtext` `text_align`). Its path is set in `src/useCases/media/index.js`.

## Architecture

- **`src/server.js`** — entry point. Express serves `public/` statically and `src/client/index.html` at `/`. Also exposes `POST /kill` (log out: unlink the device, close the socket, delete the session) and `POST /reconnect` (no-op if already connected). Holds the Socket.IO server, the latest QR code, and a single `clientSocket` (only the most recently connected browser tab receives updates). Calls `connectToWhatsApp()` via top-level await and exports `emitter { updateClient, killWPSession }`.
- **`src/useCases/connection/index.js`** — owns the single Baileys socket (`currentSock`); `connectToWhatsApp()` is a no-op while one is open or being opened, because two sockets on the same session make WhatsApp kick one ("connection replaced"). Persists auth via `useMultiFileAuthState('sess_auth_info')`. Events: `connection.update` → forwards state/QR to the browser via `emitter.updateClient` and auto-reconnects, except on `loggedOut` (→ `killWPSession`) or `connectionReplaced` (another instance took over; reconnecting would ping-pong); events from a replaced socket are ignored. `creds.update` → save creds; `messages.upsert` → `messageResolver` (not awaited). Imports `emitter` from `server.js`, so there is a **circular import** — keep `emitter` access inside callbacks, not at module top level.
- **`src/useCases/messager/`** — commands.
  - `commandParser.js`: a message is a command only if it **starts** with `/pedido` or `/sticker` (aliases; case-insensitive; leading @mentions skipped). The rest is parsed as CLI flags with `node:util` `parseArgs` (strict) after normalizing smart quotes; double quotes group words. Flags: `-s/--search`, `-t/--top-text`, `-b/--bottom-text`, `--text-color`, `--outline-color`, `-h/--help`. New flags go in `OPTIONS` + `USAGE` (+ `validateFlags`). Colors are validated by regex because they are interpolated into the ffmpeg filter string.
  - `index.js`: processes every message of an upsert batch (each in its own try/catch), unwraps ephemeral/view-once with Baileys' `normalizeMessageContent`/`getContentType`, and takes media from the message or from the quoted message (reply). `handleCommand` routes: parse error/help → text reply; `-s` → search; media → sticker. Text flags only apply to provided images (not videos, not `-s`). Work runs through `runLimited` (max 2 concurrent conversions); failures reply "Não consegui criar o sticker.".
- **`src/useCases/search/bingImages.js`** — scrapes Bing Images (`/images/async`, `adlt=strict`), parsing the JSON in each result's `m="..."` attribute; tries the original URL then Bing's thumbnail for the first 5 results. Fragile by nature: if Bing changes its markup, this is the file to fix.
- **`src/useCases/media/index.js`** — our own ffmpeg steps (error handling, timeout, temp dir cleanup), run before `createSticker`:
  - `toAnimatedWebp`: videos/GIFs → square 512×512 animated webp (first 10 s). Animated stickers then use `StickerTypes.FULL`: **don't switch to `CROPPED`** or pass raw video to `createSticker` — wa-sticker-formatter's own ffmpeg calls (`crop`, `videoToGif`) have no error handler and crash the process on bad input.
  - `addTextToImage`: scales the image into 512×512, draws each text line with its own `drawtext` (text via `textfile=` so user input needs no escaping; font size is an ffmpeg expression of the image size; lines aligned by baseline with `ascent`), then pads transparent. Font: `assets/fonts/Anton-Regular.ttf` (OFL).
- **Web client** — `src/client/index.html` (inline module script) + `public/js/components.js` (prebuilt status DOM elements) + generated `public/js/globals.js`. On load it emits `qr.first`; the server replies with `qr.update` carrying `{ connection, qr (data URL), isOnline }`. Client caches status in `localStorage` and renders connected / closed (with reconnect button) / QR image / connecting.

### Runtime state (all gitignored)

- `sess_auth_info/` — WhatsApp session credentials. Its existence is how the server decides whether a session exists; deleting it logs out.
- `wa-logs.txt` — Baileys pino log (level from `WA_LOG_LEVEL`).

`src/utils/logger.js` and `utils/logger.js` are duplicate, currently unused pino loggers.

## Deployment

`.github/workflows/deploy.yml` runs on push/PR to `main`, but currently only tests an SSH connection (`whoami`) to the server using `SERVER_HOST`/`SERVER_USER`/`SERVER_PWD` secrets — it does not actually deploy.

## Conventions

Code comments and log messages mix Portuguese and English. Replies sent to WhatsApp users are in Portuguese.
