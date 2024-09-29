// @ts-nocheck
import makeWASocket, {
	fetchLatestBaileysVersion,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
	DisconnectReason
} from '@whiskeysockets/baileys';
import P from 'pino'
import messageResolver from './../messager/index.js'

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

// start a connection
export const connectToWhatsApp = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')

	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
	
	const sock = makeWASocket.default({
		version,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger)
		},
		shouldSyncHistoryMessage: false,
		syncFullHistory: false,
	})

  // LISTENER
  sock.ev.process(
		// events is a map for event name => event data
		async (events) => {
			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if (events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect } = update
				if (connection === 'close') {
					// reconnect if not logged out
					if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
						connectToWhatsApp()
					} else {
						console.log('Connection closed. You are logged out.')
					}
				}
			}

			if (events['creds.update']) {
        await saveCreds()
      }

      // MESSAGES
      if (events['messages.upsert']) {
        await messageResolver(sock, events['messages.upsert'])
      }
      
		}
	)
}
