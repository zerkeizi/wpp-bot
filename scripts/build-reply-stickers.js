// Renders every image in assets/image/ into a reply sticker in assets/stickers/ (same name, .webp).
// Run it only when an image is added or changed, and commit the output: the bot sends those
// exact bytes, so WhatsApp always sees the same sticker (same file hash), not a new one each time.
//
//   pnpm stickers:build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSticker } from '../src/useCases/sticker/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'assets/image');
const OUT_DIR = path.join(ROOT, 'assets/stickers');

// fixed per image, so rebuilding an unchanged image gives the same bytes
export const replyStickerId = (name) => `wpp-bot-reply-${name}`;

const main = async () => {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const images = fs.readdirSync(SOURCE_DIR).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
	if (images.length === 0) throw new Error(`No images in ${SOURCE_DIR}`);

	for (const file of images) {
		const { name, ext } = path.parse(file);
		const sticker = await buildSticker({
			buffer: fs.readFileSync(path.join(SOURCE_DIR, file)),
			kind: 'image',
			ext: ext.slice(1).toLowerCase(),
			id: replyStickerId(name),
		});
		const output = path.join(OUT_DIR, `${name}.webp`);
		const previous = fs.existsSync(output) ? fs.readFileSync(output) : null;
		fs.writeFileSync(output, sticker);
		const status = !previous ? 'new' : previous.equals(sticker) ? 'unchanged' : 'CHANGED (WhatsApp will see a new sticker)';
		console.log(`${path.relative(ROOT, output)}  ${(sticker.length / 1024).toFixed(0)} KB  ${status}`);
	}
};

// only run when executed directly, not when a test imports replyStickerId
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((e) => {
		console.error(e);
		process.exitCode = 1;
	});
}
