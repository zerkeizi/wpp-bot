// @ts-nocheck
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { createSticker, StickerTypes } from 'wa-sticker-formatter';

const messageResolver = async (sock, m) => {
  if (m.type == "notify") {
    
    const messageData = m.messages[0]

    // ignore if it is not image or doesnt have /pedido as caption
    if (Object.keys(messageData.message)[0] != 'imageMessage' || messageData.message.imageMessage.caption != '/pedido baianinho') {
      return
    }

    const mediaData = await getMedia(messageData)
    const stickerOptions = {
      pack: 'só curtição', // The pack name
      author: 'baianinho', // The author name
      type: StickerTypes.FULL, // The sticker type
      quality: 50, // The quality of the output file
    }
    const generateSticker = await createSticker(mediaData, stickerOptions)
		console.log(JSON.stringify(m, undefined, 2))
		console.log('replying to', m.messages[0].key.remoteJid)
		await sock.sendMessage(
      m.messages[0].key.remoteJid, { 
        sticker: generateSticker
      }
    )
  }

}

const getMedia = async (msg) => {
  const messageType = Object.keys(msg?.message)[0]
  const stream = await downloadContentFromMessage(msg.message[messageType], messageType.replace('Message', ''))
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

export default messageResolver