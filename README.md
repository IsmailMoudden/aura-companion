# Aura — Ambient AI Companion

> A calm, intelligent presence that lives on your desktop. It sees your screen, understands your context, and steps back when you don't need it.

![Aura overlay](public/aura-preview.png)

---

## Download

| Platform | Installer |
|---|---|
| macOS Apple Silicon (M1/M2/M3) | [Aura-arm64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-arm64.dmg) |
| macOS Intel | [Aura-x64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.dmg) |
| Windows x64 | [Aura-x64.exe](https://github.com/IsmailMoudden/aura-companion/releases/latest/download/Aura-x64.exe) |

Free during early access · [companionaura.lovable.app](https://companionaura.lovable.app)

---

## What it is

Aura is not an app you open. It's a presence that floats above everything else on your desktop — always one shortcut away, never in the way.

**Two surfaces:**
- **Desktop overlay** — transparent, always-on-top Electron window. Sees your screen. Responds to voice or text. Disappears when you're done.
- **Web app** — full conversational interface with history and memory at [companionaura.lovable.app](https://companionaura.lovable.app)

**Keyboard shortcuts:**
| Shortcut | Action |
|---|---|
| `Alt+Space` | Summon / dismiss overlay |
| `Alt+Shift+S` | Capture screenshot manually |
| `Alt+Shift+H` | Toggle invisible mode (hidden from screen capture) |
| `Shift+Enter` | Trigger voice input |
| `Alt+←↑↓→` | Nudge overlay position |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | TanStack Start (React 19 + TanStack Router) |
| Styling | Tailwind CSS v4, custom design tokens via CSS variables |
| AI | Kimi K2.6 / moonshot-v1-8k (Moonshot AI) via Supabase Edge Functions |
| Vision | moonshot-v1-32k-vision-preview (auto-selected when screenshot attached) |
| Backend / Auth | Supabase (email/password, `conversations` + `messages` tables) |
| Desktop | Electron 39, transparent overlay window |
| Build | Vite 7, deployed to Cloudflare Pages |

---

## Development

```bash
bun install

# Web app
bun dev

# Electron overlay
bun run electron:dev
```

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

---

## Building

```bash
# macOS
bunx electron-builder --mac dmg --arm64 --publish never

# Windows (run on Windows or via CI)
bunx electron-builder --win nsis --x64 --publish never
```

Releases are built automatically via GitHub Actions on every `v*` tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds macOS arm64, macOS x64, and Windows x64 in parallel and publishes a GitHub Release.

> macOS builds are unsigned. On first launch: right-click → Open, or run `xattr -cr /Applications/Aura.app` in Terminal.

---

## GitHub Actions secrets

Set these in **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `VITE_WEB_URL` | Public URL of the web app |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

---

## Auth flow

The overlay has no login form. When signed out, clicking the orb opens the web app at `?overlay=true`. After sign-in, the web app redirects to `aura://auth?access_token=...&refresh_token=...`. Electron intercepts this deep link and restores the session inside the overlay — persisted across relaunches via `electron-store`.

Add this redirect URL in **Supabase → Authentication → URL Configuration**:
```
aura://auth
```

---

## License

MIT
