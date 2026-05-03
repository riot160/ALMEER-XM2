// ═══════════════════════════════════════════════════
//  ALMEER MD - WEB SERVER (Express + Native Pairing)
// ═══════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { getSock } from './index.js'; // Import live socket

export const app = express();

// ── Middleware ──
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ── Rate limiter ──
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' }
}));

// ──────────────────────────────────────────────────
//  Native Pairing API (No auth - public)
// ──────────────────────────────────────────────────

// POST /api/pair → Generate pairing code instantly
app.post('/api/pair', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({ 
        error: 'Phone number required (with country code)',
        example: '254712345678'
      });
    }

    const sock = getSock();
    if (!sock) {
      return res.status(503).json({ 
        error: 'Bot starting... wait 10 seconds' 
      });
    }

    const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
    
    log.ok(`[PAIR] ${phoneNumber} → ${code}`);
    
    res.json({
      success: true,
      code,
      phoneNumber,
      message: '✅ Check WhatsApp notification → Link with phone number → Enter code',
      expiresIn: '5 minutes'
    });
  } catch (e) {
    log.error(`[PAIR ERROR] ${e.message}`);
    res.status(500).json({ 
      error: e.message.includes('already') ? 'Already paired' : 'Try again',
      retry: true 
    });
  }
});

// GET / → Cyberpunk pairing UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${config.botName}</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Orbitron',monospace;background:#000;color:#0ff;min-height:100vh;display:grid;place-items:center;padding:20px;overflow:hidden;}
canvas{position:fixed;top:0;left:0;z-index:1;width:100%;height:100%;}
.card{background:rgba(10,10,20,.95);border:2px solid #0ff5;border-radius:24px;padding:40px;max-width:500px;width:100%;box-shadow:0 0 40px #0ff3;text-align:center;position:relative;z-index:2;}
h1{font-size:clamp(1.8rem,6vw,3rem);background:linear-gradient(45deg,#0ff,#f0f);-webkit-background-clip:text;background-clip:text;margin-bottom:15px;}
input{width:100%;padding:20px;font-size:18px;background:rgba(0,0,0,.8);border:2px solid #0ff4;border-radius:16px;color:#fff;margin:25px 0;font-family:inherit;}
button{width:100%;padding:20px;font-size:18px;font-weight:900;background:linear-gradient(45deg,#0ff,#f0f);color:#000;border:none;border-radius:16px;cursor:pointer;box-shadow:0 10px 25px rgba(0,255,255,.4);}
#result{display:none;margin-top:30px;padding:30px;border:2px solid #0ff;background:rgba(0,255,255,.1);border-radius:20px;}
#code{font-size:3rem;font-weight:900;background:linear-gradient(45deg,#0ff,#f0f);-webkit-background-clip:text;background-clip:text;margin:15px 0;letter-spacing:10px;text-shadow:0 0 30px #0ff;}
.instr{margin-top:20px;padding:20px;background:rgba(255,0,255,.15);border-radius:15px;border-left:5px solid #f0f;font-size:14px;line-height:1.5;}
.status{margin-top:20px;padding:15px;border-radius:10px;font-weight:700;}
.success{background:rgba(0,255,0,.2);border:1px solid #0f0;color:#0f0;}
.error{background:rgba(255,0,0,.2);border:1px solid #f00;color:#f00;}
@media(max-width:500px){.card{padding:30px 20px;}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="card">
<h1>${config.botName}</h1>
<p style="color:#ccc;margin-bottom:30px;">Enter number → Get code → Check WhatsApp</p>
<input id="num" placeholder="254712345678">
<button onclick="getCode()">⚡ GENERATE CODE</button>
<div id="res">
<div id="code"></div>
<div class="instr">
<strong>📱 WhatsApp Notification:</strong><br>
Settings → Linked Devices → <strong>Link with phone number</strong><br>
<strong>Enter 8-digit code above</strong>
</div>
</div>
<div id="stat"></div>
</div>
<script>
const c = document.getElementById('c'), ctx = c.getContext('2d');
let cw = c.width = innerWidth, ch = c.height = innerHeight;
const cols = Math.floor(cw/25), drops = Array(cols).fill(0);
addEventListener('resize', () => {cw = c.width = innerWidth; ch = c.height = innerHeight;});
setInterval(() => {
  ctx.fillStyle = 'rgba(0,0,0,.04)'; ctx.fillRect(0,0,cw,ch);
  ctx.fillStyle = '#0ff'; ctx.font = '18px monospace';
  for(let i=0;i<cols;i++) {
    const txt = String.fromCharCode(0x30A0+Math.random()*96);
    ctx.fillText(txt, i*25, drops[i]*25);
    drops[i] = drops[i]*25>ch && Math.random()>.99 ? 0 : drops[i]++;
  }
}, 50);

async function getCode() {
  const num = document.getElementById('num').value.replace(/[^0-9]/g,'');
  if(num.length<10) return stat('Enter valid number (eg: 254712345678)', 'error');
  const btn = document.querySelector('button');
  btn.disabled = true; btn.textContent = '⏳ Getting code...';
  try {
    const r = await fetch('/api/pair', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({phoneNumber:num})});
    const d = await r.json();
    if(d.success) {
      document.getElementById('code').textContent = d.code;
      document.getElementById('res').style.display = 'block';
      stat('✅ Code ready! Check WhatsApp notification', 'success');
      btn.textContent = '🔄 NEW CODE';
    } else stat(d.error, 'error');
  } catch(e) { stat('Network error', 'error'); }
  btn.disabled = false;
}

function stat(msg, t) {
  document.getElementById('stat').innerHTML = '<div class="status '+t+'">'+msg+'</div>';
}

document.getElementById('num').addEventListener('keypress', e=>e.key==='Enter'&&getCode());
</script>
</body>
</html>`);
});

// GET /api/status → Bot status
app.get('/api/status', (req, res) => {
  const sock = getSock();
  res.json({
    botName: config.botName,
    status: sock ? (sock.user ? 'ready' : 'connecting') : 'starting',
    prefix: config.prefix,
    uptime: Math.floor(process.uptime()),
    port: config.port
  });
});

// ──────────────────────────────────────────────────
//  Start server
// ──────────────────────────────────────────────────
export function startServer() {
  const PORT = config.port;
  app.listen(PORT, '0.0.0.0', () => {
    log.ok(`[ALMEER MD] Server → http://0.0.0.0:${PORT}`);
    log.ok(`[USAGE] Visit URL → Enter number → WhatsApp notifies code instantly`);
  });
}
