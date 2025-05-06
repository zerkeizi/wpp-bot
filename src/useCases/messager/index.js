// @ts-nocheck
import { downloadContentFromMessage, extractMessageContent, downloadMediaMessage } from '@whiskeysockets/baileys';
import { createSticker, StickerTypes, Sticker } from 'wa-sticker-formatter';
import fs from 'fs'

const COMMAND_NAMES = ["/pedido baianinho", "/pedido", "/sticker"]

const MESSAGE_TYPES = ['imageMessage', 'videoMessage']

const messageResolver = async (sock, m) => {
  if (m.type == "notify") {

    const messageData = m.messages[0]
    const messageType = MESSAGE_TYPES.find(t => t === Object.keys(messageData.message)[0])

    // se for imagem com o comando correto inserido como legenda
    if (COMMAND_NAMES.includes(messageData.message[messageType]?.caption)) {

      const sticker = await mediaToSticker(messageData, messageType)
      if (sticker) {
        await sock.sendMessage(
          messageData.key.remoteJid, {
          sticker
        })
      }
    }
  }
}

const mediaToSticker = async (messageData, messageType) => {
  let mediaData = null
  try {
    mediaData = await getMedia(messageData, messageType)
  } catch (e) {
    console.error('Erro na getMedia', e)
  }

  const options = getOptions(messageType)

  try {
    return await createSticker(mediaData, options)
  } catch (e) {
    console.error('Erro na createSticker', e)
    return 
  }
}

const getMedia = async (data, type) => {
  const stream = await downloadContentFromMessage(data?.message[type], type.replace('Message', ''))
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

/**
 * 
 * @param {string} messageType 
 * @returns {Object} options for createSticker second parameter
 * TODO: after TypeScript implementation, change ternary condition to use types
 */
const getOptions = (messageType) => {  
  const generalOptions = {
    pack: 'maizena, berbigão e javascript', // pack name
    author: '@nisquas', // author name
  }
  const staticOptions = {
    ...generalOptions,
    type: StickerTypes.FULL, // FULL | CROPPED
    quality: 50, // The quality of the output file
  }
  const animatedOptions = {
    ...generalOptions,
    type: StickerTypes.CROPPED, // FULL | CROPPED
    quality: 30, // The quality of the output file
  }

  return messageType == 'imageMessage' ? staticOptions : animatedOptions;
}
export default messageResolver
