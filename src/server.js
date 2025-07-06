import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import { createWhatsAppSocket } from './zap/connect.js';
import { registerRoutes } from './routes.js';
import { setupSocket } from './socket.js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

// Init paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// App setup
const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: '*' },
});

// Middleware
app.use(express.static('public'));

// Routes
registerRoutes(app, __dirname);

// Sockets
setupSocket(io);

// FFmpeg setup
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Start server
server.listen(PORT, () => {
	console.log(`Servidor rodando na porta ${PORT}`);
});

// Start WhatsApp connection
await createWhatsAppSocket();

// Export emitter for use across modules
// export const emitter = {
// 	updateClient,
// 	killWPSession,
// };