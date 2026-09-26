# Deploy `nextstep-web` to Vercel

Pure static site. No Python, no backend, no environment variables required. Deploys in ~15 seconds.

The frontend ships with an **in-file mock** (`mock-api.js`) that recognises 15+ signal patterns, so the deployed URL is fully functional out of the box. To point it at a live backend, add `?real=1` or `?api=<url>` to the URL.

---

## One-time setup

```bash
npm i -g vercel
cd C:\Users\hamza\OneDrive\Desktop\Hazhteq\nextstep-web
vercel login
```

---

## Deploy

```bash
vercel --prod
```

Answer:
1. **Set up and deploy?** → `y`
2. **Link to existing project?** → `n`
3. **Project name?** → `nextstep-web-<yourname>`
4. **Directory?** → `.`
5. **Override settings?** → `n`

You get a production URL like `https://nextstep-web-hamza.vercel.app` in about 15 seconds.

---

## Verify

Open the URL in a browser. Click any of the built-in scenario chips to see the 7 shared scenarios (calm mode, adversarial, worse-after-action, etc.).

Try the URL flags:
- `https://your-url.vercel.app/?fast=1` → 2s AI latency (fast demo)
- `https://your-url.vercel.app/?slow=1` → 25s AI latency (see the partial-summary reveal at 5s)
- `https://your-url.vercel.app/?err=1` → force the mock to reject → shows the calm error state

---

## Pointing at the deployed Agent backend

If you've also deployed `nextstep-agent` at `https://nextstep-agent-hamza.vercel.app`:

```
https://nextstep-web-hamza.vercel.app/?api=https://nextstep-agent-hamza.vercel.app
```

The draft-status label under the textarea will read `Live backend: <url>` when a real backend is wired up. If the backend is unreachable the app silently falls back to the mock — the demo never breaks.

---

## What's in `vercel.json`

Just:
- `cleanUrls: true` — no `.html` in URLs
- Two security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`)

Nothing else is needed — Vercel serves the four files (`index.html`, `styles.css`, `app.js`, `mock-api.js`) directly from its edge network.

---

## Redeploying

```bash
git commit -am "…"
vercel --prod
```
