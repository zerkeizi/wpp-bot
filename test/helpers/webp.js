// Minimal WebP inspector for tests (avoids depending on sharp directly).
// Stickers from wa-sticker-formatter always have a VP8X chunk, because they carry EXIF metadata.

/**
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, animated: boolean, frames: number, hasExif: boolean }}
 */
export const inspectWebp = (buffer) => {
	if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
		throw new Error('Not a WebP file');
	}

	let info = null;
	let frames = 0;
	let hasExif = false;
	// chunks: fourcc (4 bytes) + size (uint32 LE) + data, padded to an even length
	for (let offset = 12; offset + 8 <= buffer.length;) {
		const fourcc = buffer.toString('ascii', offset, offset + 4);
		const size = buffer.readUInt32LE(offset + 4);
		const data = offset + 8;
		if (fourcc === 'VP8X') {
			info = {
				animated: (buffer[data] & 0x02) !== 0,
				width: buffer.readUIntLE(data + 4, 3) + 1,
				height: buffer.readUIntLE(data + 7, 3) + 1,
			};
		} else if (fourcc === 'ANMF') {
			frames++;
		} else if (fourcc === 'EXIF') {
			hasExif = true;
		}
		offset = data + size + (size % 2);
	}

	if (!info) throw new Error('WebP without VP8X chunk');
	return { ...info, frames: info.animated ? frames : 1, hasExif };
};
