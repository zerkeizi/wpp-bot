import path from 'path';
import { createWhatsAppSocket } from './zap/connect.js';
import * as session from './session.js';
// import { emitter } from './server.js';

export const registerRoutes = (app, rootDir) => {
	app.get('/', (req, res) => {
		res.sendFile('index.html', { root: path.join(rootDir, 'client') });
	});

	app.post('/kill', (req, res) => {
		session.kill();
		res.status(200).send({ success: true, message: 'Session killed' });
	});

	app.post('/reconnect', async (req, res) => {
		await createWhatsAppSocket();
		res.status(200).send({ success: true, message: 'Reconnected' });
	});
};
