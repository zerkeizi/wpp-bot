// @ts-nocheck
import express from 'express';
import http from 'http'
import { connectToWhatsApp, socketState } from './useCases/connection/index.js';
import path from 'path';
import { fileURLToPath } from 'url'
import qrcode from 'qrcode'
import { killSession } from './useCases/connection/killSession.js';
import { Server } from "socket.io";

// Init server config
const PORT = process.env.PORT || 8080;
const app = express();
const server = http.createServer(app);
// app.use(express.json());

const io = new Server(server, {
  // options
  cors: { origin: "*" }
});

// Connect websocket lib instance
await connectToWhatsApp()

// Client routes
const __root = path.dirname(fileURLToPath(import.meta.url))
app.get("/", async (req, res) => {
  
  res.sendFile('index.html', { root: path.join(__root, 'client') })
})

app.post("/kill", async (req, res) => {
  console.log('hit me')
  killSession()
})


let globalSocket = null
// Establish WS connections
io.on('connection', (socket) => {
  globalSocket = socket
  console.log('user connected');
 
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
})

// Server running
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

const updateQR = (content) => {
  if (globalSocket) {
    qrcode.toDataURL(content || '', (err, url) => { 
      if (url) {
        globalSocket.emit('update.qr', url)
      }
    })
  }
}

export const emitter = {
  updateQR
}