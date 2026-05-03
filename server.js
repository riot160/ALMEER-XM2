import express from 'express';
import { config } from './config.js';
import { log } from './lib/logger.js';

export function startServer(getSock) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public')); // Optional: for assets

  app.get('/', (_, res) => {
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${config.botName} - Pairing</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Orbitron',monospace;background:linear-gradient(45deg,#000,#0a0a1a,#1a0a2a);color:#0ff;min-height:100vh;display:grid;place-items:center;padding:20px;overflow:hidden}
    canvas{position:fixed;top:0;left:0;z-index:1;width:100%;height:100%}
    .card{background:linear-gradient(145deg,rgba(10,10,20,.95),rgba(20,10,30,.9));backdrop-filter:blur(20px);border:1px solid #0ff5;border-radius:24px;padding:40px;max-width:500px;width:100%;box-shadow:0 20px 40px rgba(0,255,255,.1),inset 0 1px 0 #0ff2;text-align:center;position:relative;z-index:2}
    h1{font-size:clamp(1.5rem,5vw,2.5rem);background:linear-gradient(45deg,#0ff,#f0f);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px;text-shadow:0 0 20px rgba(0,255,255,.5)}
    input{width:100%;padding:18px 20px;font-size:16px;font-family:inherit;background:rgba(0,0,0,.7);border:2px solid #0ff4;border-radius:16px;color:#fff;margin:20px 0;transition:all .3s}
    input:focus{outline:none;box-shadow:0 0 20px #0ff4;border-color:#f0f}
    button{width:100%;padding:18px;font-size:16px;font-weight:900;font-family:inherit;background:linear-gradient(45deg,#0ff,#f0f);color:#000;border:none;border-radius:16px;cursor:pointer;transition:all .3s;box-shadow:0 8px 20px rgba(0,255,255,.3)}
    button:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,255,255,.4)}
    button:active{transform:translateY(0)}
    #result{display:none;margin-top:25px;padding:25px;border:2px solid #0ff;background:rgba(0,255,255,.05);border-radius:16px;box-shadow:0 0 30px #0ff3}
    #code{font-size:2.5rem;font-weight:900;background:linear-gradient(45deg,#0ff,#f0f);background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:10px 0;text-shadow:0 0 30px rgba(0,255,255,.8);letter-spacing:8px}
    .instructions{margin-top:20px;padding:20px;background:rgba(255,0,255,.1);border-radius:12px;border-left:4px solid #f0f}
    .status{margin-top:15px;padding:12px;border-radius:8px;font-weight:700}
    .success{background:rgba(0,255,0,.2);border:1px solid #0f02;color:#0f0}
    .error{background:rgba(255,0,0,.2);border:1px solid #f002;color:#f00}
    @media(max-width:480px){.card{padding:30px 20px}}
  </style>
</head>
<body>
  <canvas id="matrix"></canvas>
  <div class="card">
    <h1>${config.botName}</h1>
    <p style="color:#aaa;margin-bottom:30px">Enter your WhatsApp number to get pairing code</p>
    
    <input id="number" placeholder="254712345678 (Country code required)" maxlength="15"/>
    <button onclick="requestCode()">⚡ GENERATE PAIRING CODE</button>
    
    <div id="result">
      <div id="code"></div>
      <div class="instructions">
        <strong>📱 Open WhatsApp:</strong><br>
        Settings → Linked Devices → <strong>Link with phone number</strong><br>
        <strong>Enter the code above</strong> (it expires in 5 minutes)
      </div>
    </div>
    
    <div id="status"></div>
  </div>

  <script>
    // Matrix rain background
    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    
    const cols = Math.floor(w / 20) + 1;
    const drops = Array(cols).fill(1);
    
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    
    function rain() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, w, h);
      
      ctx.fillStyle = '#0ff';
      ctx.font = '16px monospace';
      
      for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(0x30A0 + Math.random() * 96);
        ctx.fillText(text, i * 20, drops[i] * 20);
        
        if (drops[i] * 20 > h && Math.random() > 0.975)
          drops[i] = 0;
        else drops[i]++;
      }
    }
    setInterval(rain, 50);

    async function requestCode() {
      const number = document.getElementById('number').value.trim().replace(/[^0-9]/g, '');
      if (!number || number.length < 10) {
        showStatus('Enter valid number with country code', 'error');
        return;
      }

      const btn = document.querySelector('button');
      const status = document.getElementById('status');
      btn.disabled = true;
      btn.textContent = '⏳ Generating...';
      status.innerHTML = '';

      try {
        const response = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number })
        });
        
        const data = await response.json();
        
        if (data.code) {
          document.getElementById('code').textContent = data.code;
          document.getElementById('result').style.display = 'block';
          showStatus('✅ Code generated! Check WhatsApp notification', 'success');
          btn.textContent = '🔄 NEW CODE';
        } else {
          showStatus(data.error || 'Failed to generate code', 'error');
        }
      } catch (error) {
        showStatus('Network error. Try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    }

    function showStatus(msg, type) {
      const status = document.getElementById('status');
      status.textContent = msg;
      status.className = `status ${type}`;
    }

    // Enter key support
    document.getElementById('number').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') requestCode();
    });
  </script>
</body>
</html>`);
  });

  // Clean API endpoint
  app.post('/api/pair', async (req, res) => {
    try {
      const number = String(req.body.number || '').replace(/[^0-9]/g, '');
      if (!number || number.length < 10) {
        return res.status(400).json({ error: 'Invalid number format' });
      }

      const sock = getSock();
      if (!sock || !sock.user) {
        return res.status(503).json({ error: 'Bot not ready. Wait 10s...' });
      }

      const code = await sock.requestPairingCode(number);
      log.ok(`[PAIR] ${number} → ${code}`);
      
      res.json({ code, message: 'Pairing code generated. Check WhatsApp.' });
    } catch (e) {
      log.error(`[PAIR] ${e.message}`);
      res.status(500).json({ error: e.message.includes('already paired') ? 'Already paired' : 'Failed to generate code' });
    }
  });

  const PORT = config.port;
  app.listen(PORT, '0.0.0.0', () => {
    log.ok(`[PAIRING] Ready on :${PORT} → http://localhost:${PORT}`);
    log.info('[USAGE] Visit URL → Enter number → Check WhatsApp notification');
  });
}
