// @ts-nocheck
import path from 'path';
import { createWhatsAppSocket } from './zap/connect.js';
import { emitter } from './server.js';

export const registerRoutes = (app, rootDir) => {
	app.get('/', (req, res) => {
		res.sendFile('index.html', { root: path.join(rootDir, 'client') });
	});

	app.post('/kill', (req, res) => {
		emitter.killWPSession();
		res.status(200).send({ success: true, message: 'Session killed' });
	});

	app.post('/reconnect', async (req, res) => {
		await createWhatsAppSocket();
		res.status(200).send({ success: true, message: 'Reconnected' });
	});
};
