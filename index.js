import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import chalk from 'chalk';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser, jidDecode, downloadContentFromMessage } from '@whiskeysockets/baileys';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { loadPlugins, commands } from './lib/loader.js';
import { isOwner, uptime, normalize } from './lib/utils.js';
import { startServer } from './server.js';

const SESSION_DIR = './session';
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

// Restore SESSION_ID on cold start
if (!fs.existsSync(CREDS_PATH) && process.env.SESSION_ID) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const decoded = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
  fs.writeFileSync(CREDS_PATH, decoded);
  log.info('[SESSION] Restored from SESSION_ID env');
}

let sock;
let retryCount = 0;
const maxRetries = 5;
let messageCache = new Map();

// Anti-delete helper
async function detectDeleted(key) {
  try {
    const msg = await sock.loadMessage(key.remoteJid, key.id);
    if (!msg?.message) return;
    const sender = jidDecode(key.participant)?.user || 'unknown';
    const from = key.remoteJid;
    const content = msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || 
                   msg.message.imageMessage?.caption || 
                   '[Media/Unsupported]';
    const isGroup = from.endsWith('@g.us');
    const text = `⚠️ DELETED MESSAGE DETECTED
From: ${sender}
In: ${isGroup ? 'Group' : 'DM'}

${content}`;
    const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
    if (isOwner(ownerJid)) sock.sendMessage(ownerJid, { text });
  } catch (e) {
    log.error(`Anti-delete error: ${e.message}`);
  }
}

const getSock = () => sock;
startServer(getSock);

async function connect() {
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

    await loadPlugins();

    sock.ev.on('creds.update', saveCreds);

    // Load plugin events dynamically
    const pluginsDir = path.resolve('./plugins');
    if (fs.existsSync(pluginsDir)) {
      const pluginFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
      for (const file of pluginFiles) {
        try {
          const mod = await import(`./plugins/${file}`);
          if (mod.events) {
            Object.entries(mod.events).forEach(([event, handler]) => {
              sock.ev.on(event, (...args) => handler(...args, { sock }));
            });
          }
        } catch (e) {
          log.error(`Plugin load error ${file}: ${e.message}`);
        }
      }
    }

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        retryCount = 0;
        log.ok(`[BOT] ${config.botName} Connected ✅`);
        log.info(`[WEB] Pairing: http://localhost:${config.port}`);
        
        // Auto-pair owner if set
        if (config.ownerNumber && !fs.existsSync(CREDS_PATH)) {
          try {
            const code = await sock.requestPairingCode(normalize(config.ownerNumber));
            log.info(`[PAIR] Owner code: ${code}`);
          } catch (e) {
            log.warn('[PAIR] Auto-pair failed, use web UI');
          }
        }
      }
      
      if (connection === 'close') {
        const status = lastDisconnect?.error?.output?.statusCode;
        log.warn(`[CONN] Closed: ${status} (${DisconnectReason[status] || 'UNKNOWN'})`);
        
        if (status === DisconnectReason.loggedOut) {
          log.error('[AUTH] Logged out - deleting session');
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          process.exit(1);
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = 1000 * Math.pow(2, retryCount);
          log.info(`[RECON] Retry ${retryCount}/${maxRetries} in ${delay}ms`);
          setTimeout(connect, delay);
        } else {
          log.error('[RECON] Max retries exceeded');
          process.exit(1);
        }
      }
    });

    // Main message handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        
        const from = msg.key.remoteJid;
        const sender = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);
        const isGroup = from.endsWith('@g.us');
        const body = msg.message.conversation || 
                    msg.message.extendedTextMessage?.text || 
                    msg.message.imageMessage?.caption || 
                    msg.message.videoMessage?.caption || '';
        
        const prefix = config.prefix;
        if (!body.startsWith(prefix)) continue;
        
        const args = body.slice(prefix.length).trim().split(/s+/);
        const cmd = args.shift()?.toLowerCase();
        const fn = commands.get(cmd);
        
        if (!fn) continue;
        
        const pushName = msg.pushName || 'User';
        const reply = (content) => sock.sendMessage(from, content, { quoted: msg });
        const react = (emoji) => sock.sendMessage(from, { 
          react: { text: emoji, key: msg.key } 
        });

        try {
          await fn({ 
            sock, 
            msg, 
            from, 
            sender, 
            isOwner: isOwner(sender), 
            isGroup, 
            body, 
            args, 
            prefix, 
            pushName, 
            reply, 
            react 
          });
        } catch (e) {
          log.error(`Cmd ${cmd} error: ${e.message}`);
          reply(`❌ Error: ${e.message}`);
        }
      }
    });

    // Path 3: Anti-delete timestamp diff (5s window)
    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        const id = msg.key.id;
        const now = Date.now();
        if (messageCache.has(id) && now - messageCache.get(id).ts < 5000) {
          detectDeleted(msg.key);
        }
        messageCache.set(id, { ts: now, msg });
        // Cleanup old cache
        if (messageCache.size > 1000) messageCache.clear();
      }
    });

    // Group events stub (extend as needed)
    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
      log.info(`[GROUP] ${action} in ${id}: ${participants.join(', ')}`);
    });

  } catch (e) {
    log.error(`Connect error: ${e.message}`);
    setTimeout(connect, 5000);
  }
}

process.on('SIGINT', () => {
  log.info('[EXIT] Graceful shutdown');
  process.exit(0);
});

log.title(`${config.botName} Starting...`);
connect();
