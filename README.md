# wpp-bot (Autozap ⚡)

A WhatsApp bot that turns images, videos and GIFs into stickers, optionally with outlined meme-style text, or finds an image on the web and turns that into a sticker. It connects as a linked device through [Baileys](https://github.com/WhiskeySockets/Baileys) and serves a small web page to scan the pairing QR code.

## Setup

Requires Node.js 22+ (built-in `fetch`, `node:test` with glob patterns) and pnpm. ffmpeg is bundled, nothing to install.

```bash
pnpm install
cp .env.default .env      # set AUTOZAP_SOCKET_URL: the Socket.IO URL the web page connects to
pnpm generate             # required once: writes public/js/globals.js from .env
pnpm start                # or `pnpm dev` to restart on changes
```

Open `http://localhost:8080` (or `PORT`) and scan the QR code with WhatsApp (**Linked devices**). The session is saved in `sess_auth_info/`.

Environment variables (set them in the shell; `.env` is only read by `pnpm generate`):

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `WA_LOG_LEVEL` | `info` | Baileys log level in `wa-logs.txt` (`trace` to debug Baileys) |

## Using the bot

Send the command in the caption of an image/video, or as a reply to one. `/sticker` and `/pedido` are the same command, and the message must **start** with it.

```
/sticker                                        sticker from the image/video
/sticker -t "Oh my" -b "GOD"                    outlined text at the top and bottom
/sticker -b "GOD" --text-color=yellow --outline-color=#800080
/pedido -s a person laughing evil               search the web and send the first image as a sticker
/sticker -h                                     help
```

| Flag | |
|---|---|
| `-s`, `--search` | search Bing Images for the words after the command (no media needed) |
| `-t`, `--top-text="..."` | text at the top (images you send only, not videos or `-s`) |
| `-b`, `--bottom-text="..."` | text at the bottom (images you send only) |
| `--text-color=...` | text color, English name or `#RRGGBB` (default white) |
| `--outline-color=...` | outline color (default black) |
| `-h`, `--help` | show the help |

Videos and GIFs become animated stickers (first 10 seconds).

When something goes wrong (unknown flag, no image, nothing found…), the bot replies to your message with the "nau cunsigui." sticker. It's always the same sticker, so it doesn't fill people's sticker lists. The exact reason is printed in the bot's log; `/sticker -h` shows how to use the command.

## Development

### Tests

```bash
pnpm test           # command parsing + sticker building, against the media in test/fixtures
pnpm test:watch
pnpm test:search    # live Bing search (network), kept out of `pnpm test`
```

Tests use fixed media (`test/fixtures/`) and check the stickers automatically (size, animation, metadata). They don't need WhatsApp.

### Preview a sticker from your own file

To **see** how a sticker comes out for a file you choose, before sending anything through WhatsApp:

```bash
pnpm preview <path to image/video/gif> [flags]
```

> ⚠️ **The first argument must be the path to a file that exists**, e.g. `~/Pictures/cat.jpg`. The flags are the same as the bot command.

```bash
pnpm preview ~/Pictures/cat.jpg -t "Oh my" -b "GOD" --text-color=yellow
pnpm preview ~/Videos/clip.mp4
pnpm preview test/fixtures/landscape.jpg -b "works with the test media too"
pnpm preview -s cat with sunglasses        # -s needs no file: searches Bing like /pedido -s
```

The sticker is saved in `preview/` (not committed). Open `preview/index.html` in a browser to see every sticker you've previewed, on a checkerboard background where transparency is visible.

### Reply stickers

The error reply sticker is made from `assets/image/nau_cunsigui.png`. After adding or changing an image in `assets/image/`, run:

```bash
pnpm stickers:build    # writes assets/stickers/<name>.webp
```

and commit the generated `.webp`. The bot sends that exact file, so WhatsApp keeps treating it as the same sticker. Regenerating an unchanged image prints `unchanged`. If it prints `CHANGED`, WhatsApp will see a new sticker, so only commit that when you meant to change it.
