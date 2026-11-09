# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Autozap" — a WhatsApp bot built on Baileys (`@whiskeysockets/baileys`). It turns images/videos into WhatsApp stickers when they are sent with a command caption, and serves a small web page that shows the WhatsApp pairing QR code and connection status in real time over Socket.IO.

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
- ffmpeg is bundled via `@ffmpeg-installer/ffmpeg` (configured in `server.js`), needed for animated stickers.

## Architecture

- **`src/server.js`** — entry point. Express serves `public/` statically and `src/client/index.html` at `/`. Also exposes `POST /kill` (delete session) and `POST /reconnect`. Holds the Socket.IO server, the latest QR code, and a single `clientSocket` (only the most recently connected browser tab receives updates). Calls `connectToWhatsApp()` via top-level await and exports `emitter { updateClient, killWPSession }`.
- **`src/useCases/connection/index.js`** — creates the Baileys socket, persists auth via `useMultiFileAuthState('sess_auth_info')`, and handles events: `connection.update` → forwards state/QR to the browser through `emitter.updateClient`, auto-reconnects unless logged out (logged out → `killWPSession`); `creds.update` → save creds; `messages.upsert` → `messageResolver`. Imports `emitter` from `server.js`, so there is a **circular import** between these two modules — keep `emitter` access inside callbacks, not at module top level.
- **`src/useCases/messager/index.js`** — message handling. If an incoming `imageMessage`/`videoMessage` has a caption exactly matching one of `COMMAND_NAMES` (`/sticker`, `/pedido`, `/pedido baianinho`), downloads the media and replies with a sticker via `wa-sticker-formatter` (static: FULL, quality 50; animated: CROPPED, quality 30). New commands/behaviors go here.
- **Web client** — `src/client/index.html` (inline module script) + `public/js/components.js` (prebuilt status DOM elements) + generated `public/js/globals.js`. On load it emits `qr.first`; the server replies with `qr.update` carrying `{ connection, qr (data URL), isOnline }`. Client caches status in `localStorage` and renders connected / closed (with reconnect button) / QR image / connecting.

### Runtime state (all gitignored)

- `sess_auth_info/` — WhatsApp session credentials. Its existence is how the server decides whether a session exists; deleting it logs out.
- `wa-logs.txt` — Baileys pino log (level from `WA_LOG_LEVEL`).

`src/utils/logger.js` and `utils/logger.js` are duplicate, currently unused pino loggers.

## Deployment

`.github/workflows/deploy.yml` runs on push/PR to `main`, but currently only tests an SSH connection (`whoami`) to the server using `SERVER_HOST`/`SERVER_USER`/`SERVER_PWD` secrets — it does not actually deploy.

## Conventions

Code comments and log messages mix Portuguese and English.
