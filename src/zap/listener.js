// @ts-nocheck
import { DisconnectReason } from '@whiskeysockets/baileys';
import commands from './commands/index.js';
import { emitter } from './../server.js';

// import { connectToWhatsApp } from './connect.js'; // optional, for reconnecting

export const attachSocketListeners = (sock, saveCreds) => {
	sock.ev.process(async (events) => {
		if (events['connection.update']) {
			const update = events['connection.update'];
			const { connection, lastDisconnect, qr, isOnline, isNewLogin } = update;
			emitter.updateClient({ connection, qr, isOnline, isNewLogin });

			if (connection === 'close') {
				if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
					console.log('Trying to reconnect...');
					// await connectToWhatsApp();
					emitter.reconnect();
				} else {
					emitter.killWPSession();
				}
			}
		}

		if (events['creds.update']) {
			await saveCreds();
		}

		if (events['messages.upsert']) {
			await stickerFromMedia(sock, events['messages.upsert']);
		}
	});
};
