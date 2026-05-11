<p align="center">
  <img src="public/hero.png" alt="Aura — Your ambient AI" width="100%" />
</p>

<h1 align="center">Aura</h1>

<p align="center">
  <strong>Your ambient AI. Quietly brilliant.</strong><br/>
  A calm desktop companion that understands your screen, remembers what matters,<br/>and stays gently present — never in the way.
</p>

<p align="center">
  <a href="https://aura.aura-companion.workers.dev">Web App</a> ·
  <a href="https://github.com/IsmailMoudden/aura-companion/releases/latest">Download</a> ·
  <a href="#keyboard-shortcuts">Shortcuts</a> ·
  <a href="#stack">Stack</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=flat&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154?style=flat" />
  <img src="https://img.shields.io/badge/Supabase-backend-3ECF8E?style=flat&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat" />
</p>

---

<p align="center">
  <img src="public/overlay-preview.png" alt="Aura overlay on desktop" width="380" />
</p>

---

## What it is

Aura is not an app you open. It's a presence that floats above everything else on your desktop — always one shortcut away, never in the way.

It sees your screen. It understands your context. It responds in plain language, then disappears.

**Two surfaces:**

- **Desktop overlay** — a transparent, always-on-top Electron window. Summon it with `Alt+Space`, ask anything, dismiss it. Sees your screen automatically on every message.
- **Web app** — full conversational interface with history, memory, and multi-model access at [aura.aura-companion.workers.dev](https://aura.aura-companion.workers.dev)

---

## Download

| Platform | Installer |
|---|---|
| macOS Apple Silicon (M1/M2/M3) | [Aura-arm64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-arm64.dmg) |
| macOS Intel | [Aura-x64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.dmg) |
| Windows x64 | [Aura-x64.exe](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.exe) |

Free during early access · No account needed to start

> **macOS:** Unsigned build. On first launch: right-click → Open, or run `xattr -cr /Applications/Aura.app` in Terminal.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Summon / dismiss overlay |
| `Alt+Shift+S` | Capture screenshot manually |
| `Alt+Shift+H` | Toggle invisible mode (hidden from screen recording) |
| `Shift+Enter` | Trigger voice input directly |
| `Alt+←↑↓→` | Nudge overlay position |

---

## Stack

| Layer | Tech |
|---|---|
| Desktop | Electron 39 · transparent overlay window · always-on-top |
| Framework | TanStack Start (React 19 + TanStack Router) |
| Styling | Tailwind CSS v4 · custom design tokens via CSS variables |
| AI — default | Kimi K2.6 / moonshot-v1-8k (Moonshot AI) |
| AI — vision | moonshot-v1-32k-vision-preview (auto-selected with screenshot) |
| AI — extras | GPT-4o · Claude Sonnet · Gemini Flash · Llama 3.3 70B via OpenRouter |
| Backend / Auth | Supabase (email + Google OAuth · `conversations` + `messages` tables) |
| Edge functions | Supabase Edge Functions (Deno) |
| Hosting | Cloudflare Workers |
| Build | Vite 7 · esbuild · electron-builder |
| Package manager | Bun |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Electron Overlay               │
│  Transparent window · always-on-top · macOS/Win │
│                                             │
│  • Screen capture (sips resize → base64)    │
│  • Voice input (Web Speech API)             │
│  • TTS output (SpeechSynthesis)             │
│  • Wake word detection ("Hey Aura")         │
│  • Session via electron-store               │
└────────────────┬────────────────────────────┘
                 │ fetch
                 ▼
┌─────────────────────────────────────────────┐
│         Supabase Edge Function /chat        │
│                                             │
│  • Auth validation                          │
│  • Daily per-model rate limits              │
│  • Multimodal screenshot injection          │
│  • Routes to Kimi or OpenRouter             │
└──────┬───────────────────────┬──────────────┘
       │                       │
       ▼                       ▼
  Moonshot AI            OpenRouter API
  (Kimi K2.6)     (GPT-4o · Claude · Gemini…)

┌─────────────────────────────────────────────┐
│           Web App (Cloudflare Workers)      │
│  TanStack Start · SSR · same Supabase DB    │
│  Shared auth · shared conversation history  │
└─────────────────────────────────────────────┘
```

---

## Auth flow

The overlay has no login form. When signed out, clicking the orb opens the web app at `?overlay=true`. After sign-in, the web app redirects to `aura://auth?access_token=...&refresh_token=...`. Electron intercepts this deep link and restores the session — persisted across relaunches via `electron-store`.

Add this redirect URL in **Supabase → Authentication → URL Configuration**:
```
aura://auth
```

---

## Development

```bash
# Install dependencies
bun install

# Copy env file
cp .env.example .env
# Fill in your keys (see .env.example)

# Web app (dev server)
bun dev

# Electron overlay
bun run electron:dev
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_WEB_URL` | Public URL of the web app |
| `KIMI_API_KEY` | Moonshot AI API key (set as Supabase secret) |
| `OPENROUTER_API_KEY` | OpenRouter API key (set as Supabase secret) |

---

## Building

```bash
# macOS (run on macOS)
bunx electron-builder --mac dmg --arm64 --publish never   # Apple Silicon
bunx electron-builder --mac dmg --x64 --publish never     # Intel

# Windows (run on Windows or via CI)
bunx electron-builder --win nsis --x64 --publish never
```

Releases are built automatically via GitHub Actions on every `v*` tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow builds macOS arm64, macOS x64, and Windows x64 in parallel and publishes a GitHub Release automatically.

---

## Deploying the Supabase edge function

```bash
# Set secrets
supabase secrets set KIMI_API_KEY=sk-...
supabase secrets set OPENROUTER_API_KEY=sk-or-...

# Deploy
supabase functions deploy chat --project-ref <your-project-ref>
```

Or push to `main` — the GitHub Actions workflow [`.github/workflows/deploy-functions.yml`](.github/workflows/deploy-functions.yml) deploys automatically on changes to `supabase/functions/`.

---

## GitHub Actions secrets

Set these in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_WEB_URL` | Public URL of the web app |
| `SUPABASE_PROJECT_REF` | Supabase project ref (for function deploy) |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token |

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE) for details.
