# AI Companion Platform — Design & Build Plan

A premium, cinematic, ambient AI companion product site + web app shell. Dark elegant theme, soft purple/blue-gray gradients, glassmorphism, huge thin typography, generous spacing. Inspired by the reference's mood (deep purple haze, floating product, large serif-adjacent display type, soft glow).

## Brand & Design System

**Palette (oklch tokens in `src/styles.css`)**
- `--background`: deep midnight indigo (~oklch(0.16 0.04 280))
- `--foreground`: warm off-white (~oklch(0.97 0.01 90))
- `--primary`: soft lavender (~oklch(0.78 0.09 295)) — used for CTAs/accents
- `--accent-glow`: luminous violet (~oklch(0.72 0.16 300))
- `--surface-glass`: translucent panel base (white at 4–8% over blurred bg)
- `--muted-foreground`: cool lilac-gray
- Gradients: `--gradient-ambient` (radial purple → indigo → near-black), `--gradient-hero` (linear lavender → periwinkle)
- Shadows: `--shadow-soft` (large blurred low-opacity), `--shadow-glow` (violet bloom)

**Typography**
- Display: Instrument Serif (or Fraunces) for hero — matches reference's elegant serif headline
- UI / body: Inter with weights 200/300/400; tight tracking on display, generous line-height
- Scale: hero clamp(56px, 9vw, 140px), section H2 ~64px, body 17px, large spacing rhythm (sections min 160px vertical padding)

**Primitives**
- `GlassPanel` — backdrop-blur, 1px inner highlight, no hard border, rounded-3xl/4xl
- `AmbientBackground` — fixed radial gradient + animated noise/blur orbs
- `Orb` — breathing animated companion (SVG + CSS keyframes: scale 1↔1.06, blur pulse, hue drift)
- `PillButton` — fully rounded, lavender fill / glass ghost variants
- `FloatingNav` — translucent pill, blur, top-center

**Motion** (Tailwind keyframes in styles.css)
- `breathe` (6s ease-in-out infinite), `float` (8s), `fade-up`, `glow-pulse`, `shimmer`
- Page transitions: fade + slight blur on enter

## Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx          # ambient bg + FloatingNav + Outlet
  index.tsx           # Landing
  overlay.tsx         # Overlay companion showcase
  app.tsx             # Layout for web app
  app.index.tsx       # Chat (default web app view)
  app.memory.tsx      # Memory / screenshots timeline
  settings.tsx        # Settings layout
  settings.index.tsx  # Overlay & shortcuts
  settings.memory.tsx # AI memory controls
  settings.privacy.tsx
```

Each route gets its own `head()` with unique title/description/og.

## Page-by-Page

### 1. Landing (`/`)
- Glass FloatingNav: logo orb, links (Product, Overlay, Memory, Pricing, Blog), CTA "Open Web App"
- Hero: massive centered serif headline "Your ambient AI. Quietly brilliant." Sub-copy thin and short. Two CTAs: `Download Overlay` (filled lavender), `Open Web App` (glass ghost). Behind: large breathing Orb + soft floating gradient blobs + faint grid.
- Sections (each full-bleed, generous padding, alternating left/right compositions):
  - **Your AI everywhere** — multi-device floating mockups
  - **Understands your screen** — screenshot card stack with subtle highlights
  - **Ambient intelligence** — abstract orb visualization
  - **Stay in flow** — overlay mockup floating over a blurred desktop
  - **Context-aware conversations** — chat preview card
- Product showcase: macOS-style window with overlay orb pinned on top, screenshot understanding annotations
- Footer: minimal, glass divider, social pills

### 2. Overlay Companion (`/overlay`)
- Cinematic device frame (faux desktop wallpaper blurred) with the overlay live-demo'd at center
- Tabbed states walkthrough: **Idle / Listening / Thinking / Expanded** — clicking a tab morphs the overlay (Framer-motion-style CSS transitions)
  - Idle: small breathing orb
  - Listening: orb with soft waveform ring
  - Thinking: shimmer/orbit dots
  - Expanded: glass panel with screenshot preview card, tiny assistant reply, quick action chips ("Summarize", "Explain", "Translate")
- Side copy explains each state with thin headlines

### 3. Chat Platform (`/app`)
- Layout: slim glass sidebar (left) + main canvas
  - Sidebar sections: New conversation, Recent, Pinned memories, Screenshot timeline (thumbs)
  - Top: minimal breadcrumb / conversation title
- Main: spacious conversation column max-w-3xl, centered
  - Messages: no bubbles for AI (just text with subtle left accent), user messages in soft glass pill aligned right
  - Markdown rendered with elegant typography (react-markdown + prose)
  - Inline screenshot attachments as rounded cards with soft shadow
  - Contextual memory cards float between messages
  - AI suggestion chips above input
- Floating input bar: fully rounded glass, mic icon, attach, send-as-glow button; appears to hover above content with shadow

### 4. Memory (`/app/memory`)
- Grid of memory cards (pinned highlights), screenshot timeline by day, search bar (glass)

### 5. Settings (`/settings/*`)
- Left rail (glass) with sections: Overlay, Shortcuts, AI Memory, Theme, Screenshots, Privacy
- Right pane: large headings, generous spacing, switches/sliders styled glass; no dense forms
- Theme tab: live preview swatch of ambient gradient

## Technical Details

- Tailwind v4 tokens added to `src/styles.css`; new keyframes `breathe`, `float`, `glow-pulse`, `fade-up`
- Reusable components in `src/components/`:
  - `ambient-background.tsx`, `floating-nav.tsx`, `orb.tsx`, `glass-panel.tsx`, `pill-button.tsx`, `section.tsx`
  - Landing sections in `src/components/landing/`
  - Overlay demo states in `src/components/overlay/`
  - Chat shell in `src/components/chat/` (sidebar, message, input)
- Mock data only (no backend) — conversation history, screenshot thumbs, memory cards as static fixtures
- Fonts loaded via Google Fonts `<link>` in `__root.tsx` head
- All interactive transitions via CSS + Tailwind utilities; no extra animation library needed (lightweight)
- SEO `head()` per route; semantic `<h1>` per page; alt text on all imagery

## Out of Scope (this pass)
- Real auth, backend, AI calls, payments
- Actual desktop binary download
- Video assets

## Deliverable
A 5-route cinematic site + web-app shell that nails the reference's mood: dark, soft, lavender, huge serif type, glass panels, breathing orb — feeling like an Apple/Humane/Pi-tier product page rather than a SaaS dashboard.
