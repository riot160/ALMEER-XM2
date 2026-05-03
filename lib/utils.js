import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { config } from '../config.js';

export { jidNormalizedUser };

export const normalize = (n) => String(n || '').replace(/[^0-9]/g, '');
export const isOwner = (jid) => jidNormalizedUser(jid) === jidNormalizedUser(`${config.ownerNumber}@s.whatsapp.net`);
export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};
export const uptime = () => {
  const s = Math.floor(process.uptime());
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};
