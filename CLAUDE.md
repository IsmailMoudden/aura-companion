# Aura — Ambient AI Companion

## What this project is

Aura is a **premium desktop AI companion** built around the concept of *ambient intelligence*. It is not a chatbot, not a productivity dashboard, not a developer tool. It is a calm, emotionally warm presence that floats above the desktop, understands the user's screen, and maintains a continuous memory thread across sessions.

The product has two surfaces:
1. **The overlay** — a transparent, always-on-top Electron companion that lives on the desktop
2. **The web platform** — a full conversational app with history, screenshots, and memory

The overlay architecture (transparent windows, always-on-top, click-through, keyboard shortcuts) is being reused from an existing Electron project as *technical infrastructure only*. The entire product experience — interaction model, visual identity, emotional feel, UI/UX — is being redesigned from scratch.

## Stack

- **Framework**: TanStack Start (React 19 + TanStack Router v1, file-based routing in `src/routes/`)
- **Styling**: Tailwind CSS v4 with custom theme via CSS variables in `src/styles.css`
- **Backend/Auth**: Supabase (client in `src/integrations/supabase/`)
- **Build**: Vite 7, deployed to Cloudflare via `wrangler.jsonc`
- **Package manager**: Bun (use `bun` for all installs and scripts)

Key files:
- `src/styles.css` — single source of truth for the entire design system (tokens, animations, utilities)
- `src/routes/__root.tsx` — root layout (mounts `FloatingNav`, `AmbientBackground`, `Toaster`)
- `src/components/aura/` — the core design-system components
- `src/components/landing/` — landing page section components
- `src/components/overlay/` — overlay mock/demo components

## Design system

### Color palette

