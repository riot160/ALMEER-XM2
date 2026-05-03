import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser, jidDecode } from '@whiskeysockets/baileys';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { loadPlugins, commands } from './lib/loader.js';
import { isOwner, uptime, normalize } from './lib/utils.js';
import { startServer } from './server.js'; // ← UPDATED

export let sock; // ← EXPORT for server.js
let retryCount = 0;
const maxRetries = 5;
let messageCache = new Map();

const SESSION_DIR = './session';
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

if (!fs.existsSync(CREDS_PATH) && process.env.SESSION_ID) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const decoded = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
  fs.writeFileSync(CREDS_PATH, decoded);
  log.info('[SESSION] Restored from SESSION_ID');
}

// Anti-delete helper
async function detectDeleted(key) {
  try {
    const msg = await sock.loadMessage(key.remoteJid, key.id);
    if (!msg?.message) return;
    const sender = jidDecode(key.participant)?.user || 'unknown';
    const content = msg.message.conversation || msg.message.extendedTextMessage?.text || '[Media]';
    const text = `⚠️ DELETED:
${sender}

${content}`;
    const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
    sock.sendMessage(ownerJid, { text });
  } catch {}
}

export const getSock = () => sock; // ← EXPORT
startServer(); // ← SIMPLIFIED CALL

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

    // Plugin events
    const pluginsDir = path.resolve('./plugins');
    if (fs.existsSync(pluginsDir)) {
      for (const file of fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'))) {
        try {
          const mod = await import(`./plugins/${file}`);
          if (mod.events) {
            Object.entries(mod.events).forEach(([ev, fn]) => {
              sock.ev.on(ev, (...args) => fn(...args, { sock }));
            });
          }
        } catch {}
      }
    }

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        retryCount = 0;
        log.ok(`[BOT] ${config.botName} Connected ✅`);
      }
      if (connection === 'close') {
        const status = lastDisconnect?.error?.output?.statusCode;
        if (status === DisconnectReason.loggedOut) {
          fs.rmSync(SESSION_DIR, { recursive: true, force: true });
          process.exit(1);
        }
        if (retryCount++ < maxRetries) setTimeout(connect, 1000 * retryCount);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const from = msg.key.remoteJid;
        const sender = jidNormalizedUser(msg.key.participant || from);
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const prefix = config.prefix;
        if (!body.startsWith(prefix)) continue;
        
        const args = body.slice(prefix.length).trim().split(/s+/);
        const cmd = args.shift()?.toLowerCase();
        const fn = commands.get(cmd);
        if (!fn) continue;
        
        const pushName = msg.pushName || 'User';
        const reply = (content) => sock.sendMessage(from, content, { quoted: msg });
        const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } });

        try {
          await fn({ sock, msg, from, sender, isOwner: isOwner(sender), body, args, prefix, pushName, reply, react });
        } catch (e) {
          reply(`❌ ${e.message}`);
        }
      }
    });

    // Anti-delete paths
    sock.ev.on('messages.update', (updates) => {
      for (const { key, update } of updates) {
        if (update.status === 4) detectDeleted(key);
      }
    });

  } catch (e) {
    log.error(`Connect: ${e.message}`);
    setTimeout(connect, 5000);
  }
}

log.title(`${config.botName} v1.0.0`);
connect();
