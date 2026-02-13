/**
 * Cobot AI - Landing Page
 *
 * XSS-safe: All dynamic content uses textContent, never innerHTML with user data.
 */

export const LANDING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cobot AI - Deploy Your AI Agent</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: #facc15;
      --primary-light: #fde047;
      --accent: #facc15;
      --bg: #000000;
      --card: rgba(255,255,255,0.03);
      --border: rgba(255,255,255,0.08);
      --text: #f8fafc;
      --muted: #94a3b8;
      --success: #10b981;
      --error: #ef4444;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .bg {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(250,204,21,0.12), transparent),
        radial-gradient(ellipse 50% 40% at 100% 100%, rgba(250,204,21,0.06), transparent);
    }
    .container { position: relative; z-index: 1; max-width: 480px; margin: 0 auto; padding: 48px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo {
      width: 72px; height: 72px; margin: 0 auto 20px;
      background: var(--primary);
      border-radius: 20px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 16px 32px -8px rgba(250,204,21,0.3);
    }
    .logo svg { width: 36px; height: 36px; color: black; }
    h1 {
      font-size: 2.25rem; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase;
      color: var(--text);
    }
    .tagline { font-size: 1rem; color: var(--muted); margin-top: 8px; }
    .tagline span { color: var(--accent); font-weight: 500; }
    .card {
      background: var(--card); backdrop-filter: blur(16px);
      border: 1px solid var(--border); border-radius: 20px; padding: 28px;
    }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 6px; }
    input {
      width: 100%; padding: 12px 14px; font-size: 0.9375rem; font-family: inherit;
      color: var(--text); background: rgba(255,255,255,0.05);
      border: 1px solid var(--border); border-radius: 10px; transition: 0.2s;
    }
    input:focus {
      outline: none; border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(250,204,21,0.15);
    }
    input::placeholder { color: var(--muted); opacity: 0.5; }
    .btn {
      width: 100%; padding: 14px; margin-top: 20px;
      font-size: 1rem; font-weight: 700; font-family: inherit;
      color: black; background: var(--primary);
      border: none; border-radius: 999px; cursor: pointer; transition: 0.2s;
    }
    .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 24px -8px rgba(250,204,21,0.3); background: var(--primary-light); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .steps { margin-top: 20px; }
    .steps-title { font-size: 0.8125rem; font-weight: 600; color: var(--accent); margin-bottom: 10px; }
    .step { display: flex; gap: 10px; font-size: 0.8125rem; color: var(--muted); line-height: 1.5; margin-bottom: 8px; }
    .step-num {
      flex-shrink: 0; width: 22px; height: 22px;
      background: rgba(250,204,21,0.2); color: var(--accent);
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; font-weight: 600;
    }
    .step a { color: var(--accent); text-decoration: none; }
    .result {
      margin-top: 20px; padding: 14px; border-radius: 10px;
      font-size: 0.875rem; display: none;
    }
    .result.ok { display: block; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }
    .result.err { display: block; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .result-title { font-weight: 600; margin-bottom: 6px; }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 28px; }
    .feat {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px; transition: 0.2s;
    }
    .feat:hover { border-color: rgba(250,204,21,0.2); }
    .feat-icon { font-size: 1.25rem; margin-bottom: 8px; }
    .feat-title { font-weight: 600; font-size: 0.875rem; margin-bottom: 2px; }
    .feat-desc { color: var(--muted); font-size: 0.75rem; line-height: 1.4; }
    .footer { text-align: center; margin-top: 36px; font-size: 0.75rem; color: var(--muted); }
    .footer a { color: var(--accent); text-decoration: none; }
    @media (max-width: 480px) { .features { grid-template-columns: 1fr; } h1 { font-size: 1.75rem; } }
  </style>
</head>
<body>
  <div class="bg"></div>
  <div class="container">
    <header class="header">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h1>Cobot AI</h1>
      <p class="tagline">Your <span>AI assistant</span> on Telegram, one click deploy</p>
    </header>
    <div class="card">
      <form id="f">
        <div class="form-group">
          <label>Telegram Bot Token</label>
          <input type="text" id="token" placeholder="123456789:ABCdefGHI..." required autocomplete="off">
        </div>
        <div class="form-group">
          <label>Your Telegram User ID</label>
          <input type="text" id="uid" placeholder="123456789" pattern="[0-9]+" required>
        </div>
        <button type="submit" class="btn" id="btn">Deploy My AI Assistant</button>
      </form>
      <div class="steps">
        <div class="steps-title">Quick Setup</div>
        <div class="step"><span class="step-num">1</span><span>Create a bot via <a href="https://t.me/BotFather" target="_blank">@BotFather</a></span></div>
        <div class="step"><span class="step-num">2</span><span>Copy the bot token it gives you</span></div>
        <div class="step"><span class="step-num">3</span><span>Get your user ID from <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a></span></div>
        <div class="step"><span class="step-num">4</span><span>Paste both above and click Deploy!</span></div>
      </div>
      <div id="result" class="result">
        <div id="resultTitle" class="result-title"></div>
        <div id="resultMsg"></div>
      </div>
    </div>
    <div class="features">
      <div class="feat"><div class="feat-icon">&#9889;</div><div class="feat-title">Instant Deploy</div><div class="feat-desc">Live in under 10 seconds</div></div>
      <div class="feat"><div class="feat-icon">&#128274;</div><div class="feat-title">Private</div><div class="feat-desc">Only you can use your bot</div></div>
      <div class="feat"><div class="feat-icon">&#129302;</div><div class="feat-title">GPT-4 Powered</div><div class="feat-desc">No API key needed</div></div>
      <div class="feat"><div class="feat-icon">&#127760;</div><div class="feat-title">Always Online</div><div class="feat-desc">Cloudflare edge network</div></div>
    </div>
    <footer class="footer">Powered by <a href="https://cloudflare.com" target="_blank">Cloudflare Workers</a></footer>
  </div>
  <script>
    const form = document.getElementById('f')
    const btn = document.getElementById('btn')
    const result = document.getElementById('result')
    const resultTitle = document.getElementById('resultTitle')
    const resultMsg = document.getElementById('resultMsg')

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const token = document.getElementById('token').value.trim()
      const uid = document.getElementById('uid').value.trim()

      btn.disabled = true
      btn.textContent = 'Deploying...'
      result.className = 'result'

      try {
        const res = await fetch('/api/provision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramUserId: uid, telegramBotToken: token }),
        })
        const data = await res.json()

        if (data.success) {
          result.className = 'result ok'
          resultTitle.textContent = 'Success!'
          resultMsg.textContent = data.message
        } else {
          result.className = 'result err'
          resultTitle.textContent = 'Error'
          resultMsg.textContent = data.message
        }
      } catch (err) {
        result.className = 'result err'
        resultTitle.textContent = 'Error'
        resultMsg.textContent = err.message || 'Something went wrong'
      }

      btn.disabled = false
      btn.textContent = 'Deploy My AI Assistant'
    })
  </script>
</body>
</html>`
