import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, jidNormalizedUser } from '@whiskeysockets/baileys';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { loadPlugins, commands } from './lib/loader.js';
import { isOwner, uptime, normalize } from './lib/utils.js';
import { startServer } from './server.js';

const SESSION_DIR = './session';
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

if (!fs.existsSync(CREDS_PATH) && process.env.SESSION_ID) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const decoded = Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8');
  fs.writeFileSync(CREDS_PATH, decoded);
  console.log(chalk.cyan('[SESSION] Restored creds from SESSION_ID env'));
}

let sock;
let retryCount = 0;
const maxRetries = 5;

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

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      try {
        if (connection === 'open') {
          retryCount = 0;
          log.ok('[BOT] Connected');
          if (config.ownerNumber) {
            const code = await sock.requestPairingCode(normalize(config.ownerNumber));
            log.info(`[PAIR] ${code}`);
          } else {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question('Enter owner number: ', async (ans) => {
              try {
                const code = await sock.requestPairingCode(normalize(ans));
                console.log(chalk.cyan(`[PAIR] ${code}`));
                rl.close();
              } catch (e) {
                log.error(e.message);
                rl.close();
              }
            });
          }
        }
        if (connection === 'close') {
          const status = lastDisconnect?.error?.output?.statusCode;
          if (status === DisconnectReason.loggedOut) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            process.exit(0);
          }
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(connect, 1000 * retryCount);
          }
        }
      } catch (e) {
        log.error(e.message);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (!msg.message) continue;
          const from = msg.key.remoteJid;
          const sender = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);
          const isGroup = from.endsWith('@g.us');
          const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
          const prefix = config.prefix;
          const pushName = msg.pushName || 'User';
          const reply = (t) => sock.sendMessage(from, { text: t }, { quoted: msg });
          const react = (e) => sock.sendMessage(from, { react: { text: e, key: msg.key } });

          if (body.startsWith(prefix)) {
            const [cmd, ...args] = body.slice(prefix.length).trim().split(/s+/);
            const fn = commands.get(cmd.toLowerCase());
            if (fn) await fn({ sock, msg, from, sender, isOwner: isOwner(sender), isGroup, body, args, prefix, pushName, reply, react });
          }
        }
      } catch (e) {
        log.error(e.message);
      }
    });
  } catch (e) {
    log.error(e.message);
  }
}
connect();
