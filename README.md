# Tanmatsu 端末

A journey through Japan, terminal in hand.

Four cities. One real shell. You learn the terminal by *using it* — actual commands against a real sandboxed filesystem, situated in scenarios that feel like places, not lessons. Your mentor at the Shibuya studio teaches you the basics in **Tokyo**. A temple librarian in **Kyoto** teaches you to search and read. **Osaka** and **Hokkaido** ship in upcoming updates.

No videos. No multiple choice. No signup. Progress lives in `localStorage`.

## What's inside

```
app/
  page.tsx               full-bleed Tokyo hero, terminal below
  map/                   /map — the Tanmatsu route map of Japan
  play/[levelId]/        per-level game screen
components/
  LandingHero.tsx        custom DOM terminal on the home page
  SandboxTerminal.tsx    xterm.js terminal wired to the sandbox
  LevelView.tsx          scenario + terminal + hanko-reveal completion
  JapanMap.tsx           SVG map with city dots + Shinkansen lines + unlock animations
  HankoSeal.tsx          the vermillion seal stamp (端)
content/
  tokyo.ts               Tokyo — 8 levels, basics (pwd, cd, ls, cat, mkdir, touch, mv, rm)
  kyoto.ts               Kyoto — 8 levels, search & text (grep, find, head, tail, wc)
  osaka.ts               Osaka — coming soon (pipes, redirects, &&/||)
  hokkaido.ts            Hokkaido — coming soon (permissions, processes)
lib/
  sandbox/
    fs.ts                virtual filesystem
    parser.ts            shell tokenizer + AST
    executor.ts          walks AST, threads pipes, applies redirects
    commands.ts          13 commands + tab-completion registry
  levels.ts              city + level types, registry, lookups
  progress.ts            localStorage progress
```

## Shell features

The in-browser sandbox supports:

- 13 commands: `pwd`, `cd`, `ls`, `cat`, `mkdir`, `touch`, `mv`, `rm`, `grep`, `find`, `head`, `tail`, `wc` — plus `echo`, `clear`, `help`
- Quoting: `'literal'`, `"with escapes"`, `\ escape`
- Pipes: `cat file | grep foo | wc -l`
- Redirects: `>`, `>>`, `<`
- Logical operators: `cmd1 && cmd2`, `cmd1 || cmd2`, `cmd1 ; cmd2`
- Tab autocomplete (commands AND paths)
- ↑↓ history navigation
- Ctrl+L clear, Ctrl+C cancel input

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest — 96 sandbox unit tests
npm run build    # production build
```

## Design system

Paper, ink, and the seal. Three colors do the work:

| Token  | Value     | Where it's used                                   |
| ------ | --------- | ------------------------------------------------- |
| paper  | `#FAF6EE` | page background                                   |
| ink    | `#161616` | text + terminal background                        |
| seal   | `#C8392E` | hanko stamp 端, current-city indicator, success   |
| jade   | `#7AAE6B` | inline success messages inside the terminal       |

Belt accents (`white → yellow → green → brown`) are reserved for city progression. Type pairing: **Shippori Mincho** display, **Inter** body, **JetBrains Mono** only inside the terminal frame.

The landing hero uses a full-bleed Tokyo photo (Unsplash hot-link, swap the URL in `content/tokyo.ts → photoUrl`). The map is a pure SVG — no land mass, just the route, like a vintage train poster.

## Adding a city

1. Create `content/<city>.ts` exporting a `City`: `{id, name, nameJa, subtitle, tagline, belt, promptName, photoUrl, mapPosition, levels[]}`.
2. Add it to the `CITIES` array in `lib/levels.ts` in trip order.
3. `mapPosition` is in a 1200×620 viewBox — pick coords that match its rough position on the map.
4. Write 8 levels. Each level: `{id, cityId, index, title, scenario, hints, teaches, initialFs, initialCwd, check, completedMessage}`. Lean on the city's character — Kyoto's scenarios live in temples and libraries; Osaka's should live in kitchens.

## Adding a command

1. Add a `CommandFn` to `lib/sandbox/commands.ts`.
2. Register it in the `COMMANDS` map.
3. Add Vitest coverage in `lib/sandbox/commands.test.ts` — happy path + at least one error case + at least one pipe usage.

## Deploy

```bash
npx vercel
```

Vercel auto-detects Next.js. Or connect the GitHub repo via vercel.com for push-to-deploy.

## License

MIT.
