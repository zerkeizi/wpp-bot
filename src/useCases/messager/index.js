// @ts-nocheck
import { downloadContentFromMessage,  } from '@whiskeysockets/baileys';
import { createSticker, StickerTypes } from 'wa-sticker-formatter';
import fs from 'fs'

const COMMAND_NAMES = ["/pedido baianinho", "/pedido", "/sticker"]

const MESSAGE_TYPES = ['imageMessage', 'videoMessage']

const messageResolver = async (sock, m) => {
  console.log('@@@@ Mensagem recebida @@@@')
  console.log(m)
  console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@')
  if (m.type == "notify") {
    
    const messageData = m.messages[0]

    const messageType = MESSAGE_TYPES.find(t => t === Object.keys(messageData.message)[0])
    
    // se for imagem com o comando correto inserido como legenda
    if (messageType && COMMAND_NAME.includes(messageData.message[messageType].caption)) {
      await replyStickerFromImage(sock, messageData, messageType)
    } 

    // else if (Object.keys(messageData.message)[0] == 'videoMessage' && messageData.message.imageMessage.caption == COMMAND_NAME) {
    //   await replyStickerFromImage(sock, m)
    // }
  }
}

const replyStickerFromImage = async (sock, messageData, messageType) => {
  const mediaData = await getMedia(messageData, messageType)
  const stickerOptions = {
    pack: 'só curtição', // pack name
    author: 'baianinho', // author name
    type: StickerTypes.FULL, // FULL | CROPPED
    quality: 50, // The quality of the output file
  }
  
  let content
  // TODO VIDEO MEDIA TO STICKER 
  if (messageType != 'videoMessage') {
    // let randomName = (Math.random() + 1).toString(36).substring(7)
    // let fileName = `Media/stickers/${randomName}.mp4`
    // await fs.writeFile(fileName, mediaData, (err) => {
    //   throw Error("Erro: ", e)
    // })

    // content = fileName
  //   return
  // } else {
    content = await createSticker(mediaData, stickerOptions)

  }
  // console.log(JSON.stringify(messageData, undefined, 2))
  // console.log('replying to', m.messages[0].key.remoteJid)
  if (content) {
    await sock.sendMessage(
      messageData.key.remoteJid, { 
        sticker: content
      }
    )
  }
}

// const replyStickerFromVideo = async (sock, m) => {

// }

const getMedia = async (data, type) => {
  const stream = await downloadContentFromMessage(data?.message[type], type.replace('Message', ''))
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

export default messageResolver