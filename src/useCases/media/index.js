// @ts-nocheck
// ffmpeg steps that run before wa-sticker-formatter's createSticker():
// - toAnimatedWebp: videos/GIFs -> square 512x512 animated webp. With that input and
//   StickerTypes.FULL, wa-sticker-formatter never calls ffmpeg itself (its crop/videoToGif
//   helpers don't handle ffmpeg errors, so a bad file crashed the whole process).
// - addTextToImage: outlined text on a static image -> 512x512 png.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const FFMPEG_TIMEOUT_S = 60;
// animated stickers keep at most this many seconds of the video/GIF
const MAX_ANIMATED_SECONDS = 10;

const FONT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/fonts/Anton-Regular.ttf');

// Text layout. Font size is an ffmpeg expression on the image's own size (w, h), so the
// text fits the image, not the transparent padding added around it
const MAX_CHARS_PER_LINE = 20;
const CHAR_WIDTH_EM = 0.5; // rough average glyph width of Anton, in em
const LINE_HEIGHT_EM = 1.2;
const BASELINE_EM = 1.0; // distance from a line's top to its baseline (Anton is tall)
const BLOCK_MAX_HEIGHT = 0.3; // top/bottom blocks use at most 30% of the image height each
const MARGIN = 0.03; // of the image height
const BORDER_WIDTH = 3;

/**
 * @param {Buffer} buffer video or GIF
 * @param {string} ext input file extension (mp4, gif...), helps ffmpeg detect the format
 * @returns {Promise<Buffer>} square 512x512 animated webp
 */
export const toAnimatedWebp = (buffer, ext) => withTempDir(async (dir) => {
	const input = path.join(dir, `input.${ext}`);
	const output = path.join(dir, 'output.webp');
	await fs.writeFile(input, buffer);

	await runFfmpeg(input, output, [
		'-t', String(MAX_ANIMATED_SECONDS),
		'-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=512:512,setsar=1,fps=15",
		'-vcodec', 'libwebp',
		'-loop', '0',
		'-preset', 'default',
		'-an',
		'-vsync', '0',
	]);
	return fs.readFile(output);
});

/**
 * @param {Buffer} buffer static image
 * @param {string} ext input file extension (jpeg, png...)
 * @param {{ topText?: string, bottomText?: string, textColor?: string, outlineColor?: string }} options
 *   colors must already be validated (ffmpeg color names or #RRGGBB)
 * @returns {Promise<Buffer>} 512x512 png, image centered on a transparent background
 */
export const addTextToImage = (buffer, ext, { topText, bottomText, textColor = 'white', outlineColor = 'black' }) =>
	withTempDir(async (dir) => {
		const input = path.join(dir, `input.${ext}`);
		const output = path.join(dir, 'output.png');
		await fs.writeFile(input, buffer);

		// scale first so the text is drawn on the image, then pad to the square sticker canvas
		const filters = ['scale=512:512:force_original_aspect_ratio=decrease'];
		for (const [position, text] of [['top', topText], ['bottom', bottomText]]) {
			if (!text) continue;
			const lines = wrapText(text);
			const fontSize = fontSizeExpression(lines);
			for (const [i, line] of lines.entries()) {
				// text goes through a file so no user input ever needs ffmpeg escaping
				const textFile = path.join(dir, `${position}-${i}.txt`);
				await fs.writeFile(textFile, line);
				// position each line by its baseline (y - ascent), so accents/descenders in one
				// line don't shift it relative to the others
				const blockTop = position === 'top'
					? `h*${MARGIN}`
					: `h-h*${MARGIN}-${lines.length * LINE_HEIGHT_EM}*${fontSize}`;
				const y = `${blockTop}+${i * LINE_HEIGHT_EM + BASELINE_EM}*${fontSize}-ascent`;
				filters.push([
					`drawtext=fontfile='${FONT_FILE}'`,
					`textfile='${textFile}'`,
					'expansion=none',
					`fontsize='${fontSize}'`,
					`fontcolor=${textColor}`,
					`borderw=${BORDER_WIDTH}`,
					`bordercolor=${outlineColor}`,
					'x=(w-text_w)/2',
					`y='${y}'`,
				].join(':'));
			}
		}
		filters.push('format=rgba', 'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0');

		await runFfmpeg(input, output, ['-vf', filters.join(','), '-frames:v', '1']);
		return fs.readFile(output);
	});

// Greedy word wrap; a single word longer than the limit gets its own line
const wrapText = (text) => {
	const lines = [];
	for (const word of text.trim().split(/\s+/)) {
		const last = lines[lines.length - 1];
		if (last !== undefined && (last + ' ' + word).length <= MAX_CHARS_PER_LINE) {
			lines[lines.length - 1] = last + ' ' + word;
		} else {
			lines.push(word);
		}
	}
	return lines;
};

// Largest size where every line fits the width and the block fits BLOCK_MAX_HEIGHT, capped at h/6.
// Commas are escaped for the ffmpeg filtergraph
const fontSizeExpression = (lines) => {
	const longest = Math.max(...lines.map(line => line.length));
	const byHeight = (BLOCK_MAX_HEIGHT / (lines.length * LINE_HEIGHT_EM)).toFixed(4);
	const byWidth = (0.92 / (longest * CHAR_WIDTH_EM)).toFixed(4);
	return `(min(h/6\\,min(h*${byHeight}\\,w*${byWidth})))`;
};

const runFfmpeg = (input, output, outputOptions) => new Promise((resolve, reject) => {
	ffmpeg(input, { timeout: FFMPEG_TIMEOUT_S })
		.outputOptions(outputOptions)
		.on('error', (e, stdout, stderr) => reject(new Error(`ffmpeg: ${e.message}\n${stderr?.slice(-500) ?? ''}`)))
		.on('end', resolve)
		.save(output);
});

const withTempDir = async (fn) => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wpp-bot-'));
	try {
		return await fn(dir);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
};
