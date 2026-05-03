import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { log } from './lib/logger.js';
import { getSock } from './index.js';

const app = express();

// FIXED: Railway proxy + rate limit
app.set('trust proxy', 1);
app.enable('trust proxy');

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FIXED Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Pairing API
app.post('/api/pair', async (req, res) => {
  try {
    const phone = req.body.phoneNumber?.replace(/[^0-9]/g, '');
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Valid number required' });
    }

    const s = getSock();
    if (!s) return res.status(503).json({ error: 'Bot not ready' });

    const code = await s.requestPairingCode(phone);
    log.ok(`PAIR ${phone}: ${code}`);
    
    res.json({ success: true, code, message: 'Check WhatsApp now!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// UI
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head>
<title>${config.botName}</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
<style>
body{font-family:'Orbitron',sans-serif;background:#000;color:#0ff;min-height:100vh;display:grid;place-items:center;padding:2rem;}
canvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;}
.card{background:rgba(0,0,0,.9);border:1px solid #0ff;border-radius:1rem;padding:2rem;max-width:28rem;width:100%;box-shadow:0 0 2rem #0ff2;text-align:center;position:relative;z-index:2;}
h1{font-size:2rem;background:linear-gradient(45deg,#0ff,#f0f);-webkit-background-clip:text;background-clip:text;}
input,button{width:100%;padding:1rem;font-size:1rem;margin:.5rem 0;border:1px solid #0ff;border-radius:.75rem;background:rgba(0,0,0,.5);color:#0ff;font-family:inherit;}
button{background:linear-gradient(45deg,#0ff,#f0f);color:#000;font-weight:700;cursor:pointer;}
#code{font-size:2.5rem;font-weight:900;margin:1rem 0;background:linear-gradient(45deg,#0ff,#f0f);-webkit-background-clip:text;background-clip:text;}
#res{display:none;margin-top:1.5rem;padding:1.5rem;background:rgba(0,255,255,.1);border-radius:1rem;border:1px solid #0ff;}
.stat{padding:.75rem;border-radius:.5rem;margin-top:1rem;font-weight:700;}
.success{background:rgba(0,255,0,.2);color:#0f0;border:1px solid #0f0;}
.error{background:rgba(255,0,0,.2);color:#f00;border:1px solid #f00;}
</style>
</head><body>
<canvas id="m"></canvas>
<div class="card">
<h1>${config.botName}</h1>
<input id="n" placeholder="254712345678">
<button onclick="p()">⚡ GET CODE</button>
<div id="res">
<div id="c"></div>
<div style="margin-top:1rem;font-size:.9rem;color:#ccc;">📱 WhatsApp → Linked Devices → Link with phone number → Enter code</div>
</div>
<div id="s"></div>
</div>
<script>
c=document.getElementById('m'),x=c.getContext('2d'),w=c.width=innerWidth,h=c.height=innerHeight,cols=Math.floor(w/20),y=Array(cols).fill(0);addEventListener('resize',()=>{w=c.width=innerWidth;h=c.height=innerHeight;});setInterval(()=>{x.fillStyle='rgba(0,0,0,.05)';x.fillRect(0,0,w,h);x.fillStyle='#0ff';x.font='16px monospace';for(let i=0;i<cols;i++){x.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*w/cols,y[i]*20);y[i]=y[i]>h?0:y[i]+1;}},35);
async function p(){const n=document.getElementById('n').value.replace(/[^0-9]/g,'');if(n.length<10){s('Valid number please','error');return;}const b=document.querySelector('button');b.disabled=true;b.textContent='⏳';try{const r=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phoneNumber:n})});const d=await r.json();if(d.success){document.getElementById('c').textContent=d.code;document.getElementById('res').style.display='block';s('✅ Check WhatsApp!','success');b.textContent='NEW CODE';}else s(d.error,'error');}catch(e){s('Error','error');}b.disabled=false;}function s(m,t){document.getElementById('s').innerHTML='<div class="stat '+t+'">'+m+'</div>';}document.getElementById('n').addEventListener('keypress',e=>e.key=='Enter'&&p());
</script></body></html>`);
});

app.get('/api/status', (req, res) => res.json({ status: sock?.user ? 'online' : 'connecting' }));

export function startServer() {
  app.listen(config.port, '0.0.0.0', () => {
    log.ok(`Server: ${config.port}`);
  });
  }
