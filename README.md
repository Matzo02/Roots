# Roots

Pixel garden of your relationships. Tend the people who matter.

UI scaffold for the Generative UI Global Hackathon (May 9, 2026). Backend wires in tomorrow.

## Run

```bash
npm install
npm run dev
# → http://localhost:3000
```

## What's here today (UI only)

- **Pixel garden** — 12 plants in 6 states (sapling / healthy / mature / wilting / ready / dying)
- **Status bar** — level, XP bar, streak, daily energy budget
- **Today's quest** — auto-highlights the highest-priority "ready" plant
- **Plant modal** — context, warmth meter, channel toggle (WhatsApp / iMessage), drafted message editor, four actions (water / fertilize / harvest / prune)
- **Live send paths wired up**:
  - WhatsApp → opens `wa.me/<phone>?text=<msg>` deep link
  - iMessage → opens `sms:<phone>&body=<msg>` URL scheme
- **Local game state** — actions update XP, level, energy, plant state, warmth in-memory

## What wires in tomorrow

1. **Replace `lib/mock-data.ts`** with real plant data
2. **Add `app/api/import/route.ts`** — parse uploaded WhatsApp `.txt` chat exports → structured messages
3. **Add `app/api/garden/route.ts`** — compute plant states from real chat history + public socials
4. **Add `lib/imessage-read.ts`** — read `~/Library/Messages/chat.db` (compatibility layer)
5. **Add `lib/imessage-send.ts`** — `osascript` for unattended iMessage send
6. **Add agent loop** — port from `MCP-fashion-d2c/app/api/chat/route.ts`, swap tools for plant actions + draft generation
7. **Persist game state** — small SQLite or JSON file in `~/.roots/`

## Stack

- Next.js 15 / React 19 / Tailwind 4 (matches MCP-fashion-d2c)
- Pixel font: Press Start 2P (headers) + Pixelify Sans (body), Google-served
- Plant sprites: emoji + pixel-bordered tiles (no asset pipeline)

## Files

```
app/
  layout.tsx          shell
  page.tsx            wires everything, holds game state
  globals.css         tailwind + pixel theme + animations
components/
  StatusBar.tsx       top bar (LV / XP / streak / energy)
  QuestCard.tsx       today's highlighted plant
  Garden.tsx          12-tile grid
  Plant.tsx           single plant tile
  PlantModal.tsx      tend dialog (context / channel / draft / 4 actions)
lib/
  types.ts            Plant, PlayerState, Action, Channel
  mock-data.ts        seed plants + helpers (emoji, label, wa.me URL builders)
  utils.ts            cn() helper
```

## Demo notes

- "Ready" plants pulse and have a glowing border
- "Wilting" plants sway gently
- "Dying" plants are grayed
- Channel toggle defaults to whichever the contact prefers
- Tapping a primary action: opens deep link in new tab AND fires local state update (XP, plant state, energy)
- Toast appears bottom-center confirming the action

## Hackathon submission notes

- Protocols: AG-UI-style HITL pattern (the modal is the wait-for-response surface)
- Live writes: `wa.me` deep links (one-tap send by user, real messages in real chat threads) + iMessage URL scheme
- Generative UI: per-plant context drives the modal's draft + action availability; per-day quest changes
