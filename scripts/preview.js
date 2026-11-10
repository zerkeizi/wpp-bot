// Builds stickers locally, without WhatsApp, and writes them to preview/ with an index.html
// gallery to open in the browser.
//
//   pnpm preview                               built-in examples from test/fixtures
//   pnpm preview photo.jpg -t "Oh my" -b GOD   your own file, same flags as the bot command
//   pnpm preview video.mp4
//   pnpm preview -s cat with sunglasses        real Bing search, like /pedido -s
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSticker } from '../src/useCases/sticker/index.js';
import { parseCommand, getTextOptions, textUsageError, USAGE } from '../src/useCases/messager/commandParser.js';
import { searchImages, downloadFirstImage } from '../src/useCases/search/bingImages.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'preview');
const FIXTURES = path.join(ROOT, 'test/fixtures');

const EXAMPLES = [
	{ name: 'landscape-plain', file: 'landscape.jpg', flags: '' },
	{ name: 'landscape-text', file: 'landscape.jpg', flags: '-t "Oh my" -b "GOD"' },
	{ name: 'portrait-colors-long-text', file: 'portrait.png', flags: `-t "quando o chefe diz: 'é só 5 minutinhos'" -b "ação 100%" --text-color=yellow --outline-color=purple` },
	{ name: 'video-animated', file: 'clip-12s.mp4', flags: '' },
	{ name: 'gif-animated', file: 'animation.gif', flags: '' },
];

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'mkv', '3gp'];

const main = async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const args = process.argv.slice(2);

	if (args.length === 0) {
		for (const { name, file, flags } of EXAMPLES) {
			await render(name, path.join(FIXTURES, file), flags);
		}
	} else {
		// first argument is the media file, unless it's a flag (e.g. -s searches)
		const file = args[0].startsWith('-') ? null : args.shift();
		// re-quote arguments the shell already split, so the parser sees the same text a user would type
		const flags = args.map(arg => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
		const name = file ? path.parse(file).name : `search-${slug(args.filter(a => !a.startsWith('-')).join(' '))}`;
		await render(name, file && path.resolve(file), flags);
	}

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
		if (!file) return fail(name, 'Informe um arquivo ou use -s <termos>.');
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
