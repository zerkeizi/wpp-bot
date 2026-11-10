// Builds a sticker from a file you choose (or a Bing search), without WhatsApp, and writes it
// to preview/ with an index.html gallery to open in the browser. The fixed test media is
// covered by `pnpm test`; this is for trying your own files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSticker } from '../src/useCases/sticker/index.js';
import { parseCommand, getTextOptions, textUsageError, USAGE } from '../src/useCases/messager/commandParser.js';
import { searchImages, downloadFirstImage } from '../src/useCases/search/bingImages.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'preview');

const HOW_TO_USE = `Usage: pnpm preview <path to image/video/gif> [flags]
       pnpm preview -s <search terms>

  pnpm preview ~/Pictures/cat.jpg -t "Oh my" -b GOD --text-color=yellow
  pnpm preview test/fixtures/clip-12s.mp4
  pnpm preview -s cat with sunglasses

Flags are the same as the bot command (/sticker -h).`;

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'mkv', '3gp'];

const main = async () => {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error(HOW_TO_USE);
		process.exitCode = 1;
		return;
	}

	// first argument is the media file, unless it's a flag (e.g. -s searches)
	const file = args[0].startsWith('-') ? null : path.resolve(args.shift());
	if (file && !fs.existsSync(file)) {
		console.error(`✖ File not found: ${file}\n\n${HOW_TO_USE}`);
		process.exitCode = 1;
		return;
	}
	// re-quote arguments the shell already split, so the parser sees the same text a user would type
	const flags = args.map(arg => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
	const name = file ? path.parse(file).name : `search-${slug(args.filter(a => !a.startsWith('-')).join(' '))}`;

	fs.mkdirSync(OUT_DIR, { recursive: true });
	await render(name, file, flags);

	writeGallery();
	console.log(`\nOpen ${path.join(OUT_DIR, 'index.html')} in a browser`);
};

// Mirrors the bot's handleCommand, but writes the sticker to a file
const render = async (name, file, flagsText) => {
	const command = parseCommand(`/sticker ${flagsText}`);
	if (command.error) return fail(name, command.error);
	const { flags } = command;
	if (flags.help) return console.log(USAGE);

	const kind = file ? mediaKind(file) : null;
	const textError = textUsageError(flags, kind === 'image' ? 'image' : kind && 'video');
	if (textError) return fail(name, textError);

	let input;
	if (flags.search) {
		const query = command.positionals.join(' ');
		if (!query) return fail(name, 'Informe o que buscar, ex: pnpm preview -s gato rindo');
		const image = await downloadFirstImage(await searchImages(query));
		if (!image) return fail(name, `Nenhuma imagem encontrada para "${query}".`);
		input = { buffer: image.buffer, kind: image.mime === 'image/gif' ? 'gif' : 'image', ext: image.mime.split('/')[1] };
	} else {
		if (!file) return fail(name, `Missing file path.\n\n${HOW_TO_USE}`);
		input = { buffer: fs.readFileSync(file), kind, ext: path.extname(file).slice(1).toLowerCase() };
	}

	const started = Date.now();
	try {
		const sticker = await buildSticker({ ...input, text: getTextOptions(flags) });
		const output = path.join(OUT_DIR, `${name}.webp`);
		fs.writeFileSync(output, sticker);
		fs.writeFileSync(path.join(OUT_DIR, `${name}.txt`), `/sticker ${flagsText}`.trim());
		console.log(`✔ ${name}.webp  ${(sticker.length / 1024).toFixed(0)} KB  ${Date.now() - started} ms`);
	} catch (e) {
		fail(name, e.message.split('\n')[0]);
	}
};

const mediaKind = (file) => {
	const ext = path.extname(file).slice(1).toLowerCase();
	if (ext === 'gif') return 'gif';
	return VIDEO_EXTS.includes(ext) ? 'video' : 'image';
};

const fail = (name, message) => {
	process.exitCode = 1;
	console.error(`✖ ${name}: ${message}`);
};

const slug = (text) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'query';

// Lists every sticker in preview/, newest first, on a checkerboard so transparency is visible
const writeGallery = () => {
	const stickers = fs.readdirSync(OUT_DIR)
		.filter(f => f.endsWith('.webp'))
		.map(f => ({ f, time: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
		.sort((a, b) => b.time - a.time);

	const cards = stickers.map(({ f }) => {
		const commandFile = path.join(OUT_DIR, f.replace(/\.webp$/, '.txt'));
		const command = fs.existsSync(commandFile) ? fs.readFileSync(commandFile, 'utf8') : '';
		return `<figure><img src="${encodeURI(f)}" alt=""><figcaption><b>${escapeHtml(f)}</b><code>${escapeHtml(command)}</code></figcaption></figure>`;
	}).join('\n');

	fs.writeFileSync(path.join(OUT_DIR, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sticker preview</title>
<style>
	body { font-family: system-ui, sans-serif; margin: 16px; background: #f4f4f5; color: #18181b; }
	main { display: grid; grid-template-columns: repeat(auto-fill, minmax(256px, 1fr)); gap: 16px; }
	figure { margin: 0; background: #fff; border-radius: 8px; padding: 8px; box-shadow: 0 1px 3px #0002; }
	img { width: 100%; aspect-ratio: 1; display: block; border-radius: 4px;
		background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 24px 24px; }
	figcaption { font-size: 13px; margin-top: 6px; display: grid; gap: 4px; word-break: break-word; }
	code { color: #52525b; }
</style></head>
<body><h1>Sticker preview</h1><p>${stickers.length} stickers, newest first. 512×512, checkerboard = transparent.</p>
<main>
${cards}
</main></body></html>
`);
};

const escapeHtml = (text) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

main().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
