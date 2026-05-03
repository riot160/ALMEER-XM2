import fs from 'fs';
import path from 'path';

let loaded = false;
export const commands = new Map();

export async function loadPlugins() {
  if (loaded) return commands;
  const dir = path.resolve('./plugins');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')) : [];
  for (const file of files) {
    const mod = await import(path.join(dir, file));
    if (mod.commands) {
      for (const [k, v] of Object.entries(mod.commands)) commands.set(k, v);
    }
  }
  loaded = true;
  return commands;
  }
