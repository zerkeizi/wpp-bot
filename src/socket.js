// @ts-nocheck
import { existSession } from './session.js';
import qrcode from 'qrcode';

let clientSocket = null;
let lastestQRCode = undefined;

export const setupSocket = (io) => {
	io.on('connection', (socket) => {
		clientSocket = socket;
		console.log('User connected');

		socket.on('qr.first', () => {
			const payload = {
				qr: lastestQRCode,
				connection: existSession() ? 'open' : 'close'
			};
			updateClient(payload);
		});

		socket.on('disconnect', () => {
			console.log('User disconnected');
		});
	});
};

export const updateClient = (content) => {
	lastestQRCode = content?.qr;

	if (clientSocket) {
		qrcode.toDataURL(lastestQRCode || '', (err, url) => {
			content.qr = url ?? undefined;
			clientSocket.emit('qr.update', content);
		});
	}
};
