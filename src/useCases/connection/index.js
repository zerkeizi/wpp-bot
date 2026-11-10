// @ts-nocheck
import makeWASocket, {
	fetchLatestBaileysVersion,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
	DisconnectReason
} from '@whiskeysockets/baileys';
import P from 'pino'
import messageResolver from '../messager/index.js'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { emitter } from '../../server.js'

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
// 'trace' logs every signal key operation (huge in large groups); set WA_LOG_LEVEL=trace to debug Baileys
logger.level = process.env.WA_LOG_LEVEL || 'info'

// Only one WhatsApp socket may exist at a time: two sockets with the same credentials
// make WhatsApp disconnect one of them ("connection replaced")
let currentSock = null
let connectionState = 'close'
let pendingConnection = null

// start a connection (no-op if one is already open or being opened)
export const connectToWhatsApp = () => {
	if (pendingConnection) return pendingConnection
	if (currentSock && connectionState !== 'close') {
		console.log(`WhatsApp connection already ${connectionState}, not reconnecting`)
		return Promise.resolve()
	}

	pendingConnection = createSocket().finally(() => {
		pendingConnection = null
	})
	return pendingConnection
}

// log out: unlink this device from the WhatsApp account, close the socket and delete the session
export const logoutFromWhatsApp = async () => {
	if (pendingConnection) await pendingConnection.catch(() => {})

	const sock = currentSock
	// detach first, so the socket's own 'close' event is ignored and doesn't trigger a reconnect
	currentSock = null
	connectionState = 'close'

	if (sock) {
		try {
			await sock.logout()
		} catch (e) {
			// not connected (e.g. still waiting for the QR scan): just close it
			console.warn('Logout request failed, closing socket', e?.message)
			sock.end(undefined)
		}
	}

	emitter.killWPSession()
	emitter.updateClient({ connection: 'close' })
}

const createSocket = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('sess_auth_info')

	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)
	
	const sock = makeWASocket({
		version,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger)
		},
		shouldSyncHistoryMessage: false,
		syncFullHistory: false,
	})
	currentSock = sock
	connectionState = 'connecting'

  // LISTENER
  sock.ev.process(
		// events is a map for event name => event data
		async (events) => {
			// ignore late events from a socket that has been replaced
			if (sock !== currentSock) return

			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if (events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect, qr, isOnline, isNewLogin } = update
				if (connection) {
					connectionState = connection
					console.log('WhatsApp connection:', connection)
				}
				emitter.updateClient({ connection, qr, isOnline, isNewLogin })

				if (connection === 'close') {
					const statusCode = lastDisconnect?.error?.output?.statusCode
					if (statusCode === DisconnectReason.loggedOut) {
						currentSock = null
						emitter.killWPSession()
					} else if (statusCode === DisconnectReason.connectionReplaced) {
						// another instance (e.g. a second server running with the same session) took over;
						// reconnecting here would make both kick each other forever
						console.warn('Connection replaced by another session, not reconnecting')
					} else {
						connectToWhatsApp()
					}
				}
			}

			if (events['creds.update']) {
        await saveCreds()
      }

      // MESSAGES (sticker generation runs in the background, see messager)
      if (events['messages.upsert']) {
        messageResolver(sock, events['messages.upsert'])
      }
      
		}
	)

}
