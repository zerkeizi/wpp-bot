import express from 'express';
import { connectToWhatsApp, socketState } from './useCases/connection/index.js';
import path from 'path';
import { fileURLToPath } from 'url'
import qrcode from 'qrcode'
import { killSession } from './useCases/connection/killSession.js';

// Init express
const app = express();
app.use(express.json());

// Port configuration
const PORT = process.env.PORT || 3000;

// Connect websocket lib instance
await connectToWhatsApp()

// Set EJS as the view engine
app.set('view engine', 'ejs')
// Set views directory
const __root = path.dirname(fileURLToPath(import.meta.url))
app.set('views', path.join(__root, 'views'));

// Client routes
app.get("/", async (req, res) => {
  qrcode.toDataURL(socketState.qr || '', (err, url) => { 
    const data = {
      isConnected: !!socketState.user,
      qrCode: url
    }
    res.render('index', data)
  })
})

app.post("/kill", async (req, res) => {
  console.log('hit me')
  killSession()
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});