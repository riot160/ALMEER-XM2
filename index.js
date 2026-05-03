import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { loadPlugins, commands } from './lib/loader.js';
import { isOwner } from './lib/utils.js';
import { startServer } from './server.js';

export let sock;
let retryCount = 0;

const SESSION_DIR = './session';

// SESSION_ID restore
if (process.env.SESSION_ID && !fs.existsSync('./session/creds.json')) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.writeFileSync('./session/creds.json', Buffer.from(process.env.SESSION_ID, 'base64'));
  log.info('Session restored');
}

export const getSock = () => sock;
startServer();

async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['ALMEER MD', 'Safari', '1.0.0'],
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Load plugins ONCE
    await loadPlugins();

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'open') {
        log.ok('✅ ALMEER MD Connected');
        retryCount = 0;
        return;
      }
      
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        log.warn(`Disconnected: ${code}`);
        
        if (code === DisconnectReason.loggedOut) {
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          process.exit(1);
        }
        
        if (retryCount < 10) {
          retryCount++;
          setTimeout(connectToWhatsApp, retryCount * 2000);
        }
      }
    });

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        if (m.key.fromMe || !m.message) continue;
        
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        if (!text.startsWith(config.prefix)) continue;
        
        const cmd = text.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
        const handler = commands.get(cmd);
        
        if (handler) {
          const from = m.key.remoteJid;
          const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: m });
          
          try {
            await handler({ sock, msg: m, reply });
          } catch (e) {
            reply('Error: ' + e.message);
          }
        }
      }
    });

  } catch (e) {
    log.error('Connect failed: ' + e.message);
    setTimeout(connectToWhatsApp, 5000);
  }
}

log.title('ALMEER MD Starting...');
connectToWhatsApp();
