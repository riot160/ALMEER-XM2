import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import fetch from 'node-fetch';
import { config } from '../config.js';
import { formatBytes } from '../lib/utils.js';

const TMP_DIR = join(tmpdir(), 'almeer-dl');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

const ensureYtDlp = async () => {
  const ytdlpPath = join(TMP_DIR, 'yt-dlp');
  if (!existsSync(ytdlpPath)) {
    const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos' + // Adjust for platform in prod
      (process.platform === 'win32' ? '_exe' : process.platform === 'win32' ? '_linux' : '_macos');
    const res = await fetch(url);
    const stream = createWriteStream(ytdlpPath);
    await new Promise((r, j) => {
      res.body.pipe(stream).on('finish', r).on('error', j);
    });
    require('child_process').execSync(`chmod +x "${ytdlpPath}"`);
  }
  return ytdlpPath;
};

export const commands = {
  ytmp3: async ({ args, reply, from }) => {
    if (!args[0]) return reply('Usage: .ytmp3 <url>');
    reply('⏳ Downloading audio...');
    const url = args[0];
    const ytdlpPath = await ensureYtDlp();
    const file = join(TMP_DIR, `audio-${Date.now()}.mp3`);
    const proc = spawn(ytdlpPath, ['-x', '--audio-format=mp3', '-o', file, url], { stdio: 'pipe' });
    proc.on('close', async () => {
      if (existsSync(file)) {
        await reply({ audio: { url: `file://${file}` }, mimetype: 'audio/mpeg' });
        setTimeout(() => rmSync(file), 30000);
      } else reply('❌ Download failed.');
    });
  },
  ytmp4: async ({ args, reply, from }) => {
    if (!args[0]) return reply('Usage: .ytmp4 <url>');
    reply('⏳ Downloading video...');
    const url = args[0];
    const ytdlpPath = await ensureYtDlp();
    const file = join(TMP_DIR, `video-${Date.now()}.mp4`);
    spawn(ytdlpPath, ['-f', 'best[ext=mp4]', '-o', file, url], { stdio: 'pipe' })
      .on('close', async () => {
        if (existsSync(file)) {
          const stats = require('fs').statSync(file);
          reply(`✅ ${formatBytes(stats.size)} | ${file}`);
          await reply({ video: { url: `file://${file}` } });
          setTimeout(() => rmSync(file), 30000);
        } else reply('❌ Download failed.');
      });
  },
  tiktok: async ({ args, reply }) => {
    if (!args[0]) return reply('Usage: .tiktok <url>');
    reply('⏳ Fetching TikTok...');
    try {
      const res = await fetch(`https://godownloader.com/api/tiktok-no-watermark-free?url=${encodeURIComponent(args[0])}&key=godownloader.com`);
      const data = await res.json();
      if (data.video_no_watermark) {
        await reply({ video: { url: data.video_no_watermark } });
      } else reply('❌ No video found.');
    } catch (e) {
      reply('❌ TikTok fetch failed.');
    }
  },
  ig: async ({ args, reply }) => {
    if (!args[0]) return reply('Usage: .ig <url>');
    reply('⏳ Fetching IG Reel...');
    try {
      const res = await fetch(`https://api.igsnapinsta.com/api/downloader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: args[0] })
      });
      const data = await res.json();
      if (data.video) {
        await reply({ video: { url: data.video } });
      } else reply('❌ No reel found.');
    } catch (e) {
      reply('❌ IG fetch failed.');
    }
  }
};
