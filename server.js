import express from 'express';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { log } from './lib/logger.js';

export function startServer(getSock) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_, res) => {
    res.send(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${config.botName}</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
body{margin:0;font-family:Orbitron,sans-serif;background:#000;color:#0ff;overflow:hidden}
#c{position:fixed;inset:0;z-index:-1}
.wrap{min-height:100vh;display:grid;place-items:center;padding:20px}
.card{width:min(720px,92vw);background:rgba(10,10,16,.85);border:1px solid #ff00ff55;box-shadow:0 0 30px #00ffff33,0 0 40px #ff00ff22;border-radius:18px;padding:28px}
h1{color:#fff;text-align:center;text-shadow:0 0 12px #0ff,0 0 18px #f0f}
input,button{width:100%;padding:16px 18px;border:none;border-radius:12px;font-family:inherit;font-size:16px;box-sizing:border-box}
input{background:#111;color:#0ff;border:1px solid #0ff55;margin:18px 0}
button{background:linear-gradient(90deg,#00ffff,#ff00ff);color:#000;font-weight:900;cursor:pointer}
#out{margin-top:18px;padding:18px;border:1px solid #0ff;background:#02060a;border-radius:12px;display:none;text-align:center;box-shadow:0 0 18px #0ff55}
small{display:block;margin-top:12px;color:#ddd;text-align:center}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="wrap"><div class="card">
<h1>${config.botName}</h1>
<input id="n" placeholder="Enter your WhatsApp number (with country code)">
<button onclick="go()">⚡ GET PAIRING CODE</button>
<div id="out"></div>
<small>Open WhatsApp → Linked Devices → Link with phone number → Enter code</small>
</div></div>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
let w,h;function rs(){w=c.width=innerWidth;h=c.height=innerHeight}rs();addEventListener('resize',rs);
const cols=40, y=Array(cols).fill(0); setInterval(()=>{x.fillStyle='rgba(0,0,0,.08)';x.fillRect(0,0,w,h);x.fillStyle='#0ff';x.font='16px Orbitron';for(let i=0;i<cols;i++){const t=String.fromCharCode(0x30A0+Math.random()*96);x.fillText(t,i*w/cols,y[i]);y[i]=y[i]>h+Math.random()*10000?0:y[i]+18}},50);
async function go(){const number=document.getElementById('n').value.trim();const r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({number})});const j=await r.json();const o=document.getElementById('out');o.style.display='block';o.innerHTML='<h2 style="color:#fff;text-shadow:0 0 12px #0ff">'+j.code+'</h2>'}
</script></body></html>`);
  });

  app.post('/pair', async (req, res) => {
    try {
      const number = String(req.body.number || '').replace(/[^0-9]/g, '');
      const sock = getSock();
      const code = await sock.requestPairingCode(number);
      res.json({ code });
    } catch (e) {
      log.error(e?.message || String(e));
      res.status(500).json({ error: 'Failed to generate code' });
    }
  });

  app.listen(config.port, () => log.ok(`[WEB] Pairing site on :${config.port}`));
             }
