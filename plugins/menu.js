import { config } from '../config.js';
import { uptime } from '../lib/utils.js';

export const commands = {
  menu: async ({ reply, pushName }) => {
    const txt = `╔══════════════════════════╗
║  ${config.botName}  ║
╚══════════════════════════╝

┌──────────────────────────┐
│  👤 User: ${pushName}
│  🕐 Time: ${new Date().toLocaleTimeString()}
│  📅 Date: ${new Date().toDateString()}
│  ⚡ Prefix: ${config.prefix}
│  🔧 Cmds: 13
└──────────────────────────┘

╭── 📥 DOWNLOADER ──╮
│ ${config.prefix}ytmp3
│ ${config.prefix}ytmp4
│ ${config.prefix}tiktok
│ ${config.prefix}ig
╰────────────────────╯

╭── 🤖 AI ──╮
│ ${config.prefix}ai
│ ${config.prefix}gpt
╰────────────╯

╭── 👥 GROUP ──╮
│ ${config.prefix}kick
│ ${config.prefix}add
│ ${config.prefix}promote
│ ${config.prefix}demote
│ ${config.prefix}mute / ${config.prefix}unmute
│ ${config.prefix}tagall
│ ${config.prefix}groupinfo
╰──────────────╯

╭── 🛡️ OWNER ──╮
│ ${config.prefix}restart
│ ${config.prefix}broadcast
│ ${config.prefix}setprefix
│ ${config.prefix}block / ${config.prefix}unblock
╰──────────────╯

Owner: ${config.ownerNumber || 'not set'}
Uptime: ${uptime()}`;
    reply(txt);
  }
};
