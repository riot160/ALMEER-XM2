import { config } from '../config.js';
export const commands = {
  restart: async ({ isOwner, reply }) => { if (!isOwner) return reply('Owner only.'); reply('Restarting...'); process.exit(0); },
  broadcast: async ({ isOwner, reply }) => { if (!isOwner) return reply('Owner only.'); reply('Broadcast stub ready.'); },
  setprefix: async ({ isOwner, args, reply }) => { if (!isOwner) return reply('Owner only.'); config.prefix = args[0] || config.prefix; reply(`Prefix set to ${config.prefix}`); },
  block: async ({ isOwner, reply }) => { if (!isOwner) return reply('Owner only.'); reply('Block stub ready.'); },
  unblock: async ({ isOwner, reply }) => { if (!isOwner) return reply('Owner only.'); reply('Unblock stub ready.'); }
};
