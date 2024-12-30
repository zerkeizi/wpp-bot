// @ts-nocheck
import express from 'express';
import http from 'http'
import { connectToWhatsApp } from './useCases/connection/index.js';
import path from 'path';
import { fileURLToPath } from 'url'
import qrcode from 'qrcode'
import { Server } from "socket.io";
import fs from 'fs'

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Init server config
const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
app.use(express.static('public'))


const io = new Server(server, {
  // options
  cors: { origin: "*" }
});

// Client routes
const __root = path.dirname(fileURLToPath(import.meta.url))
app.get("/", async (req, res) => {
  
  res.sendFile('index.html', { root: path.join(__root, 'client') })
})

app.post("/kill", async (req, res) => {
  killWPSession()
})

app.post("/reconnect", async (req, res) => {
  // Connect websocket lib instance
  await connectToWhatsApp()
})

// GLOBALS
let lastestQRCode = undefined
let clientSocket = null

// Establish WS connections
io.on('connection', (socket) => {
  clientSocket = socket
  console.log('user connected');

  // Evento de abertura do client
  socket.on('qr.first', () => {
    const clientFirstRenderValues = {}
    clientFirstRenderValues.qr = lastestQRCode
    if (!existSession()) {
      console.log('there is no session currently.')
      clientFirstRenderValues.connection = "close"
    }
    updateClient(clientFirstRenderValues)
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

})

// Server running
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

const updateClient = (content) => {
  // update global variables
  lastestQRCode = content?.qr

  if (clientSocket) {
    qrcode.toDataURL(lastestQRCode || '', (err, url) => { 
      content.qr = url ?? undefined 
      clientSocket.emit('qr.update', content)
    })
  }
}

// Start autozap instance
await connectToWhatsApp()

// # UTILS
const __authCredDir = path.relative(process.cwd(), "sess_auth_info");

// Check if there is an existent session directory
const existSession = () => {
  return fs.existsSync(__authCredDir)
}

// Kill session by deleting its directory
const killWPSession = () => {
  lastestQRCode = undefined
  fs.rmSync(__authCredDir, { recursive: true, force: true });
  console.log('Connection closed. You are logged out.')
}

export const emitter = {
  updateClient,
  killWPSession
}

