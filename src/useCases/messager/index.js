// @ts-nocheck
import { downloadContentFromMessage, getContentType, normalizeMessageContent } from '@whiskeysockets/baileys';
import { parseCommand, getTextOptions, textUsageError, USAGE } from './commandParser.js';
import { searchImages, downloadFirstImage } from '../search/bingImages.js';
import { buildSticker } from '../sticker/index.js';
import fs from 'fs';

const MESSAGE_TYPES = ['imageMessage', 'videoMessage'];

// Errors are answered with this pre-rendered sticker (pnpm stickers:build). Sent byte for byte,
// so WhatsApp always sees the same sticker instead of a new one per error
const ERROR_STICKER = fs.readFileSync(new URL('../../../assets/stickers/nau_cunsigui.webp', import.meta.url));

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
			.catch(e => {
				console.error('Erro ao responder comando', messageData.key?.id, e);
				replyError(sock, messageData, 'Não consegui criar o sticker.').catch(() => {});
			});
	}
};

const NO_MEDIA_HINT = 'Envie o comando na legenda de uma imagem/vídeo ou respondendo a um(a), ou busque uma imagem com /pedido -s <termos>. Use /sticker -h para ver as opções.';

const handleCommand = async (sock, messageData, { command, media }) => {
	if (command.error) return replyError(sock, messageData, command.error);
	const { flags } = command;
	if (flags.help) return replyText(sock, messageData, USAGE);

	const mediaKind = media ? (media.type === 'videoMessage' ? 'video' : 'image') : null;
	const textError = textUsageError(flags, mediaKind);
	if (textError) return replyError(sock, messageData, textError);
	// -s searches even when there is media in the message
	if (flags.search) return replyWithSearchedSticker(sock, messageData, command.positionals.join(' '));
	if (!media) return replyError(sock, messageData, NO_MEDIA_HINT);

	const sticker = await buildSticker({
		buffer: await getMedia(media.media, media.type),
		kind: mediaKind,
		ext: mediaKind === 'video' ? 'mp4' : mimeToExt(media.media.mimetype),
		text: getTextOptions(flags),
	});
	await sendSticker(sock, messageData, sticker);
};

// image/jpeg -> jpeg; only used to help ffmpeg detect the input format
const mimeToExt = (mime) => mime?.split('/')[1]?.split(';')[0] || 'jpg';

const replyWithSearchedSticker = async (sock, messageData, query) => {
	if (!query) return replyError(sock, messageData, 'Informe o que buscar, ex: /pedido -s gato rindo');

	let image;
	try {
		image = await downloadFirstImage(await searchImages(query));
	} catch (e) {
		console.error('Erro na busca de imagens', query, e);
		return replyError(sock, messageData, 'A busca de imagens está indisponível no momento.');
	}
	if (!image) return replyError(sock, messageData, `Nenhuma imagem encontrada para "${query}".`);

	const sticker = await buildSticker({
		buffer: image.buffer,
		kind: image.mime === 'image/gif' ? 'gif' : 'image',
		ext: mimeToExt(image.mime),
	});
	await sendSticker(sock, messageData, sticker);
};

const replyText = (sock, messageData, text) =>
	sock.sendMessage(messageData.key.remoteJid, { text }, { quoted: messageData });

// The sticker can't say what went wrong, so the reason only goes to the log
const replyError = (sock, messageData, reason) => {
	console.warn('Comando não atendido', messageData.key?.id, reason);
	return sock.sendMessage(messageData.key.remoteJid, { sticker: ERROR_STICKER }, { quoted: messageData });
};

const sendSticker = (sock, messageData, sticker) =>
	sock.sendMessage(messageData.key.remoteJid, { sticker });

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

const getMedia = async (media, type) => {
	const stream = await downloadContentFromMessage(media, type.replace('Message', ''));
	let buffer = Buffer.from([]);
	for await (const chunk of stream) {
		buffer = Buffer.concat([buffer, chunk]);
	}
	return buffer;
};

export default messageResolver;
