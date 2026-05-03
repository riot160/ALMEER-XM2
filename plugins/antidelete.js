import { jidDecode } from '@whiskeysockets/baileys';
import { config } from '../config.js';

export const commands = {};

// This plugin exports event handlers for index.js to use
export const events = {
  messagesUpdate: (updates, { sock }) => {
    for (const { key, update } of updates) {
      if (update.status === 4 /* deleted */) { // Path 2: message_delete equivalent
        detectDeleted(sock, key);
      }
    }
  },
  messageRevoke: ({ sock, msg }) => { // Path 1: REVOKE stub (use update)
    detectDeleted(sock, msg.key);
  }
};

async function detectDeleted(sock, key) {
  const msg = await sock.loadMessage(key.remoteJid, key.id);
  if (!msg) return;
  const sender = jidDecode(key.participant)?.user || 'unknown';
  const from = key.remoteJid;
  const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[Media]';
  const isGroup = from.endsWith('@g.us');
  const text = `⚠️ DELETED MESSAGE
From: ${sender}
In: ${isGroup ? 'Group' : 'DM'}

${content}`;
  const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
  sock.sendMessage(ownerJid, { text });
}
