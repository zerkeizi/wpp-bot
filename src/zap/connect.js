// @ts-nocheck
import makeWASocket, {
	fetchLatestBaileysVersion,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import P from 'pino';
import { attachSocketListeners } from './listener.js';

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'));
logger.level = 'trace';

export const createWhatsAppSocket = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('sess_auth_info');
	const { version, isLatest } = await fetchLatestBaileysVersion();
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

	const sock = makeWASocket.default({
		version,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger)
		},
		shouldSyncHistoryMessage: false,
		syncFullHistory: false,
		logger
	});

	attachSocketListeners(sock, saveCreds); // 🔗 Link listeners here

	return { sock, saveCreds };
};
