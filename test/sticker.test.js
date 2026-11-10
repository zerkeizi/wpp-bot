import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSticker } from '../src/useCases/sticker/index.js';
import { inspectWebp } from './helpers/webp.js';

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

// stickers are 512x512 webp with the pack/author EXIF metadata
const assertSticker = (sticker, { animated }) => {
	const info = inspectWebp(sticker);
	assert.equal(info.width, 512);
	assert.equal(info.height, 512);
	assert.equal(info.animated, animated);
	assert.ok(info.hasExif, 'sticker metadata (pack/author) missing');
	return info;
};

describe('buildSticker: images', () => {
	it('makes a static sticker from a jpeg', async () => {
		assertSticker(await buildSticker({ buffer: fixture('landscape.jpg'), kind: 'image', ext: 'jpeg' }), { animated: false });
	});

	it('makes a static sticker from a png', async () => {
		assertSticker(await buildSticker({ buffer: fixture('portrait.png'), kind: 'image', ext: 'png' }), { animated: false });
	});

	it('draws text on images (output differs from the plain sticker)', async () => {
		const buffer = fixture('landscape.jpg');
		const plain = await buildSticker({ buffer, kind: 'image', ext: 'jpeg' });
		const withText = await buildSticker({
			buffer,
			kind: 'image',
			ext: 'jpeg',
			text: { topText: 'Oh my', bottomText: 'GOD', textColor: 'yellow', outlineColor: '#800080' },
		});
		assertSticker(withText, { animated: false });
		assert.notDeepEqual(withText, plain);
	});

	it('handles long text, accents and characters special to ffmpeg', async () => {
		const sticker = await buildSticker({
			buffer: fixture('portrait.png'),
			kind: 'image',
			ext: 'png',
			text: { topText: `quando o chefe diz: 'é só 5 minutinhos' 100% \\ ok`, bottomText: 'supercalifragilisticexpialidocious' },
		});
		assertSticker(sticker, { animated: false });
	});

	it('rejects an unknown color name (ffmpeg error) without crashing', async () => {
		await assert.rejects(
			buildSticker({ buffer: fixture('landscape.jpg'), kind: 'image', ext: 'jpeg', text: { topText: 'x', textColor: 'yelow' } }),
			/ffmpeg/,
		);
	});
});

describe('buildSticker: animated', () => {
	it('makes an animated sticker from a video, capped at 10 seconds', async () => {
		const info = assertSticker(await buildSticker({ buffer: fixture('clip-12s.mp4'), kind: 'video', ext: 'mp4' }), { animated: true });
		// 15 fps * 10 s; frames identical to the previous one may be merged, so allow fewer
		assert.ok(info.frames > 1 && info.frames <= 150, `unexpected frame count ${info.frames}`);
	});

	it('makes an animated sticker from a gif', async () => {
		const info = assertSticker(await buildSticker({ buffer: fixture('animation.gif'), kind: 'gif', ext: 'gif' }), { animated: true });
		assert.ok(info.frames > 1);
	});

	it('rejects a corrupt video without crashing the process', async () => {
		await assert.rejects(buildSticker({ buffer: fixture('corrupt.mp4'), kind: 'video', ext: 'mp4' }), /ffmpeg/);
	});

	it('refuses text on animated stickers', async () => {
		await assert.rejects(
			buildSticker({ buffer: fixture('animation.gif'), kind: 'gif', ext: 'gif', text: { topText: 'x' } }),
			/only supported on images/,
		);
	});
});