All colors are defined as CSS custom properties using OKLCH. The theme is a **soft, cool blue-violet** — ambient, not saturated.

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.62 0.08 235)` | Page base |
| `--foreground` | `oklch(0.985 0.012 80)` | Primary text |
| `--primary` | `oklch(0.85 0.13 230)` | Active elements |
| `--muted-foreground` | `oklch(0.86 0.04 230)` | Secondary text |
| `--glow` | `oklch(0.82 0.16 235)` | Orb glow, ring accents |
| `--glow-soft` | `oklch(0.88 0.09 230)` | Icon tints, soft highlights |
| `--border` | `oklch(1 0 0 / 14%)` | Glass panel borders |

Key gradients (use via CSS vars, never hardcode):
- `var(--gradient-ambient)` — multi-stop radial background
- `var(--gradient-hero)` — primary button / send button fill
- `var(--gradient-orb)` — the Aura orb sphere itself
- `var(--shadow-soft)` — elevation shadow
- `var(--shadow-glow)` — glowing orb shadow

### Typography

Two typefaces only:
- `font-display` / `text-display` — **Instrument Serif**, for headings, hero copy, conversational labels. Weight 400, letter-spacing -0.02em.
- `font-sans` — **Inter**, for all UI text. Weight 300 (light) by default. Weight 400 for emphasis only.

Rules:
- Hero: `text-display text-[clamp(3.5rem,9vw,9rem)]`
- Section titles: `text-display text-4xl` – `text-6xl`
- Card headings: `text-display text-2xl` – `text-3xl`
- Body: `text-[15px] font-light leading-relaxed`
- AI responses: `text-[17px] font-light leading-relaxed`
- Labels / eyebrows: `text-xs uppercase tracking-[0.2em] text-muted-foreground`

### Glassmorphism

Two glass utilities, both defined in `src/styles.css`:

```
glass         — backdrop-blur(24px), very light bg (~6% white), thin border
glass-strong  — backdrop-blur(32px), slightly heavier bg (~10% white)
```

Applied via the `GlassPanel` component (`src/components/aura/glass-panel.tsx`). All panels, cards, navs, and dialogs use one of these two levels. Never use opaque backgrounds.

### Spacing & shape

- Base radius: `--radius: 1rem` (16px). Larger shapes use `rounded-3xl` (24px) or `rounded-full`.
- Huge spacing between sections — sections breathe. Padding within panels: `p-8` to `p-12`.
- Maximum content width: `max-w-6xl` for layouts, `max-w-2xl` to `max-w-3xl` for reading columns.
- Grid gaps: `gap-6` standard, tighter only when intentional.

### Animations

All animations are defined in `src/styles.css` as `@keyframes` and exposed as Tailwind utility classes:

| Class | Description |
|---|---|
| `animate-breathe` | Orb idle pulse — scale + brightness, 6s loop |
| `animate-float` | Vertical drift, 9s loop |
| `animate-float-slow` | Vertical drift, 14s loop (background blobs) |
| `animate-glow-pulse` | Opacity fade, 4s loop (halos) |
| `animate-fade-up` | Enter animation — translateY + blur reveal |
| `animate-fade-in` | Enter animation — opacity + blur reveal |
| `animate-orbit` | Circular orbit (Orb thinking state) |
| `animate-wave` | Waveform bars (audio input indicator) |

Use `animationDelay` inline style to stagger sequences (e.g. `style={{ animationDelay: "0.25s" }}`).

### Core components

#### `Orb` (`src/components/aura/orb.tsx`)
The central visual identity of Aura. A layered sphere with: outer halo, core gradient, specular highlight, and state overlays.

Props: `size` (number, px), `state` ("idle" | "listening" | "thinking"), `className`.

States:
- `idle` — breathing animation only
- `listening` — two pulsing concentric rings appear
- `thinking` — a small dot orbits the sphere

#### `GlassPanel` (`src/components/aura/glass-panel.tsx`)
Wrapper for all panel/card surfaces. Prop `strong` increases blur/opacity slightly.

#### `PillButton` (`src/components/aura/pill-button.tsx`)
Rounded-full CTA. Two variants:
- `primary` — filled with `--gradient-hero` + glow shadow
- `ghost` — glass surface, no fill

Two sizes: `md` (default), `lg`. Accepts `to` prop for router links.

#### `FloatingNav` (`src/components/aura/floating-nav.tsx`)
Fixed top nav, pill-shaped glass container, centered. Links: Product, Overlay, Chat, Settings. Right-aligned Sign in CTA.

#### `AmbientBackground` (`src/components/aura/ambient-background.tsx`)
Full-viewport fixed background. Layered: gradient base → blurred human imagery (mix-blend-screen) → radial color blobs → subtle noise texture.

#### `Section` (`src/components/landing/section.tsx`)
Standard landing section wrapper. Props: `eyebrow` (small label), `title` (ReactNode), `description`, `children`.

#### `FeatureGrid` (`src/components/landing/feature-grid.tsx`)
3-up or 2-up responsive grid of glass feature cards. Each card has icon, title, description, and a hover glow reveal.

## Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `src/routes/index.tsx` | Landing page — hero, feature sections, CTA |
| `/app` | `src/routes/app.tsx` | Full chat platform with sidebar + conversation |
| `/overlay` | `src/routes/overlay.tsx` | Overlay showcase — interactive state demo |
| `/settings` | `src/routes/settings.tsx` | Settings — overlay, shortcuts, memory, theme, privacy |
| `/auth` | `src/routes/auth.tsx` | Sign in / sign up |

## Design principles — never violate these

**Feel**
- Calm, warm, human, ambient. Never clinical, never dense.
- Space is a design element. When in doubt, add more.

**Motion**
- All motion is slow and organic. Fastest animation: 0.5s. Most are 4–14s loops.
- Enters use `animate-fade-up` or `animate-fade-in` with staggered delays.
- No snappy, jarring transitions.

**Color**
- Cool blue-violet palette only. No warm accent colors in the UI (only in background blobs at very low opacity).
- All surfaces semi-transparent. Never fully opaque backgrounds.
- Text is always light (`--foreground` or `--muted-foreground`). No dark text on light backgrounds.

**Typography**
- Instrument Serif for anything emotional or prominent. Inter for UI.
- Italic `<em>` tags are used within serif headings for softness and breath.
- No bold text anywhere — use `font-light` and size for hierarchy.

**Components**
- No shadcn/Radix components on visible UI surfaces — those are utility only (dropdowns, dialogs internals). All visible UI is built from `GlassPanel`, `PillButton`, `Orb`, and custom markup.
- `rounded-full` for interactive controls (buttons, inputs, toggles). `rounded-3xl` for panels and cards.

**Writing voice**
- Soft, poetic, second-person. "Aura listens." "Your AI, everywhere."
- No jargon. No feature-list energy. Every word earns its place.
- Eyebrow labels: short, lowercase spirit, tracked-out caps.

## What NOT to do

- Do not add opaque surfaces, light backgrounds, or any SaaS dashboard aesthetic
- Do not use `font-bold` or `font-semibold` anywhere in the product UI
- Do not add borders heavier than `border-white/[0.1]`
- Do not introduce new color families (no red/green/yellow unless destructive states)
- Do not break the all-lowercase font-weight convention — `font-light` is the default
- Do not make the orb component square or non-circular
- Do not use tight spacing — every section needs room to breathe
- Do not add more navigation items without removing one
- Do not use `bg-white`, `bg-black`, or any non-glass opaque panel as a surface

## AI — Kimi K2.6

All AI calls go through the Supabase Edge Function at `supabase/functions/chat/index.ts`.

- **Model**: `kimi-k2.6` (Kimi K2.6 Thinking, by Moonshot AI)
- **Base URL**: `https://api.moonshot.ai/v1`
- **Key env var**: `KIMI_API_KEY` — set as a Supabase secret (`supabase secrets set KIMI_API_KEY=sk-...`)
- **Vision**: yes — pass `screenshot` as a base64 data-URL in the request body; the function converts it to Kimi's multimodal format
- **Params**: K2.6 Thinking fixes temperature/top_p internally — do not pass them

### Message format with screenshot

```ts
// Body sent to /functions/v1/chat
{
  messages: [{ role: "user", content: "..." }, ...],  // conversation history
  screenshot?: "data:image/png;base64,...",            // optional, from screen capture
  conversationId?: string
}
```

The function wraps the last user message as a multimodal content array when `screenshot` is present.

### Callers
- Web app (`src/routes/app.tsx`) — text only (no screenshot yet)
- Overlay renderer (`src/components/overlay/overlay-app.tsx`) — text + optional screenshot

## Development

```bash
bun dev          # start dev server
bun build        # production build
bun lint         # ESLint
bun format       # Prettier
```

Supabase types are generated into `src/integrations/supabase/types.ts`. DB has `conversations` and `messages` tables. Auth is email/password via Supabase.
