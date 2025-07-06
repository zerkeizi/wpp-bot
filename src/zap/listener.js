import { DisconnectReason } from '@whiskeysockets/baileys';
import commands from './commands/index.js';
import * as session from './../session.js';
import { updateClient } from '../socket.js';
import { createWhatsAppSocket } from './connect.js';

export const attachSocketListeners = (sock, saveCreds) => {
	sock.ev.process(async (events) => {
		if (events['connection.update']) {
			const update = events['connection.update'];
			const { connection, lastDisconnect, qr, isOnline, isNewLogin } = update;

			updateClient({ connection, qr, isOnline, isNewLogin });

			if (connection === 'close') {
				if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
					console.log('Trying to reconnect...');
					await createWhatsAppSocket();

					// TODO: reconnect();
				} else {
					console.log(this);
					// session.kill();
				}
			}
		}

		if (events['creds.update']) {
			await saveCreds();
		}

		if (events['messages.upsert']) {
			await commands.stickerFromMedia(sock, events['messages.upsert']);
		}
	});
};
