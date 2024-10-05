// @ts-nocheck
import makeWASocket, {
	fetchLatestBaileysVersion,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
	DisconnectReason
} from '@whiskeysockets/baileys';
import P from 'pino'
import messageResolver from './../messager/index.js'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { killSession } from './killSession.js';
import { emitter } from './../../server.js'
export let socketState = {
	user: null,
	qr: ''
}

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

// start a connection
export const connectToWhatsApp = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('sess_auth_info')

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
			console.log('@@@@@@@@@@@@@@@@@@')
			console.log('Triggering event', events)
			console.log('@@@@@@@@@@@@@@@@@@')
			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if (events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect, qr, isOnline } = update
				if (!isOnline && qr) {
					emitter.updateQR(qr)
				}
				socketState.qr = qr

				if (connection === 'close') {
					// reconnect if not logged out
					if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
						connectToWhatsApp()
					} else {
						killSession()
						socketState = { user: null, qr: ''}
					}
				}
			}

			if (events['creds.update']) {
				socketState.user = sock?.user
        await saveCreds()
      }

      // MESSAGES
      if (events['messages.upsert']) {
        await messageResolver(sock, events['messages.upsert'])
      }
      
		}
	)

}
