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
		// a failure on one message must not drop the rest of the batch
		try {
			const request = findStickerRequest(messageData.message);
			if (!request) continue;

			const sticker = await mediaToSticker(request.media, request.type);
			if (sticker) {
				await sock.sendMessage(
					messageData.key.remoteJid, {
					sticker
				});
			}
		} catch (e) {
			console.error('Erro ao processar mensagem', messageData.key?.id, e);
		}
	}
};

/**
 * Returns { media, type } when the message asks for a sticker, otherwise null. Accepts:
 * - an image/video whose caption is a command
 * - a text reply with a command, quoting an image/video
 */
const findStickerRequest = (message) => {
	// unwraps ephemeral (disappearing messages) and view once wrappers
	const content = normalizeMessageContent(message);
	// no content: message stubs or messages that failed to decrypt
	if (!content) return null;
	// skips extra keys like senderKeyDistributionMessage / messageContextInfo
	const type = getContentType(content);

	// se for imagem com o comando correto inserido como legenda
	if (MESSAGE_TYPES.includes(type)) {
		return isCommand(content[type].caption) ? { media: content[type], type } : null;
	}

	// resposta com o comando a uma imagem/vídeo
	const text = type === 'conversation' ? content.conversation : content.extendedTextMessage?.text;
	if (!isCommand(text)) return null;

	const quoted = normalizeMessageContent(content.extendedTextMessage?.contextInfo?.quotedMessage);
	const quotedType = getContentType(quoted);
	return MESSAGE_TYPES.includes(quotedType) ? { media: quoted[quotedType], type: quotedType } : null;
};

// Ignores case, extra whitespace and @mentions
const normalizeCommand = (text) => (text || '')
	.replace(/@\S+/g, ' ')
	.replace(/\s+/g, ' ')
	.trim()
	.toLowerCase();

const isCommand = (text) => COMMAND_NAMES.includes(normalizeCommand(text));

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
