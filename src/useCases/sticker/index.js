// @ts-nocheck
// Turns media bytes into a WhatsApp sticker. No WhatsApp involved: callers download the
// media and send the result, so this can be used directly from tests and scripts.
import { createSticker, StickerTypes } from 'wa-sticker-formatter';
import { toAnimatedWebp, addTextToImage } from '../media/index.js';

const STICKER_METADATA = {
	pack: 'só curtição', // pack name
	author: 'baianinho', // author name
};

/**
 * @param {Object} params
 * @param {Buffer} params.buffer media bytes
 * @param {'image' | 'video' | 'gif'} params.kind video/gif become animated stickers
 * @param {string} params.ext file extension of the media (jpeg, png, mp4, gif...), helps ffmpeg
 * @param {{ topText?: string, bottomText?: string, textColor?: string, outlineColor?: string }} [params.text]
 *   outlined text, only supported for images
 * @returns {Promise<Buffer>} webp sticker
 */
export const buildSticker = async ({ buffer, kind, ext, text }) => {
	if (kind === 'video' || kind === 'gif') {
		if (text) throw new Error('Text is only supported on images');
		// square animated webp + StickerTypes.FULL: wa-sticker-formatter never runs its own
		// ffmpeg (crop/videoToGif), which crashes the process on bad input
		return createSticker(await toAnimatedWebp(buffer, ext), getOptions(true));
	}

	const image = text ? await addTextToImage(buffer, ext, text) : buffer;
	return createSticker(image, getOptions(false));
};

/**
 * @param {boolean} isAnimated
 * @returns {Object} options for createSticker second parameter
 */
const getOptions = (isAnimated) => ({
	...STICKER_METADATA,
	// FULL for both: images keep their aspect ratio (transparent padding), animated input is
	// already square. CROPPED would make wa-sticker-formatter run ffmpeg itself (see above)
	type: StickerTypes.FULL,
	quality: isAnimated ? 30 : 50, // The quality of the output file
});
