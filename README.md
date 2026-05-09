# Aura — Ambient AI Companion

> A calm, intelligent presence for your desktop. Understands your screen, remembers what matters, stays out of the way.

---

## Download

| Platform | Installer |
|---|---|
| macOS Apple Silicon (M1/M2/M3) | [Aura-arm64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest) |
| macOS Intel (x64) | [Aura-x64.dmg](https://github.com/IsmailMoudden/aura-companion/releases/latest) |
| Windows x64 | [Aura-x64-setup.exe](https://github.com/IsmailMoudden/aura-companion/releases/latest) |

Free during early access. No account needed to start.

---

## What it is

Aura has two surfaces:

- **Desktop overlay** — a transparent, always-on-top Electron companion that floats above any app. Press a shortcut, talk to it, it steps back.
- **Web app** — full conversational interface with history, screenshots, and memory at [companionaura.lovable.app](https://companionaura.lovable.app)

---

## Stack

- **Framework**: TanStack Start (React 19 + TanStack Router, file-based routing)
- **Styling**: Tailwind CSS v4 with custom design tokens via CSS variables
- **AI**: Kimi K2.6 (Moonshot AI) via Supabase Edge Functions
- **Backend/Auth**: Supabase (email/password auth, `conversations` + `messages` tables)
- **Desktop**: Electron 39, transparent overlay window
- **Build**: Vite 7, deployed to Cloudflare Pages

---

## Development

```bash
bun install

# Web app
bun dev

# Electron overlay (dev mode with hot reload)
bun run electron:dev
```

Requires a `.env` file at the root:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_WEB_URL=https://companionaura.lovable.app
KIMI_API_KEY=...
```

---

## Building

```bash
# macOS DMG (current machine arch)
bun run electron:build

# Windows NSIS installer (run on Windows or via CI)
bun run electron:build:win
```

Releases are built automatically via GitHub Actions on every `v*` tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow builds macOS arm64, macOS x64, and Windows x64 in parallel and publishes a GitHub Release with all three installers.

> **Note**: macOS builds are unsigned (no Apple Developer certificate). On first launch, right-click → Open to bypass Gatekeeper.

---

## GitHub Actions secrets

Add these in **Settings → Secrets → Actions** before triggering a release:

| Secret | Description |
|---|---|
| `VITE_WEB_URL` | Public URL of the web app |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

---

## Auth flow (overlay ↔ web)

The overlay has no in-app login form. When the user isn't signed in, clicking the orb opens the web app in the system browser with `?overlay=true`. After sign-in, the web app redirects to `aura://auth?access_token=...&refresh_token=...`. Electron intercepts this deep link and restores the session inside the overlay.

Register the redirect URL in **Supabase → Authentication → URL Configuration**:
```
aura://auth
```

---

## License

Private — all rights reserved.
