// @ts-nocheck
import { downloadContentFromMessage, getContentType, normalizeMessageContent } from '@whiskeysockets/baileys';
import { createSticker, StickerTypes, Sticker } from 'wa-sticker-formatter';
import fs from 'fs';

const COMMAND_NAMES = ["/pedido baianinho", "/pedido", "/sticker"];

const MESSAGE_TYPES = ['imageMessage', 'videoMessage'];

const messageResolver = async (sock, m) => {
	if (m.type != "notify") return;

	// an upsert can carry several messages at once (common in busy groups)
	for (const messageData of m.messages) {
		// unwraps ephemeral (disappearing messages) and view once wrappers
		const content = normalizeMessageContent(messageData.message);
		// skips extra keys like senderKeyDistributionMessage / messageContextInfo
		const messageType = MESSAGE_TYPES.find(t => t === getContentType(content));

		// se for imagem com o comando correto inserido como legenda
		if (COMMAND_NAMES.includes(content[messageType]?.caption)) {

			const sticker = await mediaToSticker(content[messageType], messageType);
			if (sticker) {
				await sock.sendMessage(
					messageData.key.remoteJid, {
					sticker
				});
			}
		}
	}
};

const mediaToSticker = async (media, messageType) => {
	let mediaData = null;
	try {
		mediaData = await getMedia(media, messageType);
	} catch (e) {
		console.error('Erro na getMedia', e);
	}

	const options = getOptions(messageType);

	try {
		return await createSticker(mediaData, options);
	} catch (e) {
		console.error('Erro na createSticker', e);
		return;
	}
};

const getMedia = async (media, type) => {
	const stream = await downloadContentFromMessage(media, type.replace('Message', ''));
	let buffer = Buffer.from([]);
	for await (const chunk of stream) {
		buffer = Buffer.concat([buffer, chunk]);
	}
	return buffer;
};

/**
 * 
 * @param {string} messageType 
 * @returns {Object} options for createSticker second parameter
 * TODO: after TypeScript implementation, change ternary condition to use types
 */
const getOptions = (messageType) => {
	const generalOptions = {
		pack: 'só curtição', // pack name
		author: 'baianinho', // author name
	};
	const staticOptions = {
		...generalOptions,
		type: StickerTypes.FULL, // FULL | CROPPED
		quality: 50, // The quality of the output file
	};
	const animatedOptions = {
		...generalOptions,
		type: StickerTypes.CROPPED, // FULL | CROPPED
		quality: 30, // The quality of the output file
	};

	return messageType == 'imageMessage' ? staticOptions : animatedOptions;
};
export default messageResolver;
