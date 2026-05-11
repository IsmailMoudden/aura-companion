<p align="center">
  <img src="public/hero.png" alt="Aura" width="100%" />
</p>

<h1 align="center">Aura</h1>

<p align="center">
  An ambient AI companion that lives on your desktop.<br/>
  It sees your screen, understands your context, and stays out of the way until you need it.
</p>

<p align="center">
  <a href="https://aura.aura-companion.workers.dev">Web App</a> &nbsp;|&nbsp;
  <a href="https://github.com/IsmailMoudden/aura-companion/releases/latest">Download</a> &nbsp;|&nbsp;
  <a href="#shortcuts">Shortcuts</a> &nbsp;|&nbsp;
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=flat&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-backend-3ECF8E?style=flat&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat" />
</p>

<br/>

<p align="center">
  <img src="public/overlay-preview.png" alt="Aura overlay" width="360" />
</p>

<br/>

## Overview

Aura is not an app you open. It floats above your desktop, always one shortcut away. It sees your screen, responds to your questions in plain language, and disappears when you're done.

**Two surfaces:**

- **Desktop overlay** — a transparent, always-on-top Electron window. Summon it with `Alt+Space`, ask anything, dismiss it. Screen context is captured automatically on every message.
- **Web app** — full conversational interface with history and multi-model access at [aura.aura-companion.workers.dev](https://aura.aura-companion.workers.dev)

Both share the same Supabase backend, so your conversation history is always in sync.

<br/>

## Download

| Platform | Installer |
|---|---|
| macOS Apple Silicon | [Aura-arm64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-arm64.dmg) |
| macOS Intel | [Aura-x64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.dmg) |
| Windows x64 | [Aura-x64.exe](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.exe) |

Free during early access.

> **macOS note:** The app is unsigned. On first launch, right-click and choose Open, or run `xattr -cr /Applications/Aura.app` in Terminal.

<br/>

## Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Space` | Summon / dismiss overlay |
| `Alt+Shift+S` | Capture screenshot manually |
| `Alt+Shift+H` | Toggle invisible mode (hidden from screen recording) |
| `Shift+Enter` | Trigger voice input |
| `Alt+Arrow` | Nudge overlay position |

<br/>

## Stack

| Layer | Tech |
|---|---|
| Desktop | Electron 39, transparent overlay, always-on-top |
| Framework | TanStack Start (React 19 + TanStack Router) |
| Styling | Tailwind CSS v4, custom design tokens |
| AI | Kimi K2.6 (Moonshot AI), with vision support |
| AI extras | GPT-4o, Claude Sonnet, Gemini Flash, Llama 3.3 via OpenRouter |
| Backend | Supabase (auth, database, edge functions) |
| Hosting | Cloudflare Workers |
| Build | Vite 7, esbuild, electron-builder, Bun |

<br/>

## Architecture

```
Electron Overlay
  Screen capture, voice input, TTS, wake word ("Hey Aura")
       |
       | HTTPS
       v
Supabase Edge Function /chat
  Auth, rate limits, screenshot injection, model routing
       |
       +---> Moonshot AI (Kimi K2.6)
       +---> OpenRouter (GPT-4o, Claude, Gemini, Llama)

Web App (Cloudflare Workers)
  TanStack Start SSR, same Supabase DB
  Shared auth and conversation history
```

<br/>

## Auth flow

The overlay has no login form. When signed out, clicking the orb opens the web app at `?overlay=true`. After sign-in, the web app redirects to `aura://auth?access_token=...`. Electron intercepts the deep link and stores the session via `electron-store`.

Add this URL in **Supabase > Authentication > URL Configuration > Redirect URLs**:
```
aura://auth
```

<br/>

## Development

```bash
bun install

cp .env.example .env
# Fill in your keys

# Web app
bun dev

# Electron overlay
bun run electron:dev
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_WEB_URL` | Public URL of the web app |
| `KIMI_API_KEY` | Moonshot AI key (set as Supabase secret) |
| `OPENROUTER_API_KEY` | OpenRouter key (set as Supabase secret) |

<br/>

## Building

```bash
# macOS
bunx electron-builder --mac dmg --arm64 --publish never
bunx electron-builder --mac dmg --x64 --publish never

# Windows
bunx electron-builder --win nsis --x64 --publish never
```

Releases are built automatically via GitHub Actions on every `v*` tag:

```bash
git tag v0.4.0
git push origin v0.4.0
```

<br/>

## Deploying the edge function

```bash
supabase secrets set KIMI_API_KEY=sk-...
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase functions deploy chat --project-ref <your-project-ref>
```

The workflow in `.github/workflows/deploy-functions.yml` deploys automatically on push to `main` when files in `supabase/functions/` change.

<br/>

## GitHub Actions secrets

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_WEB_URL` | Public URL of the web app |
| `SUPABASE_PROJECT_REF` | Supabase project ref |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token |

<br/>

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: your feature'`
4. Push and open a pull request

<br/>

## License

MIT. See [LICENSE](LICENSE).
