import { config } from '../config.js';

export const commands = {};

if (!config.autostatus) return;

export const events = {
  messagesUpsert: ({ messages, sock }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast' && msg.type === 'append') {
        const participant = msg.key.participant;
        const emojis = ['❤️', '🔥', '😍', '💯', '👑'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        sock.sendMessage(participant, { react: { text: emoji, key: msg.key } });
      }
    }
  }
};
