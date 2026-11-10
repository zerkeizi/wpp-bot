// @ts-nocheck
import { downloadContentFromMessage, getContentType, normalizeMessageContent } from '@whiskeysockets/baileys';
import { createSticker, StickerTypes } from 'wa-sticker-formatter';
import { parseCommand, USAGE } from './commandParser.js';

const MESSAGE_TYPES = ['imageMessage', 'videoMessage'];

const messageResolver = async (sock, m) => {
	if (m.type != "notify") return;

	// an upsert can carry several messages at once (common in busy groups)
	for (const messageData of m.messages) {
		// a failure on one message must not drop the rest of the batch
		let request;
		try {
			request = findCommand(messageData.message);
		} catch (e) {
			console.error('Erro ao processar mensagem', messageData.key?.id, e);
			continue;
		}
		if (!request) continue;

		// not awaited: a slow conversion must not hold up later messages/events
		runLimited(() => handleCommand(sock, messageData, request))
			.catch(e => console.error('Erro ao responder comando', messageData.key?.id, e));
	}
};

const NO_MEDIA_HINT = 'Envie o comando na legenda de uma imagem/vídeo ou respondendo a um(a). Use /sticker -h para ver as opções.';

const handleCommand = async (sock, messageData, { command, media }) => {
	if (command.error) return replyText(sock, messageData, command.error);
	if (command.flags.help) return replyText(sock, messageData, USAGE);
	if (!media) return replyText(sock, messageData, NO_MEDIA_HINT);

	await replyWithSticker(sock, messageData, media);
};

const replyText = (sock, messageData, text) =>
	sock.sendMessage(messageData.key.remoteJid, { text }, { quoted: messageData });

const replyWithSticker = async (sock, messageData, request) => {
	const sticker = await mediaToSticker(request.media, request.type);
	if (sticker) {
		await sock.sendMessage(
			messageData.key.remoteJid, {
			sticker
		});
	}
};

// Sticker conversion (especially ffmpeg for videos) is CPU heavy: cap how many run at once
const MAX_CONCURRENT_STICKERS = 2;
let activeJobs = 0;
const pendingJobs = [];

const runLimited = (job) => new Promise((resolve, reject) => {
	pendingJobs.push({ job, resolve, reject });
	runNextJob();
});

const runNextJob = () => {
	if (activeJobs >= MAX_CONCURRENT_STICKERS || pendingJobs.length === 0) return;
	const { job, resolve, reject } = pendingJobs.shift();
	activeJobs++;
	job()
		.then(resolve, reject)
		.finally(() => {
			activeJobs--;
			runNextJob();
		});
};

/**
 * Returns { command, media } when the message is a bot command, otherwise null.
 * - command: result of parseCommand (flags/positionals or error)
 * - media: { media, type } of the image/video in the message, or in the quoted message
 *   when it's a text reply; null when there is none
 */
const findCommand = (message) => {
	// unwraps ephemeral (disappearing messages) and view once wrappers
	const content = normalizeMessageContent(message);
	// no content: message stubs or messages that failed to decrypt
	if (!content) return null;
	// skips extra keys like senderKeyDistributionMessage / messageContextInfo
	const type = getContentType(content);

	let text;
	let media = null;
	if (MESSAGE_TYPES.includes(type)) {
		// imagem/vídeo com o comando na legenda
		text = content[type].caption;
		media = { media: content[type], type };
	} else {
		// texto com o comando, possivelmente respondendo a uma imagem/vídeo
		text = type === 'conversation' ? content.conversation : content.extendedTextMessage?.text;
		const quoted = normalizeMessageContent(content.extendedTextMessage?.contextInfo?.quotedMessage);
		const quotedType = getContentType(quoted);
		if (MESSAGE_TYPES.includes(quotedType)) {
			media = { media: quoted[quotedType], type: quotedType };
		}
	}

	const command = parseCommand(text);
	return command ? { command, media } : null;
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
